/**
 * Builds the Topp 10 lists. Each list is read from two sources that do not
 * copy each other, and is written only when they agree on every answer.
 *
 * A list whose sources disagree, or that meets a name with no entry in
 * names.ts, is not written: it goes to review.json with the reason, and any
 * earlier copy is removed so an unverified list cannot stay on the site. A
 * source that cannot be fetched leaves the last verified copy where it is.
 *
 * Usage: cd web && npx tsx scripts/topp10/build.mts [--cache DIR]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { Answer, Topp10List } from '../../src/lib/topp10/types'
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

/** Could not read a source at all; says nothing about whether a list is right. */
class FetchError extends Error {}

// ── sources ────────────────────────────────────────────────────────────

const UA = 'BestaSpain-Topp10/1.0 (https://islensk-fotbolti.vercel.app; checks quiz answers)'
let lastFetch = 0

async function fetchCached(key: string, url: string): Promise<string> {
  const file = join(cacheDir, key.replace(/[^\w.-]+/g, '_'))
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  const wait = lastFetch + 1000 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastFetch = Date.now()
  let res: Response
  try { res = await fetch(url, { headers: { 'User-Agent': UA } }) }
  catch (err) { throw new FetchError(`${url}: ${(err as Error).message}`) }
  if (!res.ok) throw new FetchError(`${url} svaraði ${res.status}`)
  const text = await res.text()
  writeFileSync(file, text)
  return text
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
    source: { name: `${lang}.wikipedia.org · ${String(json.parse.title).replace(/[\u2013\u2014]/g, '-')}`, url: `https://${lang}.wikipedia.org/w/index.php?oldid=${json.parse.revid}` },
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
  const lines = (await fetchCached(`fpl-${tag}.csv`, url)).trim().split('\n')
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

interface Rec { w: number; d: number; l: number; gf: number; ga: number }
let teamNames: Map<number, string> | null = null

/** Each club's record over the season, from the results we hold. */
async function ourRecords(league: string, season: number, phases: string[]): Promise<Map<string, Rec>> {
  if (!teamNames) {
    const { data, error } = await db().from('teams').select('id,name').range(0, 9999)
    if (error) throw new FetchError(error.message)
    teamNames = new Map((data ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))
  }
  const rows: { home_team: number; away_team: number; home_goals: number; away_goals: number }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('matches').select('home_team,away_team,home_goals,away_goals')
      .eq('league', league).eq('season', season).eq('status', 'played').in('phase', phases)
      .order('id').range(from, from + 999)
    if (error) throw new FetchError(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const out = new Map<string, Rec>()
  for (const m of rows) {
    for (const [team, gf, ga] of [[m.home_team, m.home_goals, m.away_goals], [m.away_team, m.away_goals, m.home_goals]]) {
      const name = teamNames.get(team) ?? `#${team}`
      const r = out.get(name) ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0 }
      if (gf > ga) r.w++; else if (gf === ga) r.d++; else r.l++
      r.gf += gf; r.ga += ga
      out.set(name, r)
    }
  }
  return out
}

// ── names ──────────────────────────────────────────────────────────────

function registry(entries: Entity[], kind: string) {
  const byName = new Map<string, Entity>()
  for (const e of entries) {
    for (const n of [e.label, ...e.names]) {
      const key = normalise(n), prev = byName.get(key)
      if (prev && prev.id !== e.id) throw new Error(`names.ts: "${n}" er bæði ${prev.id} og ${e.id}`)
      byName.set(key, e)
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
 * name with surname, are accepted only if no other answer on the list would
 * also claim them - `finish` drops the ones that collide.
 */
function draft(entities: Entity[], person: boolean, rank: number, detail: string, more: Partial<Answer> = {}): Draft {
  const fixed = new Set<string>(), loose = new Set<string>()
  for (const e of entities) {
    for (const n of [e.label, ...e.names, ...(e.extra ?? [])]) fixed.add(normalise(n))
    const words = e.label.split(/\s+/)
    if (person && words.length >= 2) loose.add(normalise(words[words.length - 1]))
    if (person && words.length >= 3) loose.add(normalise(`${words[0]} ${words[words.length - 1]}`))
  }
  for (const k of fixed) loose.delete(k)
  return { rank, label: entities.map((e) => e.label).join(' / '), detail, accept: [...fixed], ...more, loose: [...loose] }
}

function finish(meta: Omit<Topp10List, 'answers' | 'verifiedAt'>, drafts: Draft[]): Topp10List {
  const owners = new Map<string, Set<string>>()
  for (const d of drafts) for (const k of [...d.accept, ...d.loose]) owners.set(k, (owners.get(k) ?? new Set()).add(d.label))
  const answers: Answer[] = drafts.map(({ loose, ...a }) => ({
    ...a, accept: [...a.accept, ...loose.filter((k) => owners.get(k)!.size === 1)],
  }))
  const { note, ...rest } = meta
  const list: Topp10List = { ...rest, answers, verifiedAt: today, ...(note ? { note } : {}) }
  const clash = ambiguousAliases(list)
  if (clash.length) throw new Error(`sama stafsetning opnar tvö ólík svör: ${clash.join(', ')}`)
  if (answers.length < 10) throw new Error(`aðeins ${answers.length} svör`)
  if (new Set(list.sources.map((s) => new URL(s.url).host + new URL(s.url).pathname)).size < 2) throw new Error('færri en tvær heimildir')
  return list
}

function mustAgree(problems: string[], what: string) {
  if (!problems.length) return
  const shown = problems.slice(0, 8).join('; ')
  throw new Error(`${what}: ${shown}${problems.length > 8 ? ` (og ${problems.length - 8} til viðbótar)` : ''}`)
}

/** The first ten, and anyone level with the tenth. */
function topWithTies<T>(items: T[], value: (t: T) => number, n = 10): { item: T; rank: number }[] {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  if (sorted.length < n) throw new Error(`aðeins ${sorted.length} í heimild`)
  const cut = value(sorted[n - 1])
  return sorted.filter((t) => value(t) >= cut)
    .map((item) => ({ item, rank: 1 + sorted.filter((o) => value(o) > value(item)).length }))
}

const tiesNote = (count: number) => (count > 10 ? 'Þau sem eru jöfn í síðasta sæti eru öll á listanum.' : undefined)
const season = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`
const plural = (n: number, one: string, many: string) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`

// ── league tables ──────────────────────────────────────────────────────

type TableRow = { code: string; name: string; w: number; d: number; l: number; gf: number; ga: number; pts: number }
const recKey = (r: Rec) => `${r.w}-${r.d}-${r.l}-${r.gf}-${r.ga}`

/**
 * The published table held against our own results. Every club's record must
 * equal one of ours exactly and belong to the same club, and ordering those
 * records by points, goal difference and goals scored must give the published
 * order. Clubs level on all three can't be ordered from results alone, so such
 * a tie inside the ten shown sends the list to review instead.
 */
function verifyTable(groups: TableRow[][], ours: Map<string, Rec>, shown = 10) {
  const all = groups.flat()
  const problems: string[] = []
  if (all.length !== ours.size) problems.push(`${all.length} lið í töflu, ${ours.size} í úrslitum`)
  const byKey = new Map<string, string[]>()
  for (const [name, r] of ours) byKey.set(recKey(r), [...(byKey.get(recKey(r)) ?? []), name])
  const clubs = all.map((row) => {
    const club = clubOf(row.name)
    const hits = byKey.get(recKey(row)) ?? []
    if (hits.length !== 1) problems.push(`${row.name} ${recKey(row)} finnst ${hits.length} sinnum í úrslitum`)
    else if (clubOf(hits[0]).id !== club.id) problems.push(`${row.name} ${recKey(row)} er ${hits[0]} í úrslitum`)
    return { row, club }
  })
  let offset = 0
  for (const group of groups) {
    const gd = (r: TableRow) => r.gf - r.ga
    const sorted = [...group].sort((a, b) => b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf)
    sorted.forEach((row, i) => {
      if (offset + i >= shown) return
      if (row !== group[i]) problems.push(`${offset + i + 1}. sæti er ${group[i].name} í töflu en ${row.name} eftir stigum`)
      const next = sorted[i + 1]
      if (next && next.pts === row.pts && gd(next) === gd(row) && next.gf === row.gf) problems.push(`${row.name} og ${next.name} eru jöfn á öllu`)
    })
    offset += group.length
  }
  mustAgree(problems, 'tafla og úrslit ósammála')
  return clubs.slice(0, shown)
}

const tableDrafts = (rows: { row: TableRow; club: Entity }[]) =>
  rows.map(({ row, club }, i) => draft([club], false, i + 1, plural(row.pts, 'stig', 'stig'), { slot: `${i + 1}.` }))

async function premierTable(y: number): Promise<Topp10List> {
  const page = await wiki('en', `${y}–${String((y + 1) % 100).padStart(2, '0')} Premier League`)
  const [first] = W.sportsTables(page.wikitext)
  if (!first) throw new Error('engin Sports table á síðunni')
  const rows: TableRow[] = W.readSportsTable(first)
  if (rows.length !== 20) throw new Error(`${rows.length} lið í fyrstu töflu síðunnar`)
  const top = verifyTable([rows], await ourRecords('premier', y, ['main']))
  return finish({
    id: `enska-lokastada-${y}`, region: 'enska',
    title: `Lokastaðan ${season(y)}`,
    question: `Hvaða lið enduðu í tíu efstu sætum ensku úrvalsdeildarinnar ${season(y)}?`,
    sources: [page.source, OUR_RESULTS],
  }, tableDrafts(top))
}

async function bestaTable(y: number): Promise<Topp10List> {
  const page = await wiki('en', `${y} Besta deild karla`)
  const tables: TableRow[][] = W.sportsTables(page.wikitext).map(W.readSportsTable)
  // regular season, then the top six and bottom six play on with their totals
  if (tables.length !== 3 || tables[1].length !== 6 || tables[2].length !== 6) {
    throw new Error(`óvænt uppsetning: ${tables.map((t) => t.length).join(' + ')} lið`)
  }
  const top = verifyTable([tables[1], tables[2]], await ourRecords('besta', y, ['main', 'efri', 'nedri']))
  return finish({
    id: `island-lokastada-${y}`, region: 'island',
    title: `Lokastaða Bestu deildar ${y}`,
    question: `Hvaða lið enduðu í tíu efstu sætum Bestu deildar karla ${y}?`,
    sources: [page.source, OUR_RESULTS],
  }, tableDrafts(top))
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
  const top = topWithTies([...a.values()], (x) => x.titles)
  return finish({
    id: 'island-titlar', region: 'island',
    title: 'Íslandsmeistaratitlar',
    question: 'Hvaða félög hafa oftast orðið Íslandsmeistarar karla í fótbolta?',
    sources: [en.source, is.source],
    note: tiesNote(top.length),
  }, top.map(({ item, rank }) => draft([item.club], false, rank, plural(item.titles, 'titill', 'titlar'), { hint: `Síðast meistari ${item.last}` })))
}

async function bestaScorers(from: number, to: number): Promise<Topp10List> {
  const en = await wiki('en', 'Besta deild karla'), is = await wiki('is', 'Besta deild karla')
  const read = (rows: string[][]) => {
    type Season = { people: Map<string, Entity>; goals: number; clubs: string[] }
    const byYear = new Map<number, Season>()
    for (const r of rows) {
      const year = Number(W.plain(r[0]))
      if (!(year >= from && year <= to)) continue
      const goals = Number(W.plain(r[2]))
      const entry: Season = byYear.get(year) ?? { people: new Map(), goals, clubs: [] }
      if (!Number.isInteger(goals) || entry.goals !== goals) throw new Error(`${year}: ólesanleg markatala`)
      for (const name of W.plainList(r[1])) { const p = personOf(name); entry.people.set(p.id, p) }
      for (const c of W.plainList(r[3] ?? '')) if (!entry.clubs.includes(c)) entry.clubs.push(c)
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
  const shared = years.some((y) => a.get(y)!.people.size > 1)
  return finish({
    id: 'island-markakongar', region: 'island',
    title: `Markakóngar ${from}-${to}`,
    question: `Hver skoraði flest mörk í efstu deild karla hvert tímabil ${from}-${to}?`,
    sources: [en.source, is.source],
    note: shared ? 'Þegar tveir urðu jafnir opnar hvor þeirra sem er árið.' : undefined,
  }, years.map((y, i) => {
    const e = a.get(y)!
    return draft([...e.people.values()], true, i + 1, plural(e.goals, 'mark', 'mörk'), { slot: String(y), hint: b.get(y)!.clubs.join(' / ') })
  }))
}

// ── England ────────────────────────────────────────────────────────────

async function premierScorers(y: number): Promise<Topp10List> {
  const tag = `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  const page = await wiki('en', `${y}–${String((y + 1) % 100).padStart(2, '0')} Premier League`)
  const rows: string[][] = W.dataRows(W.tableAfter(page.wikitext, /===\s*Top scorers\s*===/)).map((r: string[]) => r.map(W.plain))
  const listed: { person: Entity; club: string; goals: number }[] = rows.map((r) => {
    const goals = Number(r[3])
    if (r.length < 4 || !Number.isInteger(goals)) throw new Error(`ólesanleg röð: ${r.join(' | ')}`)
    return { person: personOf(r[1]), club: r[2], goals }
  })
  const top = topWithTies(listed, (x) => x.goals)
  const cut = top[top.length - 1].item.goals
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
  const topIds = new Set(top.map((t) => t.item.person.id))
  for (const { item } of top) {
    const g = fplById.get(item.person.id)
    if (g !== item.goals) problems.push(`${item.person.label}: ${item.goals} á Wikipedia, ${g ?? 'vantar'} í FPL`)
  }
  for (const [id, g] of fplById) if (g >= cut && !topIds.has(id)) problems.push(`${id}: ${g} mörk í FPL en ekki á lista Wikipedia`)
  mustAgree(problems, 'markahæstu')
  return finish({
    id: `enska-markahaestir-${y}`, region: 'enska',
    title: `Markahæstir ${season(y)}`,
    question: `Hverjir skoruðu flest mörk í ensku úrvalsdeildinni ${season(y)}?`,
    sources: [page.source, fpl.source],
    note: tiesNote(top.length),
  }, top.map(({ item, rank }) => draft([item.person], true, rank, plural(item.goals, 'mark', 'mörk'), { hint: item.club })))
}

// ── Europe ─────────────────────────────────────────────────────────────

async function europeTitles(): Promise<Topp10List> {
  const en = await wiki('en', 'Template:UEFA Champions League performance by club')
  const is = await wiki('is', 'Meistaradeild Evrópu')
  const read = (rows: string[][], clubCol: number, titlesCol: number, yearsCol: number) => {
    const m = new Map<string, { club: Entity; titles: number; years: number[] }>()
    for (const r of rows) {
      const titles = Number(W.plain(r[titlesCol] ?? ''))
      if (!Number.isInteger(titles)) throw new Error(`ólesanleg röð: ${r.map(W.plain).join(' | ')}`)
      if (titles === 0) continue
      const club = clubOf(W.plain(r[clubCol]))
      const years = [...W.plain(r[yearsCol] ?? '').matchAll(/\b(?:19|20)\d{2}\b/g)].map((x) => Number(x[0]))
      if (years.length !== titles) throw new Error(`${club.label}: ${titles} titlar en ${years.length} ártöl`)
      if (m.has(club.id)) throw new Error(`${club.label} kemur tvisvar fyrir`)
      m.set(club.id, { club, titles, years })
    }
    return m
  }
  const a = read(W.dataRows(W.tableAfter(en.wikitext, '{|')), 0, 1, 3)
  const b = read(W.dataRows(W.tableAfter(is.wikitext, '=== Sigurliðin')), 1, 2, 3)
  const problems: string[] = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id)
    if (!x || !y) { problems.push(`${(x ?? y)!.club.label} aðeins í annarri`); continue }
    if (x.years.join() !== y.years.join()) problems.push(`${x.club.label}: ${x.years.join(' ')} og ${y.years.join(' ')}`)
  }
  mustAgree(problems, 'Evróputitlar')
  const top = topWithTies([...a.values()], (x) => x.titles)
  return finish({
    id: 'evropa-titlar', region: 'evropa',
    title: 'Flestir Evrópumeistaratitlar',
    question: 'Hvaða félög hafa oftast unnið Evrópukeppni meistaraliða og Meistaradeild Evrópu?',
    sources: [en.source, is.source],
    note: tiesNote(top.length),
  }, top.map(({ item, rank }) => draft([item.club], false, rank, plural(item.titles, 'titill', 'titlar'), { hint: `Síðast ${Math.max(...item.years)}` })))
}

/** Winner of each final on an English "List of … finals" page, by the year it was played. */
function enFinals(wt: string): Map<number, string> {
  const start = wt.indexOf('==List of finals=='), end = wt.indexOf('==Performances==')
  if (start < 0 || end < 0) throw new Error('fann ekki lista yfir úrslitaleiki')
  const out = new Map<number, string>()
  for (const block of wt.slice(start, end).split(/\n\|-/)) {
    const lines = block.split('\n')
    const from = lines.findIndex((l) => /^\s*!\s*scope\s*=\s*"row"/.test(l))
    if (from < 0) continue
    const to = lines.findIndex((l, i) => i > from && /^\s*(\|\}|\{\|)/.test(l))
    const rows = W.dataRows(`{|\n${lines.slice(from, to < 0 ? undefined : to).join('\n')}\n|}`)
    if (rows.length !== 1) continue
    const s = W.plain(rows[0][0]).match(/^(\d{4})\s*[–-]\s*(\d{2}|\d{4})$/)
    const winner = W.plain(rows[0][2] ?? '')
    if (s && winner) out.set(Number(s[1]) + 1, winner)
  }
  return out
}

async function winnersByYear(opts: {
  id: string; competition: string; question: (range: string) => string
  en: Page; is: Page; isWinners: Map<number, string>
}): Promise<Topp10List> {
  const a = enFinals(opts.en.wikitext), b = opts.isWinners
  const common = [...a.keys()].filter((y) => b.has(y)).sort((x, y) => x - y)
  const years = common.slice(-10)
  if (years.length < 10 || years[9] - years[0] !== 9) throw new Error(`heimildir eiga ekki tíu samfelld ár sameiginleg (${years.join(', ')})`)
  // the range is what both sources cover, and the title says which years it is
  const problems: string[] = []
  const clubs = years.map((y) => {
    const x = clubOf(a.get(y)!), z = clubOf(b.get(y)!)
    if (x.id !== z.id) problems.push(`${y}: ${x.label} og ${z.label}`)
    if (!x.country) problems.push(`${x.label} vantar land í names.ts`)
    return x
  })
  mustAgree(problems, `sigurvegarar ${opts.competition}`)
  const range = `${years[0]}-${years[9]}`
  return finish({
    id: opts.id, region: 'evropa',
    title: `Sigurvegarar ${opts.competition} ${range}`,
    question: opts.question(range),
    sources: [opts.en.source, opts.is.source],
    note: 'Sama félagið getur opnað fleiri en eitt ár.',
  }, years.map((y, i) => draft([clubs[i]], false, i + 1, `Úrslitaleikurinn ${y}`, { slot: String(y), hint: `Félag frá ${clubs[i].country}` })))
}

async function uclWinners(): Promise<Topp10List> {
  const en = await wiki('en', 'List of European Cup and UEFA Champions League finals')
  const is = await wiki('is', 'Meistaradeild Evrópu')
  const byYear = new Map<number, string>()
  for (const r of W.dataRows(W.tableAfter(is.wikitext, '=== Sigurliðin'))) {
    for (const x of W.plain(r[3] ?? '').matchAll(/\b(?:19|20)\d{2}\b/g)) {
      const y = Number(x[0])
      if (byYear.has(y)) throw new Error(`${y} á tvö félög í íslensku heimildinni`)
      byYear.set(y, W.plain(r[1]))
    }
  }
  return winnersByYear({
    id: 'evropa-meistaradeild', competition: 'Meistaradeildarinnar', en, is, isWinners: byYear,
    question: (range) => `Hvaða félag vann Meistaradeild Evrópu hvert ár ${range}?`,
  })
}

async function uelWinners(): Promise<Topp10List> {
  const en = await wiki('en', 'List of UEFA Cup and Europa League finals')
  const is = await wiki('is', 'Evrópudeild UEFA')
  const byYear = new Map<number, string>()
  // "| 2020-21 || [[Manchester United]] - '''[[Villareal CF]]''' || 1-1 …": the winner is the
  // team in bold, on either side; a final with neither in bold is left out
  for (const m of is.wikitext.matchAll(/^\|\s*(\d{4})\s*[-–]\s*\d{2,4}\s*\|\|([^\n]*?)\|\|/gm)) {
    const bold = [...m[2].matchAll(/'''(.+?)'''/g)]
    if (bold.length === 1) byYear.set(Number(m[1]) + 1, W.plain(bold[0][1]))
  }
  return winnersByYear({
    id: 'evropa-evropudeild', competition: 'Evrópudeildarinnar', en, is, isWinners: byYear,
    question: (range) => `Hvaða félag vann UEFA-bikarinn / Evrópudeildina hvert ár ${range}?`,
  })
}

async function uclScorers(): Promise<Topp10List> {
  const en = await wiki('en', 'List of UEFA Champions League top scorers')
  const is = await wiki('is', 'Meistaradeild Evrópu')
  const read = (rows: string[][], nameCol: number, goalsCol: number) =>
    rows.map((r) => ({ name: W.plain(r[nameCol] ?? ''), goals: Number(W.plain(r[goalsCol] ?? '')) }))
      .filter((x) => x.name && Number.isInteger(x.goals))
  const a = topWithTies(read(W.dataRows(W.tableAfter(en.wikitext, 'All-time top scorers')), 1, 2), (x) => x.goals)
  const b = topWithTies(read(W.dataRows(W.tableAfter(is.wikitext, 'Markahæstu menn')), 1, 2), (x) => x.goals)
  const goals = (list: typeof a) => new Map(list.map(({ item }) => [personOf(item.name).id, item.goals]))
  const x = goals(a), z = goals(b)
  const problems: string[] = []
  for (const id of new Set([...x.keys(), ...z.keys()])) {
    if (x.get(id) !== z.get(id)) problems.push(`${id}: ${x.get(id) ?? '–'} á ensku, ${z.get(id) ?? '–'} á íslensku`)
  }
  mustAgree(problems, 'markahæstu í Meistaradeildinni')
  return finish({
    id: 'evropa-markahaestir', region: 'evropa',
    title: 'Markahæstir í Meistaradeildinni',
    question: 'Hverjir hafa skorað flest mörk í Evrópukeppni meistaraliða og Meistaradeildinni?',
    sources: [en.source, is.source],
    note: tiesNote(a.length),
  }, a.map(({ item, rank }) => draft([personOf(item.name)], true, rank, plural(item.goals, 'mark', 'mörk'))))
}

// ── run ────────────────────────────────────────────────────────────────

const BUILDERS: [string, () => Promise<Topp10List>][] = [
  ['island-titlar', islandTitles],
  ['island-markakongar', () => bestaScorers(2016, 2025)],
  ['island-lokastada-2024', () => bestaTable(2024)],
  ['island-lokastada-2025', () => bestaTable(2025)],
  ['enska-lokastada-2009', () => premierTable(2009)],
  ['enska-lokastada-2023', () => premierTable(2023)],
  ['enska-lokastada-2024', () => premierTable(2024)],
  ['enska-lokastada-2025', () => premierTable(2025)],
  ['enska-markahaestir-2023', () => premierScorers(2023)],
  ['enska-markahaestir-2024', () => premierScorers(2024)],
  ['enska-markahaestir-2025', () => premierScorers(2025)],
  ['evropa-titlar', europeTitles],
  ['evropa-meistaradeild', uclWinners],
  ['evropa-evropudeild', uelWinners],
  ['evropa-markahaestir', uclScorers],
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
    if (list.id !== id) throw new Error(`listinn heitir ${list.id}`)
    writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
    shipped.push(id)
    console.log(`✓ ${id} - ${list.answers.length} svör`)
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
  '// Written by scripts/topp10/build.mts: only lists whose two sources agreed.',
  "import type { Topp10List } from '../types'",
  ...files.map((f) => `import ${ident(f)} from './${f}'`),
  '',
  `export const LISTS = [${files.map(ident).join(', ')}] as Topp10List[]`,
  '',
].join('\n'))
writeFileSync(REVIEW_FILE, JSON.stringify({ builtAt: today, shipped, review }, null, 2) + '\n')
console.log(`\n${shipped.length} listar staðfestir, ${review.length} til yfirferðar → ${REVIEW_FILE}`)
