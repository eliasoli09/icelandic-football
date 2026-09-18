/**
 * Builds the Tenaball questions. Each holds every valid answer, read from two
 * sources that do not copy each other, and is written only when they agree on
 * the whole set.
 *
 * A question whose sources disagree, or that meets a name with no entry in
 * names.ts, is not written: it goes to review.json with the reason, and any
 * earlier copy is removed so an unverified question cannot stay on the site. A
 * source that cannot be fetched leaves the last verified copy where it is.
 *
 * Usage: cd web && npx tsx scripts/topp10/build.mts [--cache DIR]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { Answer, Kind, Topp10List } from '../../src/lib/topp10/types'
import type { Level } from '../../src/lib/level'
import type { Entity } from './names'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { ambiguousAliases } = await import(join(webDir, 'src/lib/topp10/match.ts'))
const W = await import(join(here, 'wikitext.ts'))
const { CLUBS, PEOPLE } = await import(join(here, 'names.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const LISTS_DIR = join(webDir, 'src/lib/topp10/lists')
const REVIEW_FILE = join(here, 'review.json')
const today = new Date().toISOString().slice(0, 10)
const cacheDir = process.argv.includes('--cache')
  ? process.argv[process.argv.indexOf('--cache') + 1]
  : join(tmpdir(), 'topp10-cache')
mkdirSync(cacheDir, { recursive: true })

/** Could not read a source at all; says nothing about whether a question is right. */
class FetchError extends Error {}

// ── sources ────────────────────────────────────────────────────────────

const UA = 'BestaSpain-Topp10/1.0 (https://islensk-fotbolti.vercel.app; checks quiz answers)'
let lastFetch = 0

const utf8 = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes)

/** The raw bytes are cached, so a file in another encoding can still be read correctly. */
async function fetchCached(key: string, url: string, decode = utf8): Promise<string> {
  const file = join(cacheDir, key.replace(/[^\w.-]+/g, '_'))
  if (existsSync(file)) return decode(readFileSync(file))
  const wait = lastFetch + 1000 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastFetch = Date.now()
  let res: Response
  try { res = await fetch(url, { headers: { 'User-Agent': UA } }) }
  catch (err) { throw new FetchError(`${url}: ${(err as Error).message}`) }
  if (!res.ok) throw new FetchError(`${url} svaraði ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  writeFileSync(file, bytes)
  return decode(bytes)
}

// the 2016/17 FPL file is in Windows-1252, so "Agüero" arrives as bytes that are not UTF-8
const utf8OrLatin = (bytes: Uint8Array) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('windows-1252').decode(bytes) }
}

interface Source { name: string; url: string }
interface Page { wikitext: string; source: Source }

async function wiki(lang: 'en' | 'is', page: string): Promise<Page> {
  const api = `https://${lang}.wikipedia.org/w/api.php?action=parse&prop=wikitext%7Crevid&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(page)}`
  const json = JSON.parse(await fetchCached(`${lang}-${page}.json`, api))
  if (json.error) throw new Error(`${lang}.wikipedia "${page}": ${json.error.info}`)
  return {
    wikitext: json.parse.wikitext,
    // the exact revision that was read, so the check can be repeated
    source: { name: `${lang}.wikipedia.org · ${String(json.parse.title).replace(/[–—]/g, '-')}`, url: `https://${lang}.wikipedia.org/w/index.php?oldid=${json.parse.revid}` },
  }
}

const csvCells = (line: string) => {
  const out: string[] = []; let cell = '', quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { out.push(cell); cell = '' }
    else cell += ch
  }
  out.push(cell); return out
}

async function fplGoals(tag: string): Promise<{ rows: { name: string; goals: number }[]; source: Source }> {
  const url = `https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/${tag}/cleaned_players.csv`
  const lines = (await fetchCached(`fpl-${tag}.csv`, url, utf8OrLatin)).trim().split('\n')
  const head = csvCells(lines[0])
  const [f, s, g] = ['first_name', 'second_name', 'goals_scored'].map((k) => head.indexOf(k))
  if (f < 0 || s < 0 || g < 0) throw new Error(`FPL ${tag}: dálka vantar`)
  return {
    rows: lines.slice(1).map(csvCells).map((c) => ({ name: `${c[f]} ${c[s]}`.trim(), goals: Number(c[g]) })),
    source: { name: `Fantasy Premier League ${tag} (safn vaastav)`, url: `https://github.com/vaastav/Fantasy-Premier-League/tree/master/data/${tag}` },
  }
}

const OUR_RESULTS: Source = {
  name: 'Úrslit allra leikja tímabilsins í gagnagrunni Bestu spárinnar',
  url: 'https://islensk-fotbolti.vercel.app/tafla',
}
const OUR_FIXTURES: Source = {
  name: 'Leikjaplan tímabilsins í gagnagrunni Bestu spárinnar',
  url: 'https://islensk-fotbolti.vercel.app/leikir',
}

interface Rec { w: number; d: number; l: number; gf: number; ga: number }
let teamNames: Map<number, string> | null = null

type MatchRow = { home_team: number; away_team: number; home_goals: number | null; away_goals: number | null }

async function ourMatches(league: string, season: number, filter: { played: boolean; phases?: string[] }): Promise<MatchRow[]> {
  if (!teamNames) {
    const { data, error } = await db().from('teams').select('id,name').range(0, 9999)
    if (error) throw new FetchError(error.message)
    teamNames = new Map((data ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))
  }
  const rows: MatchRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = db().from('matches').select('home_team,away_team,home_goals,away_goals').eq('league', league).eq('season', season)
    if (filter.played) q = q.eq('status', 'played')
    if (filter.phases) q = q.in('phase', filter.phases)
    const { data, error } = await q.order('id').range(from, from + 999)
    if (error) throw new FetchError(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

interface Game { home: string; away: string; hg: number; ag: number }
interface OurSeason { records: Map<string, Rec>; games: Game[] }

/** Each club's record over the season, and every game, from the results we hold. */
async function ourSeason(league: string, season: number, phases: string[]): Promise<OurSeason> {
  const records = new Map<string, Rec>()
  const games: Game[] = []
  for (const m of await ourMatches(league, season, { played: true, phases })) {
    const name = (id: number) => teamNames!.get(id) ?? `#${id}`
    games.push({ home: name(m.home_team), away: name(m.away_team), hg: m.home_goals!, ag: m.away_goals! })
    for (const [team, gf, ga] of [[m.home_team, m.home_goals!, m.away_goals!], [m.away_team, m.away_goals!, m.home_goals!]]) {
      const r = records.get(name(team)) ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0 }
      if (gf > ga) r.w++; else if (gf === ga) r.d++; else r.l++
      r.gf += gf; r.ga += ga
      records.set(name(team), r)
    }
  }
  return { records, games }
}

/** Points and goal difference of `a` against `b`, from their games with each other. */
function headToHead(games: Game[], a: string, b: string) {
  let pts = 0, opp = 0, gd = 0
  for (const g of games) {
    const [x, y] = g.home === a && g.away === b ? [g.hg, g.ag] : g.home === b && g.away === a ? [g.ag, g.hg] : [null, null]
    if (x === null || y === null) continue
    gd += x - y
    if (x > y) pts += 3; else if (x === y) { pts++; opp++ } else opp += 3
  }
  return { pts: pts - opp, gd }
}

/** Every club with a match in the season, played or not. */
async function ourTeams(league: string, season: number): Promise<string[]> {
  const ids = new Set((await ourMatches(league, season, { played: false })).flatMap((m) => [m.home_team, m.away_team]))
  return [...ids].map((id) => teamNames!.get(id) ?? `#${id}`)
}

// ── names ──────────────────────────────────────────────────────────────

function registry(entries: Entity[], kind: string) {
  const byName = new Map<string, Entity>()
  const typed = new Map<string, string>()
  for (const e of entries) {
    for (const n of [e.label, ...e.names]) {
      const key = normalise(n), prev = byName.get(key)
      if (prev && prev.id !== e.id) throw new Error(`names.ts: "${n}" er bæði ${prev.id} og ${e.id}`)
      byName.set(key, e)
    }
    for (const n of [e.label, ...e.names, ...(e.extra ?? [])]) {
      const key = normalise(n), prev = typed.get(key)
      if (prev && prev !== e.id) throw new Error(`names.ts: "${n}" er bæði ${prev} og ${e.id}`)
      typed.set(key, e.id)
    }
  }
  return (spelling: string): Entity => {
    const e = byName.get(normalise(spelling))
    if (!e) throw new Error(`${kind} "${spelling}" er ekki í names.ts`)
    return e
  }
}
const clubOf = registry(CLUBS, 'félagið')
const personOf = registry(PEOPLE, 'leikmaðurinn')

type Draft = Answer & { loose: string[] }

/**
 * An answer and every spelling that opens it. A player's surname, and first
 * name with surname, are accepted only if no other answer on the question
 * would also claim them - `finish` drops the ones that collide.
 */
function answerFor(kind: Kind, e: Entity, detail: string): Draft {
  const fixed = new Set<string>([e.label, ...e.names, ...(e.extra ?? [])].map(normalise))
  const loose = new Set<string>()
  const words = e.label.split(/\s+/)
  if (kind === 'player' && words.length >= 2) loose.add(normalise(words[words.length - 1]))
  if (kind === 'player' && words.length >= 3) loose.add(normalise(`${words[0]} ${words[words.length - 1]}`))
  for (const k of fixed) loose.delete(k)
  return { id: e.id, label: e.label, detail, accept: [...fixed], loose: [...loose] }
}

type Meta = Omit<Topp10List, 'answers' | 'verifiedAt' | 'level'>

/**
 * How hard a question is, decided by what it asks rather than by feel: the
 * clubs playing now and Europe's champions are easy; recent tables and the
 * Icelandic honours are medium; older seasons, scorers and smaller leagues hard.
 */
export function levelOf(id: string): Level {
  if (/-lid-\d{4}$/.test(id) || ['evropa-meistarar', 'evropa-meistaradeildin'].includes(id)) return 'easy'
  const year = Number(id.match(/(\d{4})$/)?.[1] ?? 0)
  if (/^enska-lokastada-/.test(id)) return year >= 2023 ? 'easy' : year >= 2016 ? 'medium' : 'hard'
  if (/^enska-markahaestir-/.test(id)) return year >= 2023 ? 'medium' : 'hard'
  if (/^(spann|italia|thyskaland|frakkland|island)-lokastada-/.test(id)) return year >= 2024 ? 'medium' : 'hard'
  if (['island-meistarar', 'island-bikarmeistarar', 'island-landsleikir'].includes(id)) return 'medium'
  return 'hard'
}

function finish(meta: Meta, drafts: Draft[]): Topp10List {
  const ids = drafts.map((d) => d.id)
  if (new Set(ids).size !== ids.length) throw new Error(`sama svar tvisvar: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`)
  const owners = new Map<string, Set<string>>()
  for (const d of drafts) for (const k of [...d.accept, ...d.loose]) owners.set(k, (owners.get(k) ?? new Set()).add(d.id))
  const answers: Answer[] = drafts.map(({ loose, ...a }) => ({
    ...a, accept: [...a.accept, ...loose.filter((k) => owners.get(k)!.size === 1)],
  }))
  const { note, ...rest } = meta
  const list: Topp10List = { ...rest, level: levelOf(meta.id), answers, verifiedAt: today, ...(note ? { note } : {}) }
  const clash = ambiguousAliases(list)
  if (clash.length) throw new Error(`sama stafsetning opnar tvö ólík svör: ${clash.join(', ')}`)
  if (answers.length < 10) throw new Error(`aðeins ${answers.length} gild svör`)
  if (new Set(list.sources.map((s) => new URL(s.url).host + new URL(s.url).pathname + new URL(s.url).search)).size < 2) throw new Error('færri en tvær heimildir')
  return list
}

function mustAgree(problems: string[], what: string) {
  if (!problems.length) return
  const shown = problems.slice(0, 8).join('; ')
  throw new Error(`${what}: ${shown}${problems.length > 8 ? ` (og ${problems.length - 8} til viðbótar)` : ''}`)
}

/** The first ten, and anyone level with the tenth. */
function topWithTies<T>(items: T[], value: (t: T) => number, n = 10): T[] {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  if (sorted.length < n) throw new Error(`aðeins ${sorted.length} í heimild`)
  const cut = value(sorted[n - 1])
  return sorted.filter((t) => value(t) >= cut)
}

const season = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`
const enSeason = (y: number) => `${y}–${String((y + 1) % 100).padStart(2, '0')}`
const plural = (n: number, one: string, many: string) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`
const listYears = (years: number[]) => years.length > 1 ? `${years.slice(0, -1).join(', ')} og ${years[years.length - 1]}` : String(years[0])

// ── league tables ──────────────────────────────────────────────────────

type TableRow = { code: string; name: string; w: number; d: number; l: number; gf: number; ga: number; pts: number }
const recKey = (r: Rec) => `${r.w}-${r.d}-${r.l}-${r.gf}-${r.ga}`

/**
 * The published table held against our own results. Every club's record must
 * equal exactly one of ours, the top ten must be the same clubs by name in
 * both, and ordering those records by points, goal difference and goals scored
 * must give the published order. Clubs level on all three can't be ordered
 * from results alone, so such a tie inside the top ten sends it to review.
 */
function verifyTable(groups: TableRow[][], ours: OurSeason, shown = 10, tiebreak: 'gd' | 'h2h' = 'gd') {
  const all = groups.flat()
  const problems: string[] = []
  if (all.length !== ours.records.size) problems.push(`${all.length} lið í töflu, ${ours.records.size} í úrslitum`)
  const byKey = new Map<string, string[]>()
  for (const [name, r] of ours.records) byKey.set(recKey(r), [...(byKey.get(recKey(r)) ?? []), name])
  const top = all.slice(0, shown).map((row) => ({ row, club: clubOf(row.name) }))
  const dbName = new Map<TableRow, string>()
  all.forEach((row, i) => {
    const hits = byKey.get(recKey(row)) ?? []
    if (hits.length !== 1) problems.push(`${row.name} ${recKey(row)} finnst ${hits.length} sinnum í úrslitum`)
    else if (i < shown && clubOf(hits[0]).id !== top[i].club.id) problems.push(`${row.name} ${recKey(row)} er ${hits[0]} í úrslitum`)
    else dbName.set(row, hits[0])
  })
  const gd = (r: TableRow) => r.gf - r.ga
  let offset = 0
  for (const group of groups) {
    if (tiebreak === 'gd') {
      const sorted = [...group].sort((a, b) => b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf)
      sorted.forEach((row, i) => {
        if (offset + i >= shown) return
        if (row !== group[i]) problems.push(`${offset + i + 1}. sæti er ${group[i].name} í töflu en ${row.name} eftir stigum`)
        const next = sorted[i + 1]
        if (next && next.pts === row.pts && gd(next) === gd(row) && next.gf === row.gf) problems.push(`${row.name} og ${next.name} eru jöfn á öllu`)
      })
    } else {
      // Spain and Italy separate clubs level on points by their games with each other first
      group.forEach((row, i) => {
        const below = group[i + 1]
        if (offset + i >= shown || !below || row.pts > below.pts) return
        if (row.pts < below.pts) { problems.push(`${row.name} er ofar en ${below.name} með færri stig`); return }
        const level = group.filter((r) => r.pts === row.pts)
        if (level.length > 2) { problems.push(`${level.map((r) => r.name).join(', ')} eru jöfn að stigum`); return }
        const a = dbName.get(row), b = dbName.get(below)
        if (!a || !b) return
        const h = headToHead(ours.games, a, b)
        const decided = [h.pts, h.gd, gd(row) - gd(below), row.gf - below.gf].find((x) => x !== 0)
        if (decided === undefined) problems.push(`${row.name} og ${below.name} eru jöfn á öllu`)
        else if (decided < 0) problems.push(`${row.name} er ofar en ${below.name} en tapar innbyrðis eða á markatölu`)
      })
    }
    offset += group.length
  }
  mustAgree(problems, 'tafla og úrslit ósammála')
  return top
}

const tableAnswers = (top: { row: TableRow; club: Entity }[]) =>
  top.map(({ row, club }, i) => answerFor('club', club, `${i + 1}. sæti, ${plural(row.pts, 'stig', 'stig')}`))

const LEAGUES = {
  premier: { page: 'Premier League', teams: 20, region: 'enska', competition: 'ENSKA ÚRVALSDEILDIN', of: 'ensku úrvalsdeildarinnar', id: 'enska', tiebreak: 'gd' },
  laliga: { page: 'La Liga', teams: 20, region: 'evropa', competition: 'LA LIGA', of: 'spænsku deildarinnar', id: 'spann', tiebreak: 'h2h' },
  seriea: { page: 'Serie A', teams: 20, region: 'evropa', competition: 'SERIE A', of: 'ítölsku deildarinnar', id: 'italia', tiebreak: 'h2h' },
  bundesliga: { page: 'Bundesliga', teams: 18, region: 'evropa', competition: 'BUNDESLIGA', of: 'þýsku deildarinnar', id: 'thyskaland', tiebreak: 'gd' },
  ligue1: { page: 'Ligue 1', teams: 18, region: 'evropa', competition: 'LIGUE 1', of: 'frönsku deildarinnar', id: 'frakkland', tiebreak: 'gd' },
  championship: { page: 'EFL Championship', teams: 24, region: 'enska', competition: 'ENSKA B-DEILDIN', of: 'ensku B-deildarinnar', id: 'championship', tiebreak: 'gd' },
} as const

async function leagueTable(league: keyof typeof LEAGUES, y: number): Promise<Topp10List> {
  const L = LEAGUES[league]
  const page = await wiki('en', `${enSeason(y)} ${L.page}`)
  let table = page, [first] = W.sportsTables(page.wikitext)
  if (!first) {
    // some seasons keep the table in its own template, "{{2024–25 La Liga table}}"
    const t = page.wikitext.match(/==\s*League table\s*==\s*\{\{\s*([^{}|\n]+? table)\s*\}\}/)
    if (!t) throw new Error('engin Sports table á síðunni')
    table = await wiki('en', `Template:${t[1].trim()}`)
    ;[first] = W.sportsTables(table.wikitext)
    if (!first) throw new Error(`engin Sports table í Template:${t[1].trim()}`)
  }
  const rows: TableRow[] = W.readSportsTable(first)
  // the league's size changes over the years (Ligue 1 went from 20 to 18); the count is checked against our results
  if (rows.length < 16) throw new Error(`${rows.length} lið í töflunni`)
  const top = verifyTable([rows], await ourSeason(league, y, ['main']), 10, L.tiebreak)
  return finish({
    id: `${L.id}-lokastada-${y}`, region: L.region, kind: 'club', competition: L.competition,
    title: `Topp 10 ${season(y)}`,
    question: `Nefndu liðin sem enduðu í tíu efstu sætum ${L.of} ${season(y)}.`,
    context: `Lokastaða tímabilsins ${season(y)}. Tíu lið eru rétt, í hvaða röð sem er.`,
    sources: [table.source, OUR_RESULTS],
  }, tableAnswers(top))
}

async function bestaTable(y: number): Promise<Topp10List> {
  const page = await wiki('en', y >= 2022 ? `${y} Besta deild karla` : `${y} Úrvalsdeild`)
  const tables: TableRow[][] = W.sportsTables(page.wikitext).map(W.readSportsTable)
  let top
  if (tables.length === 3 && tables[1].length === 6 && tables[2].length === 6) {
    // regular season, then the top six and bottom six play on with their totals
    top = verifyTable([tables[1], tables[2]], await ourSeason('besta', y, ['main', 'efri', 'nedri']))
  } else if (y < 2022 && tables.length >= 1 && tables[0].length === 12) {
    top = verifyTable([tables[0]], await ourSeason('besta', y, ['main']))
  } else {
    throw new Error(`óvænt uppsetning: ${tables.map((t) => t.length).join(' + ')} lið`)
  }
  return finish({
    id: `island-lokastada-${y}`, region: 'island', kind: 'club', competition: 'BESTA DEILDIN',
    title: `Topp 10 ${y}`,
    question: `Nefndu liðin sem enduðu í tíu efstu sætum efstu deildar karla ${y}.`,
    context: `Lokastaða tímabilsins ${y}. Tíu lið eru rétt, í hvaða röð sem er.`,
    sources: [page.source, OUR_RESULTS],
  }, tableAnswers(top))
}

/** The clubs playing a season now: the league's page against our own fixture list. */
async function clubsInSeason(o: {
  id: string; league: string; season: number; page: string; teams: number
  region: Topp10List['region']; competition: string; title: string; question: string; context: string
}): Promise<Topp10List> {
  const page = await wiki('en', o.page)
  const [first] = W.sportsTables(page.wikitext)
  if (!first) throw new Error('engin Sports table á síðunni')
  // before a season is played the module generates the order itself, so the clubs are read from their names
  const names = [...first.entries()].filter(([k]) => /^name_/.test(k)).map(([, v]) => W.plain(v))
  const wikiClubs = new Map(names.map((n) => { const c = clubOf(n); return [c.id, c] }))
  const ourClubs = new Map((await ourTeams(o.league, o.season)).map((n) => { const c = clubOf(n); return [c.id, c] }))
  const problems: string[] = []
  if (names.length !== o.teams || wikiClubs.size !== o.teams) problems.push(`${wikiClubs.size} lið á Wikipedia`)
  if (ourClubs.size !== o.teams) problems.push(`${ourClubs.size} lið í leikjaplani`)
  for (const [id, c] of wikiClubs) if (!ourClubs.has(id)) problems.push(`${c.label} aðeins á Wikipedia`)
  for (const [id, c] of ourClubs) if (!wikiClubs.has(id)) problems.push(`${c.label} aðeins í leikjaplani`)
  mustAgree(problems, 'lið tímabilsins')
  const clubs = [...wikiClubs.values()].sort((a, b) => a.label.localeCompare(b.label, 'is'))
  return finish({
    id: o.id, region: o.region, kind: 'club', competition: o.competition,
    title: o.title, question: o.question, context: o.context,
    sources: [page.source, OUR_FIXTURES],
  }, clubs.map((c) => answerFor('club', c, '')))
}

// ── titles by club ─────────────────────────────────────────────────────

type Titles = Map<string, { club: Entity; years: number[] }>

/** A table of winners: club, number of titles, and the years, which must add up. */
function readTitles(rows: string[][], clubCol: number, titlesCol: number, yearsCol: number): Titles {
  const out: Titles = new Map()
  for (const r of rows) {
    const titles = Number(W.plain(r[titlesCol] ?? ''))
    if (!Number.isInteger(titles)) throw new Error(`ólesanleg röð: ${r.map(W.plain).join(' | ')}`)
    if (titles === 0) continue
    const club = clubOf(W.plain(r[clubCol]).replace(/\s*\+$/, ''))
    const years = [...W.plain(r[yearsCol] ?? '').matchAll(/\b(?:18|19|20)\d{2}\b/g)].map((x) => Number(x[0]))
    if (years.length !== titles) throw new Error(`${club.label}: ${titles} titlar en ${years.length} ártöl`)
    if (out.has(club.id)) throw new Error(`${club.label} kemur tvisvar fyrir`)
    out.set(club.id, { club, years: years.sort((a, b) => a - b) })
  }
  return out
}

const lastYear = (t: Titles) => Math.max(...[...t.values()].flatMap((x) => x.years))

/**
 * Both sources, compared up to the last year both cover. A club that won only
 * after that year would be refused as an answer while being right, so its
 * existence sends the question to review rather than being ignored.
 */
function agreedTitles(a0: Titles, b0: Titles, what: string): { titles: Titles; last: number } {
  const last = Math.min(lastYear(a0), lastYear(b0))
  const trim = (t: Titles): Titles => new Map([...t]
    .map(([id, x]) => [id, { ...x, years: x.years.filter((y) => y <= last) }] as const)
    .filter(([, x]) => x.years.length))
  const a = trim(a0), b = trim(b0)
  const problems: string[] = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id)
    if (!x || !y) { problems.push(`${(x ?? y)!.club.label} aðeins í annarri`); continue }
    if (x.years.join() !== y.years.join()) problems.push(`${x.club.label}: ${x.years.join(' ')} og ${y.years.join(' ')}`)
  }
  for (const t of [...a0.values(), ...b0.values()]) {
    if (!a.has(t.club.id)) problems.push(`${t.club.label} vann eftir ${last}, sem aðeins önnur heimildin nær til`)
  }
  mustAgree(problems, what)
  return { titles: a, last }
}

// ── Iceland ────────────────────────────────────────────────────────────

async function islandTitles(): Promise<Topp10List> {
  const en = await wiki('en', 'Besta deild karla'), is = await wiki('is', 'Besta deild karla')
  const read = (rows: string[][], nameCol: number, titlesCol: number, lastCol: number) => {
    const m = new Map<string, { club: Entity; titles: number; last: number }>()
    for (const r of rows) {
      const club = clubOf(W.plain(r[nameCol]))
      const titles = Number(W.plain(r[titlesCol])), last = Number(W.plain(r[lastCol]))
      if (!Number.isInteger(titles) || !Number.isInteger(last)) throw new Error(`ólesanleg röð: ${r.map(W.plain).join(' | ')}`)
      if (m.has(club.id)) throw new Error(`${club.label} kemur tvisvar fyrir`)
      m.set(club.id, { club, titles, last })
    }
    return m
  }
  const a = read(W.dataRows(W.tableAfter(en.wikitext, '== Champions by number of titles ==')), 0, 1, 3)
  const b = read(W.dataRows(W.tableAfter(is.wikitext, '=== Sigursælustu félögin')), 1, 2, 4)
  const problems: string[] = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id)
    if (!x || !y) { problems.push(`${(x ?? y)!.club.label} aðeins í annarri`); continue }
    if (x.titles !== y.titles) problems.push(`${x.club.label}: ${x.titles} og ${y.titles} titlar`)
    if (x.last !== y.last) problems.push(`${x.club.label}: síðast ${x.last} og ${y.last}`)
  }
  mustAgree(problems, 'Íslandsmeistaratitlar')
  const clubs = [...a.values()].sort((x, y) => y.titles - x.titles)
  const last = Math.max(...clubs.map((c) => c.last))
  return finish({
    id: 'island-meistarar', region: 'island', kind: 'club', competition: 'ÍSLANDSMÓTIÐ',
    title: 'Íslandsmeistarar',
    question: 'Nefndu 10 félög sem hafa orðið Íslandsmeistarar karla í fótbolta.',
    context: `Til og með tímabilinu ${last}.`,
    sources: [en.source, is.source],
  }, clubs.map((c) => answerFor('club', c.club, `${plural(c.titles, 'titill', 'titlar')}, síðast ${c.last}`)))
}

async function islandCup(): Promise<Topp10List> {
  const en = await wiki('en', "Icelandic Men's Football Cup"), is = await wiki('is', 'Bikarkeppni karla í knattspyrnu')
  const { titles, last } = agreedTitles(
    readTitles(W.dataRows(W.tableAfter(en.wikitext, '==Performance by club==')), 0, 1, 2),
    readTitles(W.dataRows(W.tableAfter(is.wikitext, '=== Sigrar í úrslitaleikjum')), 0, 1, 2),
    'bikarmeistarar',
  )
  const clubs = [...titles.values()].sort((x, y) => y.years.length - x.years.length)
  return finish({
    id: 'island-bikarmeistarar', region: 'island', kind: 'club', competition: 'BIKARKEPPNIN',
    title: 'Bikarmeistarar',
    question: 'Nefndu 10 félög sem hafa orðið bikarmeistarar karla í fótbolta.',
    context: `Til og með bikarúrslitunum ${last}.`,
    sources: [en.source, is.source],
  }, clubs.map((c) => answerFor('club', c.club, `${plural(c.years.length, 'titill', 'titlar')}, síðast ${c.years[c.years.length - 1]}`)))
}

async function bestaScorers(from: number, to: number): Promise<Topp10List> {
  const en = await wiki('en', 'Besta deild karla'), is = await wiki('is', 'Besta deild karla')
  const read = (rows: string[][]) => {
    type Season = { people: Map<string, Entity>; goals: number }
    const byYear = new Map<number, Season>()
    for (const r of rows) {
      const year = Number(W.plain(r[0]))
      if (!(year >= from && year <= to)) continue
      const goals = Number(W.plain(r[2]))
      const entry: Season = byYear.get(year) ?? { people: new Map(), goals }
      if (!Number.isInteger(goals) || entry.goals !== goals) throw new Error(`${year}: ólesanleg markatala`)
      for (const name of W.plainList(r[1])) { const p = personOf(name); entry.people.set(p.id, p) }
      byYear.set(year, entry)
    }
    return byYear
  }
  const a = read(W.dataRows(W.tableAfter(en.wikitext, '=== Top scorers ===')))
  const b = read(W.dataRows(W.tableAfter(is.wikitext, '=== Markahæstu leikmenn ===')))
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const problems: string[] = []
  for (const y of years) {
    const x = a.get(y), z = b.get(y)
    if (!x || !z) { problems.push(`${y} vantar`); continue }
    if (x.goals !== z.goals) problems.push(`${y}: ${x.goals} og ${z.goals} mörk`)
    const ids = (e: typeof x) => [...e.people.keys()].sort().join(',')
    if (ids(x) !== ids(z)) problems.push(`${y}: ${ids(x)} og ${ids(z)}`)
  }
  mustAgree(problems, 'markakóngar')
  const won = new Map<string, { person: Entity; years: number[] }>()
  for (const y of years) {
    for (const p of a.get(y)!.people.values()) {
      const w = won.get(p.id) ?? { person: p, years: [] }
      w.years.push(y); won.set(p.id, w)
    }
  }
  return finish({
    id: 'island-markakongar', region: 'island', kind: 'player', competition: 'BESTA DEILDIN',
    title: 'Markakóngar',
    question: `Nefndu 10 leikmenn sem urðu markakóngar efstu deildar karla ${from}-${to}.`,
    context: `Tímabilin ${from}-${to}. Þegar tveir urðu jafnir gilda báðir.`,
    sources: [en.source, is.source],
  }, [...won.values()].map((w) => answerFor('player', w.person, `Markakóngur ${listYears(w.years)}`)))
}

// ── England ────────────────────────────────────────────────────────────

async function premierScorers(y: number): Promise<Topp10List> {
  const tag = `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  const page = await wiki('en', `${enSeason(y)} Premier League`)
  const rows: string[][] = W.dataRows(W.tableAfter(page.wikitext, /===\s*Top scorers\s*===/)).map((r: string[]) => r.map(W.plain))
  const listed: { person: Entity; club: string; goals: number }[] = rows.map((r) => {
    const goals = Number(r[3])
    if (r.length < 4 || !Number.isInteger(goals)) throw new Error(`ólesanleg röð: ${r.join(' | ')}`)
    return { person: personOf(r[1]), club: r[2], goals }
  })
  const top = topWithTies(listed, (x) => x.goals)
  const cut = top[top.length - 1].goals
  const fpl = await fplGoals(tag)
  const problems: string[] = []
  const fplById = new Map<string, number>()
  for (const r of fpl.rows) {
    let id: string | null = null
    try { id = personOf(r.name).id } catch {
      if (r.goals >= cut) problems.push(`${r.name} (${r.goals}) í FPL er ekki í names.ts`)
    }
    if (!id) continue
    if (fplById.has(id)) problems.push(`${r.name} tvisvar í FPL`)
    fplById.set(id, r.goals)
  }
  const topIds = new Set(top.map((t) => t.person.id))
  for (const item of top) {
    const g = fplById.get(item.person.id)
    if (g !== item.goals) problems.push(`${item.person.label}: ${item.goals} á Wikipedia, ${g ?? 'vantar'} í FPL`)
  }
  for (const [id, g] of fplById) if (g >= cut && !topIds.has(id)) problems.push(`${id}: ${g} mörk í FPL en ekki á lista Wikipedia`)
  mustAgree(problems, 'markahæstu')
  return finish({
    id: `enska-markahaestir-${y}`, region: 'enska', kind: 'player', competition: 'ENSKA ÚRVALSDEILDIN',
    title: `Markahæstir ${season(y)}`,
    question: `Nefndu 10 markahæstu leikmenn ensku úrvalsdeildarinnar ${season(y)}.`,
    context: top.length > 10
      ? `Mörk í deildinni ${season(y)}. Allir sem voru jafnir í 10. sæti gilda.`
      : `Mörk í deildinni ${season(y)}.`,
    sources: [page.source, fpl.source],
  }, top.map((item) => answerFor('player', item.person, `${plural(item.goals, 'mark', 'mörk')}, ${item.club}`)))
}

// ── Europe ─────────────────────────────────────────────────────────────

let championsMemo: Promise<{ titles: Titles; last: number; sources: Source[] }> | null = null
function champions() {
  return championsMemo ??= (async () => {
    const en = await wiki('en', 'Template:UEFA Champions League performance by club')
    const is = await wiki('is', 'Meistaradeild Evrópu')
    const { titles, last } = agreedTitles(
      readTitles(W.dataRows(W.tableAfter(en.wikitext, '{|')), 0, 1, 3),
      readTitles(W.dataRows(W.tableAfter(is.wikitext, '=== Sigurliðin')), 1, 2, 3),
      'Evrópumeistarar',
    )
    return { titles, last, sources: [en.source, is.source] }
  })()
}

/** The Champions League was named for the 1992/93 season, whose final was in 1993. */
const NEW_ERA = 1993

function championsQuestion(o: { id: string; title: string; question: string; years: (years: number[]) => number[]; detail: (years: number[]) => string }) {
  return async (): Promise<Topp10List> => {
    const { titles, last, sources } = await champions()
    const clubs = [...titles.values()]
      .map((t) => ({ club: t.club, years: o.years(t.years) }))
      .filter((t) => t.years.length)
      .sort((a, b) => b.years.length - a.years.length)
    return finish({
      id: o.id, region: 'evropa', kind: 'club', competition: 'MEISTARADEILDIN',
      title: o.title, question: o.question,
      context: `Miðað við lok tímabilsins ${season(last - 1)}.`,
      sources,
    }, clubs.map((t) => answerFor('club', t.club, o.detail(t.years))))
  }
}

/** UEFA Cup and Europa League winners on is.wikipedia, by the year of the final. */
function isUefaCupWinners(wt: string): Map<number, string> {
  const start = wt.indexOf('=== UEFA Cup ==='), end = wt.indexOf('== Neðanmálsgreinar')
  if (start < 0 || end < 0) throw new Error('fann ekki úrslitaleikina á íslensku síðunni')
  const out = new Map<number, string>()
  const rows = /^\|\s*(\d{4})\s*[-–]\s*\d{2,4}(?:&nbsp;|\s)*\|\|([^\n]*?)\|\|([^\n]*)$/gm
  for (const m of wt.slice(start, end).matchAll(rows)) {
    const year = Number(m[1]) + 1
    const link = (x: RegExpMatchArray) => W.plain(`[[${x[1]}]]`)
    // the page marks the winner in italics or bold, on either side
    const marked = [...m[2].matchAll(/'{2,3}\s*\[\[([^\]]+)\]\]/g)].map(link)
    if (marked.length === 1) { out.set(year, marked[0]); continue }
    const teams = [...m[2].matchAll(/\[\[([^\]]+)\]\]/g)].map(link)
    if (marked.length || teams.length !== 2) continue
    // unmarked: the note after the score may name the winner, "Ajax vann með fleiri mörkum…"
    const escaped = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const said = teams.filter((t) => new RegExp(`(^|[\\s(,.])${escaped(t)}\\s+vann\\b`).test(m[3]))
    if (said.length === 1) { out.set(year, said[0]); continue }
    // or it is a one-match final decided in normal or extra time, read from its score
    const score = m[3].match(/^\s*(\d+)\s*-\s*(\d+)/)
    if (score && score[1] !== score[2] && !/víta/i.test(m[3])) {
      out.set(year, teams[Number(score[1]) > Number(score[2]) ? 0 : 1])
    }
  }
  return out
}

async function uefaCup(): Promise<Topp10List> {
  const en = await wiki('en', 'Template:UEFA Europa League performance by club')
  const is = await wiki('is', 'Evrópudeild UEFA')
  const byYear = isUefaCupWinners(is.wikitext)
  const first = Math.min(...byYear.keys()), lastIs = Math.max(...byYear.keys())
  const missing = Array.from({ length: lastIs - first + 1 }, (_, i) => first + i).filter((y) => !byYear.has(y))
  if (first !== 1972 || missing.length) throw new Error(`íslenska síðan: sigurvegara vantar ${first !== 1972 ? `frá ${first}` : missing.join(', ')}`)
  const b: Titles = new Map()
  for (const [year, name] of [...byYear].sort((x, y) => x[0] - y[0])) {
    const club = clubOf(name)
    const t = b.get(club.id) ?? { club, years: [] }
    t.years.push(year); b.set(club.id, t)
  }
  const { titles, last } = agreedTitles(readTitles(W.dataRows(W.tableAfter(en.wikitext, '{|')), 0, 1, 3), b, 'UEFA-bikarinn')
  const clubs = [...titles.values()].sort((x, y) => y.years.length - x.years.length)
  return finish({
    id: 'evropa-evropudeildin', region: 'evropa', kind: 'club', competition: 'EVRÓPUDEILDIN',
    title: 'UEFA-bikarinn og Evrópudeildin',
    question: 'Nefndu 10 félög sem hafa unnið UEFA-bikarinn eða Evrópudeildina.',
    context: `Frá 1971/72, miðað við lok tímabilsins ${season(last - 1)}.`,
    sources: [en.source, is.source],
  }, clubs.map((c) => answerFor('club', c.club, `${plural(c.years.length, 'titill', 'titlar')}, síðast ${c.years[c.years.length - 1]}`)))
}

async function uclScorers(): Promise<Topp10List> {
  const en = await wiki('en', 'List of UEFA Champions League top scorers')
  const is = await wiki('is', 'Meistaradeild Evrópu')
  const read = (rows: string[][], nameCol: number, goalsCol: number) =>
    rows.map((r) => ({ name: W.plain(r[nameCol] ?? ''), goals: Number(W.plain(r[goalsCol] ?? '')) }))
      .filter((x) => x.name && Number.isInteger(x.goals))
  const a = topWithTies(read(W.dataRows(W.tableAfter(en.wikitext, 'All-time top scorers')), 1, 2), (x) => x.goals)
  const b = topWithTies(read(W.dataRows(W.tableAfter(is.wikitext, 'Markahæstu menn')), 1, 2), (x) => x.goals)
  const goals = (list: typeof a) => new Map(list.map((item) => [personOf(item.name).id, item.goals]))
  const x = goals(a), z = goals(b)
  const problems: string[] = []
  for (const id of new Set([...x.keys(), ...z.keys()])) {
    if (x.get(id) !== z.get(id)) problems.push(`${id}: ${x.get(id) ?? '-'} á ensku, ${z.get(id) ?? '-'} á íslensku`)
  }
  mustAgree(problems, 'markahæstu í Meistaradeildinni')
  return finish({
    id: 'evropa-markahaestir', region: 'evropa', kind: 'player', competition: 'MEISTARADEILDIN',
    title: 'Markahæstir frá upphafi',
    question: 'Nefndu 10 markahæstu leikmenn Evrópukeppni meistaraliða og Meistaradeildarinnar.',
    context: 'Mörk í aðalkeppninni frá upphafi.',
    sources: [en.source, is.source],
  }, a.map((item) => answerFor('player', personOf(item.name), plural(item.goals, 'mark', 'mörk'))))
}

// ── Iceland's internationals ───────────────────────────────────────────

/** A name as Wikipedia links it, without the disambiguation it needs for a title. */
const unqualified = (name: string) => name.replace(/\s*\((?:footballer|fæddur|born)[^)]*\)\s*$/i, '').trim()

/**
 * Transfermarkt's record internationals for Iceland: a count of its own, kept
 * by people who do not edit Wikipedia, which is what makes it worth asking.
 */
async function tmRecordPlayers(): Promise<{ rows: { name: string; caps: number; goals: number }[]; source: Source }> {
  const url = 'https://www.transfermarkt.com/island/rekordnationalspieler/verein/3574'
  const html = await fetchCached('tm-island-rekordnationalspieler.html', url)
  const rows = html.split(/<tr class="(?:odd|even)">/).slice(1).flatMap((chunk) => {
    const name = chunk.match(/\/profil\/spieler\/\d+"[^>]*>([^<]+)</)?.[1]
    const numbers = [...chunk.matchAll(/nationalmannschaft\/spieler\/\d+">([^<]+)</g)].map((m) => Number(m[1]))
    return name && Number.isInteger(numbers[0]) && Number.isInteger(numbers[1])
      ? [{ name: name.trim(), caps: numbers[0], goals: numbers[1] }] : []
  })
  if (rows.length < 20) throw new Error(`Transfermarkt: aðeins ${rows.length} leikmenn lásust`)
  return { rows, source: { name: 'Transfermarkt · Ísland, flestir landsleikir', url } }
}

async function icelandCaps(): Promise<Topp10List> {
  const en = await wiki('en', 'Iceland national football team')
  const tm = await tmRecordPlayers()
  // two players level on caps share one rank cell, so the row is read from its
  // first cell holding a name rather than by a fixed column
  const wiki10: { person: Entity; caps: number; goals: number }[] = W.dataRows(W.tableAfter(en.wikitext, '===Most appearances===')).flatMap((r: string[]) => {
    const cells: string[] = r.map((c) => W.plain(c))
    const at = cells.findIndex((c) => /[A-Za-zÁÉÍÓÚÝÞÆÖáéíóúýþæöðÐ]{3}/.test(c))
    if (at < 0) return []
    return [{ person: personOf(unqualified(cells[at])), caps: Number(cells[at + 1]), goals: Number(cells[at + 2]) }]
  })
  if (wiki10.length < 10) throw new Error(`Wikipedia: aðeins ${wiki10.length} leikmenn`)
  // only the players the question needs are looked up, so the rest of
  // Transfermarkt's twenty-five need no entry in names.ts
  const byTm = new Map(tm.rows.map((r) => [normalise(r.name), r]))
  const tmFor = (e: Entity) => [e.label, ...e.names, ...(e.extra ?? [])].map(normalise).map((k) => byTm.get(k)).find(Boolean)
  const problems: string[] = []
  for (const w of wiki10) {
    if (!Number.isInteger(w.caps)) { problems.push(`${w.person.label}: ólesanleg leikjatala`); continue }
    const t = tmFor(w.person)
    if (!t) problems.push(`${w.person.label} er ekki hjá Transfermarkt`)
    else if (t.caps !== w.caps) problems.push(`${w.person.label}: ${w.caps} og ${t.caps} leikir`)
  }
  // and the other way, so a player one source has forgotten cannot slip through
  for (const t of topWithTies(tm.rows, (r: { caps: number }) => r.caps)) {
    if (!wiki10.some((w) => tmFor(w.person) === t)) problems.push(`${t.name} vantar hjá Wikipedia`)
  }
  mustAgree(problems, 'flestir landsleikir')
  return finish({
    id: 'island-landsleikir', region: 'island', kind: 'player', competition: 'A-LANDSLIÐ KARLA',
    title: 'Flestir landsleikir',
    question: 'Nefndu 10 leikmenn með flesta A-landsleiki fyrir Ísland.',
    context: `Staðan þegar heimildirnar voru lesnar. Efstu tíu, og allir jafnir þeim tíunda.`,
    sources: [en.source, tm.source],
  }, wiki10.map((w) => answerFor('player', w.person, `${w.caps} landsleikir, ${plural(w.goals, 'mark', 'mörk')}`)))
}

// ── Ballon d'Or ────────────────────────────────────────────────────────

async function ballonDor(from: number, to: number): Promise<Topp10List> {
  const en = await wiki('en', "Ballon d'Or"), is = await wiki('is', 'Gullknötturinn')
  // the English table gives the first three of every year, the Icelandic one the winner alone
  const read = (table: string, nameAt: number, winner: (cells: string[]) => boolean) => {
    const won = new Map<string, { person: Entity; years: number[] }>()
    for (const row of W.dataRows(table) as string[][]) {
      const r: string[] = row.map((c) => W.plain(c))
      const year = Number(r[0]?.match(/^\d{4}$/)?.[0])
      if (!(year >= from && year <= to) || !winner(r)) continue
      // is.wikipedia writes "Marco van Basten (3)" for a third win
      const name = unqualified((r[nameAt] ?? '').replace(/\s*\(\d+\)\s*$/, ''))
      if (!name) throw new Error(`${year}: ekkert nafn`)
      const person = personOf(name)
      const w = won.get(person.id) ?? { person, years: [] }
      w.years.push(year); won.set(person.id, w)
    }
    return won
  }
  // the first table under the heading is the legend that explains "(X)"
  const a = read(W.tableAfter(en.wikitext, 'Denotes the number of times'), 2, (r) => r[1] === '1st')
  const b = read(W.tableAfter(is.wikitext, '== Verðlaunahafar =='), 1, () => true)
  const problems: string[] = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id)
    if (!x || !y) { problems.push(`${(x ?? y)!.person.label} er aðeins í annarri heimildinni`); continue }
    if (x.years.join(',') !== y.years.join(',')) problems.push(`${x.person.label}: ${x.years.join('/')} og ${y.years.join('/')}`)
  }
  mustAgree(problems, 'Gullknötturinn')
  return finish({
    id: 'evropa-gullknotturinn', region: 'evropa', kind: 'player', competition: 'GULLKNÖTTURINN',
    title: 'Gullknötturinn',
    question: `Nefndu 10 leikmenn sem unnu Gullknöttinn ${from}-${to}.`,
    context: `Verðlaunaárin ${from}-${to}. Íslenska Wikipedia rekur verðlaunin til 2009, svo spurningin nær ekki lengra.`,
    sources: [en.source, is.source],
  }, [...a.values()].map((w) => answerFor('player', w.person,
    w.years.length > 1 ? `Gullknötturinn ${listYears(w.years)}` : `Gullknötturinn ${w.years[0]}`)))
}

// ── run ────────────────────────────────────────────────────────────────

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const BUILDERS: [string, () => Promise<Topp10List>][] = [
  ['island-meistarar', islandTitles],
  ['island-bikarmeistarar', islandCup],
  ['island-markakongar', () => bestaScorers(2016, 2025)],
  ['island-landsleikir', icelandCaps],
  ...range(2016, 2025).map((y) => [`island-lokastada-${y}`, () => bestaTable(y)] as [string, () => Promise<Topp10List>]),
  ['island-lid-2026', () => clubsInSeason({
    id: 'island-lid-2026', league: 'besta', season: 2026, page: '2026 Besta deild karla', teams: 12,
    region: 'island', competition: 'BESTA DEILDIN', title: 'Liðin 2026',
    question: 'Nefndu 10 af 12 liðum Bestu deildar karla 2026.', context: 'Tímabilið 2026.',
  })],

  ['enska-lokastada-2009', () => leagueTable('premier', 2009)],
  ...range(2010, 2025).map((y) => [`enska-lokastada-${y}`, () => leagueTable('premier', y)] as [string, () => Promise<Topp10List>]),
  ...[2024, 2025].map((y) => [`championship-lokastada-${y}`, () => leagueTable('championship', y)] as [string, () => Promise<Topp10List>]),
  ['island-lid-2025', () => clubsInSeason({
    id: 'island-lid-2025', league: 'besta', season: 2025, page: '2025 Besta deild karla', teams: 12,
    region: 'island', competition: 'BESTA DEILDIN', title: 'Liðin 2025',
    question: 'Nefndu 10 af 12 liðum Bestu deildar karla 2025.', context: 'Tímabilið 2025.',
  })],
  ['enska-lid-2025', () => clubsInSeason({
    id: 'enska-lid-2025', league: 'premier', season: 2025, page: '2025–26 Premier League', teams: 20,
    region: 'enska', competition: 'ENSKA ÚRVALSDEILDIN', title: 'Liðin 2025/26',
    question: 'Nefndu 10 af 20 liðum ensku úrvalsdeildarinnar 2025/26.', context: 'Tímabilið 2025/26.',
  })],
  ...range(2016, 2025).map((y) => [`enska-markahaestir-${y}`, () => premierScorers(y)] as [string, () => Promise<Topp10List>]),
  ['enska-lid-2026', () => clubsInSeason({
    id: 'enska-lid-2026', league: 'premier', season: 2026, page: '2026–27 Premier League', teams: 20,
    region: 'enska', competition: 'ENSKA ÚRVALSDEILDIN', title: 'Liðin 2026/27',
    question: 'Nefndu 10 af 20 liðum ensku úrvalsdeildarinnar 2026/27.', context: 'Tímabilið 2026/27.',
  })],

  ['evropa-meistarar', championsQuestion({
    id: 'evropa-meistarar', title: 'Evrópumeistarar',
    question: 'Nefndu 10 félög sem hafa unnið Evrópukeppni meistaraliða eða Meistaradeildina.',
    years: (y) => y, detail: (y) => `${plural(y.length, 'titill', 'titlar')}, síðast ${y[y.length - 1]}`,
  })],
  ['evropa-meistaradeildin', championsQuestion({
    id: 'evropa-meistaradeildin', title: 'Nýtt nafn. Sömu draumar.',
    question: 'Nefndu 10 félög sem hafa unnið Meistaradeildina frá og með tímabilinu 1992/93.',
    years: (y) => y.filter((x) => x >= NEW_ERA), detail: (y) => `${plural(y.length, 'titill', 'titlar')} frá 1993`,
  })],
  ['evropa-baedi-timabil', championsQuestion({
    id: 'evropa-baedi-timabil', title: 'Meistarar tveggja tímabila',
    question: 'Nefndu 10 félög sem hafa unnið bæði Evrópukeppni meistaraliða fyrir 1992/93 og Meistaradeildina frá 1992/93.',
    years: (y) => y.some((x) => x < NEW_ERA) && y.some((x) => x >= NEW_ERA) ? y : [],
    detail: (y) => `${plural(y.filter((x) => x < NEW_ERA).length, 'titill', 'titlar')} fyrir og ${y.filter((x) => x >= NEW_ERA).length} eftir`,
  })],
  ['evropa-evropudeildin', uefaCup],
  ['evropa-markahaestir', uclScorers],
  ['evropa-gullknotturinn', () => ballonDor(1990, 2009)],
  ...(['laliga', 'seriea', 'bundesliga', 'ligue1'] as const).flatMap((league) => [2022, 2023, 2024, 2025].map((y) =>
    [`${LEAGUES[league].id}-lokastada-${y}`, () => leagueTable(league, y)] as [string, () => Promise<Topp10List>])),
]

mkdirSync(LISTS_DIR, { recursive: true })
const known = new Set(BUILDERS.map(([id]) => id))
for (const f of readdirSync(LISTS_DIR)) {
  if (f.endsWith('.json') && !known.has(f.slice(0, -5))) rmSync(join(LISTS_DIR, f))
}

const shipped: string[] = []
const review: { id: string; reason: string }[] = []
for (const [id, build] of BUILDERS) {
  const file = join(LISTS_DIR, `${id}.json`)
  try {
    const list = await build()
    if (list.id !== id) throw new Error(`spurningin heitir ${list.id}`)
    writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
    shipped.push(id)
    console.log(`✓ ${id} - ${list.answers.length} gild svör`)
  } catch (err) {
    const reason = (err as Error).message
    if (err instanceof FetchError) {
      review.push({ id, reason: `ekki hægt að sækja, síðasta staðfesta útgáfa stendur: ${reason}` })
    } else {
      review.push({ id, reason })
      if (existsSync(file)) rmSync(file)
    }
    console.log(`✗ ${id} - ${reason}`)
  }
}

const files = readdirSync(LISTS_DIR).filter((f) => f.endsWith('.json')).sort()
const ident = (f: string) => f.slice(0, -5).replace(/[^a-z0-9]+/gi, '_')
writeFileSync(join(LISTS_DIR, 'index.ts'), [
  '// Written by scripts/topp10/build.mts: only questions whose two sources agreed.',
  "import type { Topp10List } from '../types'",
  ...files.map((f) => `import ${ident(f)} from './${f}'`),
  '',
  `export const LISTS = [${files.map(ident).join(', ')}] as Topp10List[]`,
  '',
].join('\n'))
writeFileSync(REVIEW_FILE, JSON.stringify({ builtAt: today, shipped, review }, null, 2) + '\n')
console.log(`\n${shipped.length} spurningar staðfestar, ${review.length} til yfirferðar → ${REVIEW_FILE}`)
