/**
 * Builds the question bank for Leiðin á Laugardalsvöll.
 *
 * Every question holds every valid answer and what each is worth. The worth is
 * decided by a rule, never by feel: answers are ranked by how often people
 * would think of them (titles, goals, seasons, recency) and the rank sets the
 * points, so the most obvious answer gives 10 and the forgotten ones 100. Only
 * the few national-team questions, where no number measures fame, carry points
 * set by hand, and say so.
 *
 * The data comes from lists that already passed Tenaball's two-source rule,
 * from our own database, and from KSÍ match pages (fetch-events.mts), which are
 * checked match by match against the final score.
 *
 * Usage: cd web && npx tsx scripts/leidin/build.mts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { normalise } from '../../src/lib/topp10/normalise'
import { IS_NAMES } from '../../src/lib/nations'
import { CLUBS, PEOPLE, type Entity } from '../topp10/names'
import type { Kind, LeidAnswer, LeidQuestion, Slot, Tier } from '../../src/lib/leidin/types'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const TODAY = new Date().toISOString().slice(0, 10)
const SITE = 'https://islensk-fotbolti.vercel.app'
const KSI = { name: 'ksi.is · leikskýrslur', url: 'https://www.ksi.is/leikir-og-urslit/felagslid/' }
/** 2025: the twelve top scorers and every hat-trick here agree with our count, goal for goal (checked 6 Oct 2026) */
const WIKI_2025 = { name: 'en.wikipedia.org · 2025 Besta deild karla (markahæstir, þrennur)', url: 'https://en.wikipedia.org/wiki/2025_Besta_deild_karla' }

// ---------------------------------------------------------------- points

/**
 * Points from a "how common" number: higher means more people think of it.
 * Each answer sits at its mid-rank (ties share one), so a big group of
 * one-goal scorers lands together at the rare end instead of being split.
 */
function tiersBy<T>(items: T[], common: (x: T) => number): Map<T, Tier> {
  const n = items.length
  const out = new Map<T, Tier>()
  for (const item of items) {
    const v = common(item)
    const above = items.filter((x) => common(x) > v).length
    const equal = items.filter((x) => common(x) === v).length
    const p = (above + equal / 2) / n
    // the most common answer is always the obvious one, however short the list
    out.set(item, above === 0 || p < 0.1 ? 10 : p < 0.25 ? 25 : p < 0.5 ? 50 : p < 0.75 ? 75 : 100)
  }
  return out
}

// ---------------------------------------------------------------- names

const PATRONYMIC = /(son|sson|dottir)$/

const entityKeys = (e: Entity) => [e.label, ...e.names, ...(e.extra ?? [])].map(normalise)

const EXTRA_CLUBS: Entity[] = [
  { id: 'ibh', label: 'ÍBH', names: ['ÍB Hafnarfjarðar'], extra: ['Íþróttabandalag Hafnarfjarðar'] },
  { id: 'ibi', label: 'ÍBÍ', names: ['ÍB Ísafjarðar'], extra: ['Íþróttabandalag Ísafjarðar'] },
  { id: 'ir', label: 'ÍR', names: [], extra: ['Íþróttafélag Reykjavíkur'] },
  { id: 'vidir', label: 'Víðir', names: ['Víðir Garði'], extra: [] },
  { id: 'leiftur', label: 'Leiftur', names: ['Leiftur Ólafsfirði'], extra: [] },
  { id: 'volsungur', label: 'Völsungur', names: [], extra: ['Volsungur Husavik'] },
  { id: 'skallagrimur', label: 'Skallagrímur', names: [], extra: [] },
  { id: 'selfoss', label: 'Selfoss', names: [], extra: [] },
  { id: 'haukar', label: 'Haukar', names: [], extra: [] },
  { id: 'aegir', label: 'Ægir', names: [], extra: [] },
  { id: 'njardvik', label: 'Njarðvík', names: [], extra: [] },
]
const ALL_CLUBS = [...CLUBS, ...EXTRA_CLUBS.filter((x) => !CLUBS.some((c) => c.id === x.id))]

/** The club an Icelandic team name in our database or a list belongs to. */
function clubOf(name: string): Entity {
  const key = normalise(name)
  const hits = ALL_CLUBS.filter((c) => entityKeys(c).includes(key))
  if (hits.length !== 1) throw new Error(`club "${name}": ${hits.length} matches`)
  return hits[0]
}

/**
 * Spellings of a person's name that count. The full name, and any run of the
 * name that keeps the first name and at least one more ("Vicente Valor",
 * "Guðmundur Andri", "Guðmundur Tryggvason"). A surname alone only when it is
 * not a patronymic: "Pedersen" is a person, "Sigurðsson" is half the squad.
 */
function personKeys(full: string): string[] {
  const tokens = normalise(full).split(' ').filter(Boolean)
  const keys = new Set([tokens.join(' ')])
  // initials and particles ("Þ.", "Mc") are kept in the full name only
  const [first, ...rest] = tokens
  const words = rest.filter((w) => w.length > 2)
  for (let mask = 1; mask < 1 << words.length; mask++) {
    keys.add([first, ...words.filter((_, i) => mask & (1 << i))].join(' '))
  }
  const last = tokens[tokens.length - 1]
  if (tokens.length > 1 && !PATRONYMIC.test(last) && last.length >= 4) keys.add(last)
  // spellings Tenaball already knows for the same person
  for (const e of PEOPLE) {
    const ek = entityKeys(e)
    if (ek.some((k) => keys.has(k) && k.includes(' '))) ek.forEach((k) => keys.add(k))
  }
  return [...keys]
}

/** Full names of every person anywhere in the game, to stop one person's short form opening another. */
const everyone = new Map<string, string>()
const meet = (label: string) => everyone.set(normalise(label), label)
/** spellings a source or this file gives on purpose; the check below leaves them alone */
const trusted = new Set<string>()
const trust = (label: string, keys: string[]) => { for (const k of keys) trusted.add(`${normalise(label)}|${k}`); return keys }

// ---------------------------------------------------------------- data

async function all<T>(table: string, select: string, filter: (q: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db().from(table).select(select)).range(from, from + 999)
    if (error) throw error
    rows.push(...(data as T[]))
    if (!data || data.length < 1000) return rows
  }
}

const list = (id: string) => JSON.parse(readFileSync(join(webDir, 'src/lib/topp10/lists', `${id}.json`), 'utf-8'))

interface Ev { type: string; minute: number; playerKsiId: number | null; playerName: string; side: 'home' | 'away' }
interface Match { id: number; phase: string; home: string; away: string; score: [number, number]; events: Ev[]; warnings: string[] }

/**
 * Goals KSÍ's timeline leaves out, each read off another match report. A
 * season with a match whose events and score disagree is refused unless the
 * gap is filled here.
 */
const CORRECTIONS: Record<number, { ev: Ev; source: string }[]> = {
  669943: [{
    ev: { type: 'goal', minute: 55, playerKsiId: null, playerName: 'Aron Jóhannsson', side: 'away' },
    source: 'https://fotbolti.net/leikur/7298/skyrsluna',
  }],
}

function season(year: number, league = 'besta'): Match[] {
  const file = join(here, 'cache', league === 'besta' ? `events-${year}.json` : `events-${league}-${year}.json`)
  if (!existsSync(file)) throw new Error(`no events for ${league} ${year}: run fetch-events.mts --league=${league} ${year}`)
  const matches: Match[] = JSON.parse(readFileSync(file, 'utf-8'))
  for (const m of matches) {
    const fix = CORRECTIONS[m.id]
    if (fix) {
      // the same player elsewhere in the season gives the KSÍ id, so the goal
      // joins his tally instead of making a second player of the same name
      const club = (x: Match, e: Ev) => (e.side === 'home' ? x.home : x.away)
      const idOf = (e: Ev) => matches.flatMap((x) => x.events.filter((o) => club(x, o) === club(m, e)))
        .find((o) => o.playerName === e.playerName && o.playerKsiId)?.playerKsiId ?? null
      m.events.push(...fix.map((f) => ({ ...f.ev, playerKsiId: f.ev.playerKsiId ?? idOf(f.ev) })))
      const goals = (side: 'home' | 'away') => m.events.filter((e) =>
        ((e.type === 'goal' || e.type === 'penalty') && e.side === side) || (e.type === 'owngoal' && e.side !== side)).length
      if (goals('home') === m.score[0] && goals('away') === m.score[1]) m.warnings = []
    }
    if (m.warnings.length) throw new Error(`${year} match ${m.id} ${m.home}-${m.away}: ${m.warnings.join('; ')}`)
  }
  markOwnGoals(matches)
  return matches
}

/**
 * KSÍ draws an own goal exactly like a goal, on the side it counted for, and
 * names the player who put it in. The player's own side gives it away: first
 * from his substitutions and cards in the same match, otherwise from the club
 * he turned out for all season. An own goal is turned to his side and marked.
 */
function markOwnGoals(matches: Match[]) {
  const clubOf = (m: Match, side: 'home' | 'away') => (side === 'home' ? m.home : m.away)
  const seasonClubs = new Map<number, Map<string, number>>()
  for (const m of matches) for (const e of m.events) if (e.type !== 'goal' && e.playerKsiId) {
    const c = seasonClubs.get(e.playerKsiId) ?? new Map()
    c.set(clubOf(m, e.side), (c.get(clubOf(m, e.side)) ?? 0) + 1)
    seasonClubs.set(e.playerKsiId, c)
  }
  for (const m of matches) {
    const sideIn = new Map<number, 'home' | 'away'>()
    for (const e of m.events) if (e.type !== 'goal' && e.playerKsiId) sideIn.set(e.playerKsiId, e.side)
    for (const e of m.events) {
      if (e.type !== 'goal' || !e.playerKsiId) continue
      const other = e.side === 'home' ? 'away' : 'home'
      const here = sideIn.get(e.playerKsiId)
      const clubs = seasonClubs.get(e.playerKsiId)
      const own = here ? here === other : !!clubs && !clubs.has(clubOf(m, e.side)) && clubs.has(clubOf(m, other))
      if (own) { e.type = 'owngoal'; e.side = other }
    }
  }
}

interface Scorer { key: string; name: string; club: string; goals: number; early: number; braces: number; late: number; owngoals: number; reds: number; hattricks: number; efri: number }

/** Every player who did anything a question asks about in a season, by KSÍ id. */
function players(matches: Match[]): Map<string, Scorer> {
  const out = new Map<string, Scorer>()
  const names = new Map<string, Map<string, number>>()
  const get = (e: Ev, club: string) => {
    const key = e.playerKsiId ? `ksi-${e.playerKsiId}` : `nafn-${normalise(e.playerName).replace(/ /g, '-')}`
    const spell = names.get(key) ?? new Map()
    spell.set(e.playerName, (spell.get(e.playerName) ?? 0) + 1)
    names.set(key, spell)
    if (!out.has(key)) out.set(key, { key, name: e.playerName, club, goals: 0, early: 0, braces: 0, late: 0, owngoals: 0, reds: 0, hattricks: 0, efri: 0 })
    return out.get(key)!
  }
  for (const m of matches) {
    const perMatch = new Map<string, number>()
    for (const e of m.events) {
      const club = e.side === 'home' ? m.home : m.away
      const p = get(e, club)
      if (e.type === 'goal' || e.type === 'penalty') {
        p.goals++
        p.club = club
        if (e.minute <= 5) p.early++
        if (e.minute >= 90) p.late++
        if (m.phase === 'efri') p.efri++
        perMatch.set(p.key, (perMatch.get(p.key) ?? 0) + 1)
      } else if (e.type === 'owngoal') p.owngoals++
      else if (e.type === 'red') p.reds++
    }
    for (const [key, n] of perMatch) {
      if (n >= 2) out.get(key)!.braces++
      if (n >= 3) out.get(key)!.hattricks++
    }
  }
  // a name KSÍ spells two ways is shown the way it spells it most
  for (const [key, spell] of names) out.get(key)!.name = [...spell.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return out
}

// ---------------------------------------------------------------- questions

const questions: LeidQuestion[] = []

function add(q: Omit<LeidQuestion, 'answers' | 'verifiedAt'> & { answers: Omit<LeidAnswer, 'accept'>[] }, accept: (a: Omit<LeidAnswer, 'accept'>) => string[]) {
  const answers: LeidAnswer[] = q.answers.map((a) => ({ ...a, accept: [...new Set(accept(a).filter(Boolean))] }))
  // a spelling two answers share would make a guess ambiguous: neither keeps it
  const owner = new Map<string, number>()
  for (const a of answers) for (const k of a.accept) owner.set(k, (owner.get(k) ?? 0) + 1)
  for (const a of answers) a.accept = a.accept.filter((k) => owner.get(k) === 1)
  for (const a of answers) if (!a.accept.length) throw new Error(`${q.id}: ${a.label} has no spelling left`)
  if (answers.length < 3) throw new Error(`${q.id}: only ${answers.length} answers`)
  answers.sort((a, b) => a.points - b.points || a.label.localeCompare(b.label, 'is'))
  questions.push({ ...q, answers, verifiedAt: TODAY })
}

const clubAccept = (a: { id: string }) => entityKeys(ALL_CLUBS.find((c) => c.id === a.id)!)
const personAccept = (a: { label: string }) => personKeys(a.label)

/** A question over clubs, worth decided by a number (titles, seasons). */
function clubQuestion(id: string, slot: Slot, prompt: string, context: string, rarity: string,
  rows: { club: string; common: number; detail: string }[], sources: LeidQuestion['sources']) {
  const t = tiersBy(rows, (r) => r.common)
  add({ id, slot, kind: 'club', prompt, context, rarity, sources,
    answers: rows.map((r) => { const c = clubOf(r.club); return { id: c.id, label: c.label, detail: r.detail, points: t.get(r)! } }) },
  clubAccept)
}

/** A question over players, worth decided by a number (usually goals). */
function playerQuestion(id: string, slot: Slot, prompt: string, context: string, rarity: string,
  rows: { key: string; name: string; common: number; detail: string }[], sources: LeidQuestion['sources']) {
  // two players of one name (Aron Jóhannsson of Valur and of Afturelding) are
  // one answer: the name is right either way, and it is worth the commoner
  const merged = new Map<string, { key: string; name: string; common: number; detail: string }>()
  for (const r of rows) {
    const k = normalise(r.name), seen = merged.get(k)
    merged.set(k, seen ? { ...seen, common: Math.max(seen.common, r.common), detail: `${seen.detail}; annar með sama nafni: ${r.detail}` } : r)
  }
  rows = [...merged.values()]
  const t = tiersBy(rows, (r) => r.common)
  for (const r of rows) meet(r.name)
  add({ id, slot, kind: 'player', prompt, context, rarity, sources,
    answers: rows.map((r) => ({ id: r.key, label: r.name, detail: r.detail, points: t.get(r)! })) },
  personAccept)
}

const titles = (n: number) => `${n} ${n === 1 ? 'titill' : 'titlar'}`
const goals = (n: number) => `${n} ${n === 1 ? 'mark' : 'mörk'}`
const ofList = (l: any) => l.sources as LeidQuestion['sources']

// -- félög ---------------------------------------------------------------

{
  const l = list('island-meistarar')
  clubQuestion('meistarar', 'felog', 'Nefndu félag sem hefur orðið Íslandsmeistari karla.', l.context,
    'Því fleiri titlar, því algengara svar.',
    l.answers.map((a: any) => ({ club: a.label, common: Number(a.detail.match(/^\d+/)[0]), detail: a.detail })), ofList(l))
}
{
  const l = list('island-bikarmeistarar')
  clubQuestion('bikarmeistarar', 'felog', 'Nefndu félag sem hefur orðið bikarmeistari karla.', l.context,
    'Því fleiri bikarar, því algengara svar.',
    l.answers.map((a: any) => ({ club: a.label, common: Number(a.detail.match(/^\d+/)[0]), detail: a.detail })), ofList(l))
}

const teams = await all<{ id: number; name: string }>('teams', 'id, name', (q) => q)
const teamName = new Map(teams.map((t) => [t.id, t.name]))

// seasons in the top flight: the tables to 1984, our matches from 1985
const topSeasons = new Map<string, Set<number>>()
{
  const standings = await all<{ season: number; team_id: number }>('season_standings', 'season, team_id', (q) => q)
  for (const s of standings) {
    const n = teamName.get(s.team_id)!
    topSeasons.set(n, (topSeasons.get(n) ?? new Set()).add(s.season))
  }
  const modern = await all<{ season: number; home_team: number; away_team: number }>('matches', 'season, home_team, away_team',
    (q) => q.eq('league', 'besta'))
  for (const m of modern) for (const id of [m.home_team, m.away_team]) {
    const n = teamName.get(id)!
    topSeasons.set(n, (topSeasons.get(n) ?? new Set()).add(m.season))
  }
}
const seasonsOf = (club: string) => topSeasons.get(club)?.size ?? 0
const seasonWord = (n: number) => `${n} ${n === 1 ? 'tímabil' : 'tímabil'} í efstu deild`

clubQuestion('efsta-deild', 'felog', 'Nefndu félag sem hefur spilað í efstu deild karla.',
  'Frá fyrsta Íslandsmótinu 1912 til og með 2026.', 'Því fleiri tímabil í efstu deild, því algengara svar.',
  [...topSeasons.keys()].map((club) => ({ club, common: seasonsOf(club), detail: seasonWord(seasonsOf(club)) })),
  [{ name: 'Lokastöður 1912-1984 og öll úrslit frá 1985 í gagnagrunni Bestu spárinnar', url: `${SITE}/saga` },
   { name: 'is.wikipedia.org · Besta deild karla (félög frá upphafi)', url: 'https://is.wikipedia.org/wiki/Besta_deild_karla' }])

{
  const l = list('island-lid-2026')
  clubQuestion('besta-2026', 'felog', 'Nefndu lið í Bestu deild karla 2026.', 'Liðin tólf á tímabilinu 2026.',
    'Því fleiri tímabil sem félagið hefur átt í efstu deild, því algengara svar.',
    l.answers.map((a: any) => { const db = [...topSeasons.keys()].find((k) => clubOf(k).id === a.id)!; return { club: a.label, common: seasonsOf(db), detail: seasonWord(seasonsOf(db)) } }),
    ofList(l))
}
{
  const rows = await all<{ home_team: number; away_team: number }>('matches', 'home_team, away_team',
    (q) => q.eq('league', 'lengjudeild').eq('season', 2026).eq('phase', 'main'))
  const clubs = [...new Set(rows.flatMap((m) => [teamName.get(m.home_team)!, teamName.get(m.away_team)!]))]
  if (clubs.length !== 12) throw new Error(`lengjudeild 2026 has ${clubs.length} clubs`)
  clubQuestion('lengjudeild-2026', 'felog', 'Nefndu lið í Lengjudeild karla 2026.', 'Liðin tólf í næstefstu deild 2026.',
    'Félög sem hafa oft spilað í efstu deild eru algeng svör, hin sjaldgæf.',
    clubs.map((club) => ({ club, common: seasonsOf(club), detail: seasonsOf(club) ? seasonWord(seasonsOf(club)) : 'aldrei í efstu deild' })),
    [{ name: 'KSÍ · leikjaplan Lengjudeildarinnar 2026 í gagnagrunni Bestu spárinnar', url: `${SITE}/tafla` }])
}

const champions = await all<{ season: number; team_id: number }>('champions', 'season, team_id', (q) => q)
const champYears = new Map<string, number[]>()
for (const c of champions) {
  const id = clubOf(teamName.get(c.team_id)!).id
  champYears.set(id, [...(champYears.get(id) ?? []), c.season].sort((a, b) => a - b))
}
{
  // the verified list may already hold a title the database has not got yet
  const l = list('island-meistarar')
  for (const a of l.answers) {
    const [, n, last] = a.detail.match(/^(\d+) (?:titill|titlar), síðast (\d{4})/)
    const years = champYears.get(a.id) ?? []
    if (!years.includes(Number(last)) && years.length === Number(n) - 1) years.push(Number(last))
    if (years.length !== Number(n)) throw new Error(`${a.label}: database ${years.length} titles, list ${n}`)
    champYears.set(a.id, years)
  }
}
{
  const since = [...champYears.entries()].map(([id, ys]) => ({ id, n: ys.filter((y) => y >= 2000).length })).filter((x) => x.n)
  clubQuestion('meistarar-old', 'felog', 'Nefndu félag sem hefur orðið Íslandsmeistari karla á þessari öld.',
    'Tímabilin 2000-2026.', 'Því fleiri titlar frá 2000, því algengara svar.',
    since.map((x) => ({ club: ALL_CLUBS.find((c) => c.id === x.id)!.label, common: x.n, detail: `${titles(x.n)} frá 2000` })),
    list('island-meistarar').sources)
}

// towns: Besta deild 2026, one row per club
{
  const TOWN: Record<string, string> = {
    breidablik: 'Kópavogur', fh: 'Hafnarfjörður', fram: 'Reykjavík', ia: 'Akranes', ibv: 'Vestmannaeyjar',
    ka: 'Akureyri', keflavik: 'Reykjanesbær', kr: 'Reykjavík', stjarnan: 'Garðabær', valur: 'Reykjavík',
    vikingur: 'Reykjavík', thor: 'Akureyri',
  }
  const TOWN_ACCEPT: Record<string, string[]> = {
    'Reykjavík': ['rvk', 'reykjavikurborg'], 'Kópavogur': ['kopavogsbaer'], 'Hafnarfjörður': ['hafnarfjordur', 'hfj'],
    'Akranes': ['skaginn', 'akranesbaer'], 'Vestmannaeyjar': ['eyjar', 'heimaey', 'vestmannaeyjabaer'],
    'Akureyri': ['akureyrarbaer'], 'Reykjanesbær': ['keflavik', 'reykjanesbaer'], 'Garðabær': ['gardabaer'],
  }
  const l = list('island-lid-2026')
  const towns = new Map<string, string[]>()
  for (const a of l.answers) towns.set(TOWN[a.id], [...(towns.get(TOWN[a.id]) ?? []), a.label])
  if ([...towns.values()].flat().length !== 12) throw new Error('a 2026 club has no town')
  const rows = [...towns.entries()].map(([town, clubs]) => ({ town, clubs }))
  // more clubs, more people think of it; a tie goes to the bigger town
  const SIZE = ['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Reykjanesbær', 'Akureyri', 'Garðabær', 'Akranes', 'Vestmannaeyjar']
  const t = tiersBy(rows, (r) => r.clubs.length * 100 - SIZE.indexOf(r.town))
  add({ id: 'baeir-2026', slot: 'felog', kind: 'town', prompt: 'Nefndu bæjarfélag sem á lið í Bestu deild karla 2026.',
    context: 'Bærinn þar sem félagið á heima.', rarity: 'Því fleiri lið sem bærinn á, því algengara svar.',
    sources: l.sources,
    answers: rows.map((r) => ({ id: normalise(r.town).replace(/ /g, '-'), label: r.town, detail: r.clubs.join(', '), points: t.get(r)! })) },
  (a) => [normalise(a.label), ...(TOWN_ACCEPT[a.label] ?? [])])
}

// -- ártöl --------------------------------------------------------------

for (const id of ['kr', 'valur', 'fram', 'ia', 'vikingur', 'fh']) {
  const club = ALL_CLUBS.find((c) => c.id === id)!
  const years = champYears.get(id)!
  const t = tiersBy(years, (y) => y)
  add({ id: `ar-${id}`, slot: 'ar', kind: 'year', prompt: `Nefndu ár sem ${club.label} varð Íslandsmeistari karla.`,
    context: `${club.label} hefur ${years.length} sinnum orðið Íslandsmeistari. Skrifaðu ártalið, t.d. 1999.`,
    rarity: 'Því nýrri titill, því algengara svar.', sources: list('island-meistarar').sources,
    answers: years.map((y) => ({ id: String(y), label: String(y), detail: `Íslandsmeistari ${y}`, points: t.get(y)! })) },
  (a) => [a.label])
}

// -- markaskorarar ------------------------------------------------------

const lastPlayed = (await all<{ date: string | null }>('matches', 'date', (q) => q.eq('league', 'besta').eq('season', 2026).eq('status', 'played')))
  .map((m) => m.date).filter(Boolean).sort().pop()!
const lastDay = new Date(lastPlayed)
const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const upTo2026 = `Til og með leikjum ${lastDay.getUTCDate()}. ${MONTHS[lastDay.getUTCMonth()]} 2026.`

const SEASONS = { 2023: season(2023), 2024: season(2024), 2025: season(2025), 2026: season(2026) } as Record<number, Match[]>
const PLAYERS = Object.fromEntries(Object.entries(SEASONS).map(([y, ms]) => [y, players(ms)])) as Record<number, Map<string, Scorer>>
const eventsCtx = (y: number) => (y === 2026 ? upTo2026 : `Tímabilið ${y}, öll umferðin og úrslitakeppnin.`)

for (const y of [2023, 2024, 2025, 2026]) {
  const rows = [...PLAYERS[y].values()].filter((p) => p.goals > 0)
  playerQuestion(`markaskorarar-${y}`, 'markaskorarar', `Nefndu leikmann sem skoraði í Bestu deild karla ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því fleiri mörk, því algengara svar.',
    rows.map((p) => ({ key: p.key, name: p.name, common: p.goals, detail: `${goals(p.goals)} fyrir ${p.club}` })), y === 2025 ? [KSI, WIKI_2025] : [KSI])
}
{
  const l = list('island-markakongar')
  const t = tiersBy(l.answers, (a: any) => Math.max(...[...a.detail.matchAll(/\d{4}/g)].map((m: any) => Number(m[0]))))
  for (const a of l.answers) meet(a.label)
  add({ id: 'markakongar', slot: 'markaskorarar', kind: 'player', prompt: 'Nefndu markakóng efstu deildar karla 2016-2025.',
    context: l.context, rarity: 'Því nýrri markakóngur, því algengara svar.', sources: l.sources,
    answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
  (a) => [...new Set([...personKeys(a.label), ...trust(a.label, l.answers.find((x: any) => x.id === a.id).accept)])])
}
{
  const rows = [...PLAYERS[2025].values()].filter((p) => p.efri > 0)
  playerQuestion('efri-2025', 'markaskorarar', 'Nefndu leikmann sem skoraði í efri hluta Bestu deildarinnar 2025.',
    'Aðeins leikirnir fimm eftir tvískiptingu, í efri hlutanum.', 'Því fleiri mörk í efri hlutanum, því algengara svar.',
    rows.map((p) => ({ key: p.key, name: p.name, common: p.efri * 1000 + p.goals, detail: `${goals(p.efri)} fyrir ${p.club} í efri hlutanum` })), [KSI])
}

// -- liðið: per club ----------------------------------------------------

for (const y of [2025, 2026]) {
  const clubs = [...new Set(SEASONS[y].flatMap((m) => [m.home, m.away]))]
  for (const club of clubs) {
    const c = clubOf(club)
    const rows = [...PLAYERS[y].values()].filter((p) => p.goals > 0)
      .map((p) => ({ p, n: SEASONS[y].reduce((s, m) => s + m.events.filter((e) =>
        (e.type === 'goal' || e.type === 'penalty') && (e.side === 'home' ? m.home : m.away) === club &&
        (e.playerKsiId ? `ksi-${e.playerKsiId}` : `nafn-${normalise(e.playerName).replace(/ /g, '-')}`) === p.key).length, 0) }))
      .filter((x) => x.n > 0)
    if (rows.length < 4) continue
    playerQuestion(`lid-${c.id}-${y}`, 'lidid', `Nefndu leikmann sem skoraði fyrir ${c.label} í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
      eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því fleiri mörk fyrir félagið, því algengara svar.',
      rows.map(({ p, n }) => ({ key: p.key, name: p.name, common: n, detail: `${goals(n)} fyrir ${c.label}` })), [KSI])
  }
}

// -- sérstakt -------------------------------------------------------------

for (const y of [2025, 2026]) {
  const all = [...PLAYERS[y].values()]
  playerQuestion(`snemma-${y}`, 'serstakt', `Nefndu leikmann sem skoraði á fyrstu fimm mínútum leiks í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y) + ' Mark á 1.-5. mínútu.', 'Því fleiri snemmbúin mörk, því algengara svar.',
    all.filter((p) => p.early > 0).map((p) => ({ key: p.key, name: p.name, common: p.early * 100 + p.goals, detail: `${goals(p.early)} á fyrstu fimm mínútunum fyrir ${p.club}` })), [KSI])
  playerQuestion(`tvenna-${y}`, 'serstakt', `Nefndu leikmann sem skoraði tvö mörk eða fleiri í einum leik í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því oftar sem hann gerði það, því algengara svar.',
    all.filter((p) => p.braces > 0).map((p) => ({ key: p.key, name: p.name, common: p.braces * 100 + p.goals, detail: `${p.braces} ${p.braces === 1 ? 'leikur' : 'leikir'} með 2+ mörk fyrir ${p.club}` })), [KSI])
  playerQuestion(`seint-${y}`, 'serstakt', `Nefndu leikmann sem skoraði á 90. mínútu eða síðar í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y) + ' Uppbótartími telst með.', 'Því fleiri dramatísk mörk, því algengara svar.',
    all.filter((p) => p.late > 0).map((p) => ({ key: p.key, name: p.name, common: p.late * 1000 + p.goals, detail: `${goals(p.late)} á 90. mínútu eða síðar fyrir ${p.club}` })), [KSI])
  playerQuestion(`rautt-${y}`, 'serstakt', `Nefndu leikmann sem fékk rautt spjald í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y), 'Markaskorarar eru þekktari: því fleiri mörk sem leikmaðurinn skoraði, því algengara svar.',
    all.filter((p) => p.reds > 0).map((p) => ({ key: p.key, name: p.name, common: p.goals * 10 + p.reds, detail: `${p.reds} rautt spjald, ${goals(p.goals)} á tímabilinu` })), [KSI])
}
{
  const all = [...PLAYERS[2025].values()]
  playerQuestion('sjalfsmark-2025', 'serstakt', 'Nefndu leikmann sem skoraði sjálfsmark í Bestu deildinni 2025.',
    eventsCtx(2025), 'Markaskorarar eru þekktari: því fleiri mörk (í rétt mark) á tímabilinu, því algengara svar.',
    all.filter((p) => p.owngoals > 0).map((p) => ({ key: p.key, name: p.name, common: p.goals * 10 + p.owngoals, detail: `${p.owngoals} sjálfsmark, ${goals(p.goals)} í rétt mark` })), [KSI])
}
{
  const tally = new Map<string, { key: string; name: string; tricks: number; goals: number; years: number[] }>()
  for (const y of [2024, 2025, 2026]) for (const p of PLAYERS[y].values()) if (p.hattricks) {
    const t = tally.get(p.key) ?? { key: p.key, name: p.name, tricks: 0, goals: 0, years: [] }
    t.tricks += p.hattricks; t.goals += p.goals; t.years.push(y)
    tally.set(p.key, t)
  }
  playerQuestion('thrennur', 'serstakt', 'Nefndu leikmann sem skoraði þrennu í Bestu deildinni 2024-2026.',
    `Þrjú mörk eða fleiri í einum leik. ${upTo2026}`, 'Því fleiri þrennur og mörk, því algengara svar.',
    [...tally.values()].map((t) => ({ key: t.key, name: t.name, common: t.tricks * 100 + t.goals, detail: `${t.tricks} ${t.tricks === 1 ? 'þrenna' : 'þrennur'} (${t.years.join(', ')})` })), [KSI])
}

// -- landsliðið -------------------------------------------------------------

{
  const l = list('island-landsleikir')
  const t = tiersBy(l.answers, (a: any) => Number(a.detail.match(/^\d+/)[0]))
  for (const a of l.answers) meet(a.label)
  add({ id: 'landsleikir', slot: 'landslid', kind: 'player', prompt: 'Nefndu einn af tíu leikjahæstu landsliðsmönnum Íslands frá upphafi.',
    context: 'A-landsleikir karla.', rarity: 'Því fleiri landsleikir, því algengara svar.', sources: l.sources,
    answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
  (a) => [...new Set([...personKeys(a.label), ...trust(a.label, l.answers.find((x: any) => x.id === a.id).accept)])])
}

/** National-team questions: no number measures fame here, so the points are set by hand. */
function handPicked(id: string, kind: Kind, prompt: string, context: string,
  rows: [label: string, points: Tier, detail: string, accept?: string[]][], sources: LeidQuestion['sources']) {
  if (kind === 'player') for (const r of rows) meet(r[0])
  add({ id, slot: 'landslid', kind, prompt, context, rarity: 'Stigin eru metin eftir því hve þekkt framlagið er (handvalið).', sources,
    answers: rows.map(([label, points, detail]) => ({ id: normalise(label).replace(/ /g, '-'), label, detail, points })) },
  (a) => {
    const row = rows.find((r) => r[0] === a.label)!
    return [...new Set([...(kind === 'player' ? personKeys(a.label) : [normalise(a.label)]), ...trust(a.label, (row[3] ?? []).map(normalise))])]
  })
}

const EURO = { name: 'en.wikipedia.org · UEFA Euro 2016 squads (Iceland)', url: 'https://en.wikipedia.org/wiki/UEFA_Euro_2016_squads#Iceland' }
handPicked('em2016-hopur', 'player', 'Nefndu leikmann í landsliðshópi Íslands á EM 2016.', 'Allir 23 í hópnum í Frakklandi, líka þeir sem spiluðu ekki.', [
  ['Gylfi Þór Sigurðsson', 10, 'Miðjumaður, 2 mörk á mótinu', ['Gylfi Sigurðsson']],
  ['Aron Einar Gunnarsson', 10, 'Fyrirliðinn', ['Aron Gunnarsson']],
  ['Kolbeinn Sigþórsson', 25, 'Framherji, 2 mörk á mótinu'],
  ['Hannes Þór Halldórsson', 25, 'Markvörður, spilaði alla leikina', ['Hannes Halldórsson']],
  ['Birkir Bjarnason', 25, 'Miðjumaður, 2 mörk á mótinu'],
  ['Ragnar Sigurðsson', 25, 'Miðvörður, skoraði gegn Englandi'],
  ['Jóhann Berg Guðmundsson', 50, 'Kantmaður', ['Jóhann Guðmundsson']],
  ['Eiður Smári Guðjohnsen', 50, 'Framherji, kom inn á af bekknum', ['Eiður Guðjohnsen', 'Eiður Smári']],
  ['Kári Árnason', 50, 'Miðvörður'],
  ['Jón Daði Böðvarsson', 50, 'Framherji, skoraði gegn Austurríki', ['Jón Böðvarsson']],
  ['Alfreð Finnbogason', 50, 'Framherji'],
  ['Birkir Már Sævarsson', 50, 'Hægri bakvörður', ['Birkir Sævarsson']],
  ['Ari Freyr Skúlason', 75, 'Vinstri bakvörður', ['Ari Skúlason']],
  ['Arnór Ingvi Traustason', 75, 'Skoraði sigurmarkið gegn Austurríki', ['Arnór Traustason']],
  ['Theódór Elmar Bjarnason', 75, 'Miðjumaður', ['Theodór Elmar Bjarnason', 'Elmar Bjarnason']],
  ['Emil Hallfreðsson', 75, 'Miðjumaður'],
  ['Rúnar Már Sigurjónsson', 100, 'Miðjumaður', ['Rúnar Sigurjónsson']],
  ['Sverrir Ingi Ingason', 100, 'Miðvörður', ['Sverrir Ingason']],
  ['Hörður Björgvin Magnússon', 100, 'Varnarmaður', ['Hörður Magnússon']],
  ['Hjörtur Hermannsson', 100, 'Varnarmaður'],
  ['Haukur Heiðar Hauksson', 100, 'Varnarmaður', ['Haukur Hauksson']],
  ['Ögmundur Kristinsson', 100, 'Varamarkvörður'],
  ['Ingvar Jónsson', 100, 'Varamarkvörður'],
], [EURO])

handPicked('storamot-mork', 'player', 'Nefndu leikmann sem skoraði fyrir Ísland á EM 2016 eða HM 2018.', 'Mörk í leikjunum sjálfum, ekki í undankeppni.', [
  ['Gylfi Þór Sigurðsson', 10, 'Víti gegn Ungverjalandi (EM) og Króatíu (HM)', ['Gylfi Sigurðsson']],
  ['Kolbeinn Sigþórsson', 25, 'Gegn Englandi og Frakklandi á EM'],
  ['Ragnar Sigurðsson', 25, 'Jöfnunarmarkið gegn Englandi á EM'],
  ['Birkir Bjarnason', 50, 'Gegn Portúgal og Frakklandi á EM'],
  ['Arnór Ingvi Traustason', 50, 'Sigurmarkið gegn Austurríki á EM', ['Arnór Traustason']],
  ['Alfreð Finnbogason', 50, 'Fyrsta HM-mark Íslands, gegn Argentínu'],
  ['Jón Daði Böðvarsson', 75, 'Gegn Austurríki á EM', ['Jón Böðvarsson']],
], [
  { name: 'en.wikipedia.org · UEFA Euro 2016 Group F og knockout stage', url: 'https://en.wikipedia.org/wiki/UEFA_Euro_2016_Group_F' },
  { name: 'en.wikipedia.org · 2018 FIFA World Cup Group D', url: 'https://en.wikipedia.org/wiki/2018_FIFA_World_Cup_Group_D' },
])

handPicked('storamot-motherjar', 'nation', 'Nefndu þjóð sem Ísland mætti á EM 2016 eða HM 2018.', 'Átta leikir, átta mótherjar.', [
  ['England', 10, 'EM 2016, 16 liða úrslit: Ísland vann 2-1', ['Englendingar']],
  ['Argentína', 25, 'HM 2018: 1-1', ['Argentina']],
  ['Frakkland', 25, 'EM 2016, 8 liða úrslit: 2-5', ['France', 'Frakkar']],
  ['Portúgal', 25, 'EM 2016: 1-1', ['Portugal']],
  ['Króatía', 50, 'HM 2018: 1-2', ['Croatia', 'Kroatia']],
  ['Austurríki', 75, 'EM 2016: Ísland vann 2-1', ['Austria']],
  ['Ungverjaland', 75, 'EM 2016: 1-1', ['Hungary']],
  ['Nígería', 75, 'HM 2018: 0-2', ['Nigeria']],
], [
  { name: 'en.wikipedia.org · UEFA Euro 2016 Group F og knockout stage', url: 'https://en.wikipedia.org/wiki/UEFA_Euro_2016_Group_F' },
  { name: 'en.wikipedia.org · 2018 FIFA World Cup Group D', url: 'https://en.wikipedia.org/wiki/2018_FIFA_World_Cup_Group_D' },
])

handPicked('islendingar-pl', 'player', 'Nefndu Íslending sem hefur spilað í ensku úrvalsdeildinni.', 'Frá stofnun deildarinnar 1992 til og með 2026.', [
  ['Gylfi Þór Sigurðsson', 10, 'Swansea, Tottenham, Everton', ['Gylfi Sigurðsson']],
  ['Eiður Smári Guðjohnsen', 10, 'Chelsea, Tottenham, Stoke, Fulham', ['Eiður Guðjohnsen', 'Eiður Smári']],
  ['Jóhann Berg Guðmundsson', 25, 'Burnley', ['Jóhann Guðmundsson']],
  ['Aron Einar Gunnarsson', 25, 'Cardiff City', ['Aron Gunnarsson']],
  ['Hermann Hreiðarsson', 25, 'Crystal Palace, Wimbledon, Ipswich, Charlton, Portsmouth'],
  ['Heiðar Helguson', 50, 'Watford, Fulham, Bolton, QPR'],
  ['Grétar Rafn Steinsson', 50, 'Bolton', ['Grétar Steinsson']],
  ['Guðni Bergsson', 50, 'Tottenham, Bolton'],
  ['Rúnar Alex Rúnarsson', 50, 'Arsenal', ['Rúnar Rúnarsson']],
  ['Hákon Rafn Valdimarsson', 50, 'Brentford', ['Hákon Valdimarsson']],
  ['Arnar Gunnlaugsson', 75, 'Bolton, Leicester'],
  ['Brynjar Björn Gunnarsson', 75, 'Reading', ['Brynjar Gunnarsson']],
  ['Ívar Ingimarsson', 75, 'Reading'],
  ['Jóhannes Karl Guðjónsson', 75, 'Aston Villa, Wolves, Burnley', ['Joey Guðjónsson', 'Jóhannes Guðjónsson']],
  ['Lárus Orri Sigurðsson', 75, 'West Bromwich Albion', ['Lárus Sigurðsson']],
  ['Þórður Guðjónsson', 100, 'Derby County'],
  ['Jóhann Birnir Guðmundsson', 100, 'Watford', ['Jóhann Birnir']],
  ['Eggert Gunnþór Jónsson', 100, 'Wolves', ['Eggert Jónsson']],
  ['Þorvaldur Örlygsson', 100, 'Nottingham Forest'],
], [{ name: 'en.wikipedia.org · List of foreign Premier League players (Iceland)', url: 'https://en.wikipedia.org/wiki/List_of_foreign_Premier_League_players#Iceland' }])

// -- útlönd -----------------------------------------------------------------

{
  const l = list('evropa-meistarar')
  const t = tiersBy(l.answers, (a: any) => Number(a.detail.match(/^\d+/)[0]))
  add({ id: 'evropumeistarar', slot: 'utlond', kind: 'club', prompt: 'Nefndu félag sem hefur unnið Evrópukeppni meistaraliða eða Meistaradeildina.',
    context: l.context, rarity: 'Því fleiri titlar, því algengara svar.', sources: l.sources,
    answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
  (a) => l.answers.find((x: any) => x.id === a.id).accept)
}
{
  const l = list('evropa-gullknotturinn')
  const t = tiersBy(l.answers, (a: any) => [...a.detail.matchAll(/\d{4}/g)].length * 10000 + Math.max(...[...a.detail.matchAll(/\d{4}/g)].map((m: any) => Number(m[0]))))
  for (const a of l.answers) meet(a.label)
  add({ id: 'gullknottur', slot: 'utlond', kind: 'player', prompt: 'Nefndu leikmann sem vann Gullknöttinn 1990-2009.',
    context: l.context, rarity: 'Tvöfaldir sigurvegarar og nýrri sigurvegarar eru algengari svör.', sources: l.sources,
    answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
  (a) => trust(a.label, l.answers.find((x: any) => x.id === a.id).accept))
}
{
  const l = list('enska-lid-2026')
  const pl = await all<{ season: number; home_team: number }>('matches', 'season, home_team', (q) => q.eq('league', 'premier'))
  const seasonsIn = new Map<string, Set<number>>()
  for (const m of pl) { const n = normalise(teamName.get(m.home_team)!); seasonsIn.set(n, (seasonsIn.get(n) ?? new Set()).add(m.season)) }
  const plSeasons = (id: string) => {
    const keys = entityKeys(ALL_CLUBS.find((c) => c.id === id)!)
    return Math.max(0, ...keys.map((k) => seasonsIn.get(k)?.size ?? 0))
  }
  const rows = l.answers.map((a: any) => ({ a, n: plSeasons(a.id) }))
  const t = tiersBy(rows, (r: any) => r.n)
  add({ id: 'enska-lid-2026', slot: 'utlond', kind: 'club', prompt: 'Nefndu lið í ensku úrvalsdeildinni 2026/27.',
    context: l.context, rarity: 'Því fleiri tímabil í úrvalsdeildinni, því algengara svar.', sources: l.sources,
    answers: rows.map((r: any) => ({ id: r.a.id, label: r.a.label, detail: `${r.n} tímabil í úrvalsdeildinni frá 1993`, points: t.get(r)! })) },
  (a) => l.answers.find((x: any) => x.id === a.id).accept)
}
{
  // FPL's own season file: full name and the short name the game shows
  const csv = readFileSync(join(webDir, '..', '..', 'Fantasy-Premier-League', 'data', '2025-26', 'players_raw.csv'), 'utf-8').split('\n')
  const head = csv[0].split(',')
  const col = (name: string) => head.indexOf(name)
  const rows = csv.slice(1).filter(Boolean).map((line) => {
    const f = line.split(',')
    return { key: `fpl-${f[col('id')]}`, name: `${f[col('first_name')]} ${f[col('second_name')]}`, web: f[col('web_name')], common: Number(f[col('goals_scored')]) }
  }).filter((r) => r.common > 0)
  if (rows.length < 200) throw new Error(`FPL 2025-26: only ${rows.length} scorers - is the CSV quoted?`)
  const t = tiersBy(rows, (r) => r.common)
  for (const r of rows) meet(r.name)
  add({ id: 'enska-markaskorarar-2025', slot: 'utlond', kind: 'player', prompt: 'Nefndu leikmann sem skoraði í ensku úrvalsdeildinni 2025/26.',
    context: 'Tímabilið 2025/26. Sjálfsmörk teljast ekki.', rarity: 'Því fleiri mörk, því algengara svar.',
    sources: [{ name: 'Fantasy Premier League (vaastav/Fantasy-Premier-League)', url: 'https://github.com/vaastav/Fantasy-Premier-League' }],
    answers: rows.map((r) => ({ id: r.key, label: r.web.length > 2 && !normalise(r.name).includes(normalise(r.web)) ? `${r.web} (${r.name})` : r.name, detail: goals(r.common), points: t.get(r)! })) },
  (a) => {
    const r = rows.find((x) => x.key === a.id)!
    return [...new Set([...personKeys(r.name), normalise(r.web)])]
  })
}

// ================================================================ more roads
// Enough questions that a new road comes every day for weeks before any
// question is asked twice (see dailyRoad in src/lib/leidin/game.ts).

// -- félög: seasons, eras, final tables -----------------------------------

{
  const bySeason = new Map<number, string[]>()
  for (const [club, years] of topSeasons) for (const y of years) bySeason.set(y, [...(bySeason.get(y) ?? []), club])
  for (let y = 2010; y <= 2020; y++) {
    const clubs = bySeason.get(y) ?? []
    if (clubs.length !== 12) throw new Error(`top flight ${y}: ${clubs.length} clubs`)
    clubQuestion(`efsta-deild-${y}`, 'felog', `Nefndu lið sem spilaði í efstu deild karla ${y}.`, `Liðin tólf í efstu deild tímabilið ${y}.`,
      'Því fleiri tímabil sem félagið hefur átt í efstu deild, því algengara svar.',
      clubs.map((club) => ({ club, common: seasonsOf(club), detail: seasonWord(seasonsOf(club)) })),
      [{ name: 'Öll úrslit tímabilsins í gagnagrunni Bestu spárinnar (KSÍ)', url: `${SITE}/saga` }])
  }
}
for (const [from, to] of [[1912, 1949], [1950, 1979], [1980, 1999]]) {
  const rows = [...champYears.entries()].map(([id, ys]) => ({ id, n: ys.filter((y) => y >= from && y <= to).length })).filter((x) => x.n)
  clubQuestion(`meistarar-${from}`, 'felog', `Nefndu félag sem varð Íslandsmeistari karla á árunum ${from}-${to}.`,
    `Tímabilin ${from}-${to}.`, 'Því fleiri titlar á tímabilinu, því algengara svar.',
    rows.map((x) => ({ club: ALL_CLUBS.find((c) => c.id === x.id)!.label, common: x.n, detail: `${titles(x.n)} á árunum ${from}-${to}` })),
    list('island-meistarar').sources)
}
for (const y of [2021, 2022, 2023, 2024, 2025]) {
  const l = list(`island-lokastada-${y}`)
  clubQuestion(`lokastada-${y}`, 'felog', `Nefndu lið sem endaði í einu af tíu efstu sætum efstu deildar karla ${y}.`, l.context,
    'Því ofar í töflunni, því algengara svar: meistararnir gefa minnst.',
    l.answers.map((a: any) => ({ club: a.label, common: -Number(a.detail.match(/^(\d+)\./)[1]), detail: a.detail })), ofList(l))
}
{
  const l = list('island-lid-2025')
  clubQuestion('besta-2025', 'felog', 'Nefndu lið í Bestu deild karla 2025.', 'Liðin tólf á tímabilinu 2025.',
    'Því fleiri tímabil sem félagið hefur átt í efstu deild, því algengara svar.',
    l.answers.map((a: any) => { const db = [...topSeasons.keys()].find((k) => clubOf(k).id === a.id)!; return { club: a.label, common: seasonsOf(db), detail: seasonWord(seasonsOf(db)) } }),
    ofList(l))
}

// -- ártöl: more champions, and the years clubs went down -------------------

for (const id of ['keflavik', 'ibv', 'breidablik']) {
  const club = ALL_CLUBS.find((c) => c.id === id)!
  const years = champYears.get(id)!
  const t = tiersBy(years, (y) => y)
  add({ id: `ar-${id}`, slot: 'ar', kind: 'year', prompt: `Nefndu ár sem ${club.label} varð Íslandsmeistari karla.`,
    context: `${club.label} hefur ${years.length} sinnum orðið Íslandsmeistari. Skrifaðu ártalið, t.d. 1999.`,
    rarity: 'Því nýrri titill, því algengara svar.', sources: list('island-meistarar').sources,
    answers: years.map((y) => ({ id: String(y), label: String(y), detail: `Íslandsmeistari ${y}`, points: t.get(y)! })) },
  (a) => [a.label])
}
{
  // a club in the top flight one season and not the next went down; only
  // from 1955, when relegation began, and never for the old town alliances
  // (ÍBA, ÍBH, ÍBÍ) that split up rather than fell
  const leagueYears = new Set([...topSeasons.values()].flatMap((s) => [...s]))
  for (const [club, years] of topSeasons) {
    const c = clubOf(club)
    if (['iba', 'ibh', 'ibi'].includes(c.id)) continue
    const down = [...years].filter((y) => y >= 1955 && leagueYears.has(y + 1) && !years.has(y + 1)).sort((a, b) => a - b)
    if (down.length < 3) continue
    const t = tiersBy(down, (y) => y)
    add({ id: `fall-${c.id}`, slot: 'ar', kind: 'year', prompt: `Nefndu ár sem ${c.label} féll úr efstu deild karla.`,
      context: `Árið sem liðið spilaði síðast í efstu deild áður en það féll. ${c.label} hefur fallið ${down.length} sinnum.`,
      rarity: 'Því nýrra fall, því algengara svar.',
      sources: [{ name: 'Lokastöður 1912-1984 og öll úrslit frá 1985 í gagnagrunni Bestu spárinnar', url: `${SITE}/saga` }],
      answers: down.map((y) => ({ id: String(y), label: String(y), detail: `Féll eftir tímabilið ${y}`, points: t.get(y)! })) },
    (a) => [a.label])
  }
}

// -- markaskorarar: halves of the split, the second tier ---------------------

const scorerKey = (e: Ev) => (e.playerKsiId ? `ksi-${e.playerKsiId}` : `nafn-${normalise(e.playerName).replace(/ /g, '-')}`)
const isGoal = (e: Ev) => e.type === 'goal' || e.type === 'penalty'
const sideClub = (m: Match, e: Ev) => (e.side === 'home' ? m.home : m.away)

/** Goals by player within some of a season's matches, with the player's whole-season tally for tie-breaks. */
function tally(y: number, matches: Match[], pick: (m: Match, e: Ev) => boolean) {
  const n = new Map<string, number>()
  for (const m of matches) for (const e of m.events) if (isGoal(e) && pick(m, e)) n.set(scorerKey(e), (n.get(scorerKey(e)) ?? 0) + 1)
  return [...n.entries()].map(([key, k]) => ({ p: PLAYERS[y].get(key)!, k }))
}

for (const [y, half, word] of [[2024, 'efri', 'efri'], [2025, 'nedri', 'neðri'], [2024, 'nedri', 'neðri']] as const) {
  const rows = tally(y, SEASONS[y], (m) => m.phase === half)
  playerQuestion(`${half}-${y}`, 'markaskorarar', `Nefndu leikmann sem skoraði í ${word} hluta Bestu deildarinnar ${y}.`,
    `Aðeins leikirnir fimm eftir tvískiptingu, í ${word} hlutanum.`, `Því fleiri mörk í ${word} hlutanum, því algengara svar.`,
    rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k * 1000 + p.goals, detail: `${goals(k)} fyrir ${p.club} í ${word} hlutanum` })), [KSI])
}

const LENGJU = season(2026, 'lengjudeild').filter((m) => m.phase === 'main')
const LENGJU_PLAYERS = players(LENGJU)
const lengjuCtx = upTo2026.replace('Til og með', 'Deildarkeppnin, til og með')
{
  const rows = [...LENGJU_PLAYERS.values()].filter((p) => p.goals > 0)
  playerQuestion('lengjudeild-markaskorarar-2026', 'markaskorarar', 'Nefndu leikmann sem skoraði í Lengjudeild karla 2026.',
    `${lengjuCtx} Umspilið telst ekki með.`, 'Því fleiri mörk, því algengara svar.',
    rows.map((p) => ({ key: p.key, name: p.name, common: p.goals, detail: `${goals(p.goals)} fyrir ${p.club}` })), [KSI])
}

// -- liðið: scored for, scored against, and the second tier -------------------

for (const y of [2023, 2024]) {
  for (const club of [...new Set(SEASONS[y].flatMap((m) => [m.home, m.away]))]) {
    const c = clubOf(club)
    const rows = tally(y, SEASONS[y], (m, e) => sideClub(m, e) === club)
    if (rows.length < 4) continue
    playerQuestion(`lid-${c.id}-${y}`, 'lidid', `Nefndu leikmann sem skoraði fyrir ${c.label} í Bestu deildinni ${y}.`,
      eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því fleiri mörk fyrir félagið, því algengara svar.',
      rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k, detail: `${goals(k)} fyrir ${c.label}` })), [KSI])
  }
}
for (const y of [2025, 2026]) {
  for (const club of [...new Set(SEASONS[y].flatMap((m) => [m.home, m.away]))]) {
    const c = clubOf(club)
    const rows = tally(y, SEASONS[y], (m, e) => (m.home === club || m.away === club) && sideClub(m, e) !== club)
    if (rows.length < 4) continue
    playerQuestion(`gegn-${c.id}-${y}`, 'lidid', `Nefndu leikmann sem skoraði gegn ${c.label} í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
      eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því oftar sem hann skoraði gegn þeim, því algengara svar.',
      rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k * 100 + p.goals, detail: `${goals(k)} gegn ${c.label} (${p.club})` })), [KSI])
  }
}
for (const club of [...new Set(LENGJU.flatMap((m) => [m.home, m.away]))]) {
  const c = clubOf(club)
  const n = new Map<string, number>()
  for (const m of LENGJU) for (const e of m.events) if (isGoal(e) && sideClub(m, e) === club) n.set(scorerKey(e), (n.get(scorerKey(e)) ?? 0) + 1)
  const rows = [...n.entries()].map(([key, k]) => ({ p: LENGJU_PLAYERS.get(key)!, k }))
  if (rows.length < 4) continue
  playerQuestion(`lengju-${c.id}-2026`, 'lidid', `Nefndu leikmann sem skoraði fyrir ${c.label} í Lengjudeildinni 2026.`,
    `${lengjuCtx} Sjálfsmörk teljast ekki.`, 'Því fleiri mörk fyrir félagið, því algengara svar.',
    rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k, detail: `${goals(k)} fyrir ${c.label}` })), [KSI])
}

// -- sérstakt: more seasons, lone winners, Reykjavík derbies -------------------

{
  const y = 2024
  const all = [...PLAYERS[y].values()]
  playerQuestion(`snemma-${y}`, 'serstakt', `Nefndu leikmann sem skoraði á fyrstu fimm mínútum leiks í Bestu deildinni ${y}.`,
    eventsCtx(y) + ' Mark á 1.-5. mínútu.', 'Því fleiri snemmbúin mörk, því algengara svar.',
    all.filter((p) => p.early > 0).map((p) => ({ key: p.key, name: p.name, common: p.early * 100 + p.goals, detail: `${goals(p.early)} á fyrstu fimm mínútunum fyrir ${p.club}` })), [KSI])
  playerQuestion(`tvenna-${y}`, 'serstakt', `Nefndu leikmann sem skoraði tvö mörk eða fleiri í einum leik í Bestu deildinni ${y}.`,
    eventsCtx(y) + ' Sjálfsmörk teljast ekki.', 'Því oftar sem hann gerði það, því algengara svar.',
    all.filter((p) => p.braces > 0).map((p) => ({ key: p.key, name: p.name, common: p.braces * 100 + p.goals, detail: `${p.braces} ${p.braces === 1 ? 'leikur' : 'leikir'} með 2+ mörk fyrir ${p.club}` })), [KSI])
  playerQuestion(`seint-${y}`, 'serstakt', `Nefndu leikmann sem skoraði á 90. mínútu eða síðar í Bestu deildinni ${y}.`,
    eventsCtx(y) + ' Uppbótartími telst með.', 'Því fleiri dramatísk mörk, því algengara svar.',
    all.filter((p) => p.late > 0).map((p) => ({ key: p.key, name: p.name, common: p.late * 1000 + p.goals, detail: `${goals(p.late)} á 90. mínútu eða síðar fyrir ${p.club}` })), [KSI])
  playerQuestion(`rautt-${y}`, 'serstakt', `Nefndu leikmann sem fékk rautt spjald í Bestu deildinni ${y}.`,
    eventsCtx(y), 'Markaskorarar eru þekktari: því fleiri mörk sem leikmaðurinn skoraði, því algengara svar.',
    all.filter((p) => p.reds > 0).map((p) => ({ key: p.key, name: p.name, common: p.goals * 10 + p.reds, detail: `${p.reds} rautt spjald, ${goals(p.goals)} á tímabilinu` })), [KSI])
}
for (const y of [2024, 2026]) {
  const own = [...PLAYERS[y].values()].filter((p) => p.owngoals > 0)
  if (own.length < 3) continue
  playerQuestion(`sjalfsmark-${y}`, 'serstakt', `Nefndu leikmann sem skoraði sjálfsmark í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y), 'Markaskorarar eru þekktari: því fleiri mörk (í rétt mark) á tímabilinu, því algengara svar.',
    own.map((p) => ({ key: p.key, name: p.name, common: p.goals * 10 + p.owngoals, detail: `${p.owngoals} sjálfsmark, ${goals(p.goals)} í rétt mark` })), [KSI])
}
for (const y of [2024, 2025, 2026]) {
  const rows = tally(y, SEASONS[y], (m) => (m.score[0] === 1 && m.score[1] === 0) || (m.score[0] === 0 && m.score[1] === 1))
  playerQuestion(`sigurmark-${y}`, 'serstakt', `Nefndu leikmann sem skoraði eina markið í 1-0 sigri í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    eventsCtx(y), 'Því fleiri 1-0 sigurmörk, því algengara svar.',
    rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k * 1000 + p.goals, detail: `${k} ${k === 1 ? 'sigurmark' : 'sigurmörk'} í 1-0 leik fyrir ${p.club}` })), [KSI])
}
const REYKJAVIK = new Set(['KR', 'Valur', 'Víkingur R.', 'Fram', 'Fylkir', 'Leiknir R.', 'Þróttur R.', 'ÍR', 'Fjölnir'])
for (const y of [2024, 2025, 2026]) {
  const rows = tally(y, SEASONS[y], (m) => REYKJAVIK.has(m.home) && REYKJAVIK.has(m.away))
  playerQuestion(`reykjavikurslagur-${y}`, 'serstakt', `Nefndu leikmann sem skoraði í Reykjavíkurslag í Bestu deildinni ${y}${y === 2026 ? ' (til þessa)' : ''}.`,
    `Leikir þar sem bæði lið eru úr Reykjavík (t.d. KR, Valur, Víkingur, Fram). ${eventsCtx(y)}`, 'Því fleiri mörk í Reykjavíkurslögum, því algengara svar.',
    rows.map(({ p, k }) => ({ key: p.key, name: p.name, common: k * 1000 + p.goals, detail: `${goals(k)} í Reykjavíkurslögum fyrir ${p.club}` })), [KSI])
}

// -- landsliðið: every A international since 1930 -------------------------------

{
  const NATION: Record<string, { is: string; en?: string[] }> = Object.fromEntries(Object.entries(IS_NAMES).map(([k, v]) => [k, { is: v }]))
  Object.assign(NATION, {
    DD: { is: 'Austur-Þýskaland' }, SU: { is: 'Sovétríkin' }, CS: { is: 'Tékkóslóvakía' }, WG: { is: 'Vestur-Þýskaland' },
    KW: { is: 'Kúveit' }, SA: { is: 'Sádi-Arabía' }, BM: { is: 'Bermúda' }, ZA: { is: 'Suður-Afríka' }, AE: { is: 'Sameinuðu arabísku furstadæmin', en: ['UAE', 'Furstadæmin'] },
    BH: { is: 'Barein' }, NG: { is: 'Nígería' }, QA: { is: 'Katar' }, GL: { is: 'Grænland' }, CL: { is: 'Síle', en: ['Chile'] },
    BO: { is: 'Bólivía' }, HN: { is: 'Hondúras' }, GT: { is: 'Gvatemala' }, CN: { is: 'Kína' }, TT: { is: 'Trínidad og Tóbagó' },
    SV: { is: 'El Salvador' }, UG: { is: 'Úganda' }, GH: { is: 'Gana' }, VE: { is: 'Venesúela' }, IN: { is: 'Indland' }, PE: { is: 'Perú' },
    HT: { is: 'Haítí' }, TN: { is: 'Túnis' }, ID: { is: 'Indónesía' }, IR: { is: 'Íran' },
  })
  const EXTRA_ACCEPT: Record<string, string[]> = {
    NL: ['Niðurlönd'], CZ: ['Tékkland', 'Czech Republic'], BA: ['Bosnía og Hersegóvína', 'Bosnia'], NM: ['Makedónía', 'Macedonia'],
    EN: ['Englendingar'], SQ: ['Skotar'], DK: ['Danir'], NO: ['Norðmenn'], SE: ['Svíar'], FO: ['Færeyingar', 'Faroe'],
    US: ['USA', 'Bandaríki Norður-Ameríku'], KR: ['Kórea'], DE: ['Þjóðverjar'], FR: ['Frakkar'], TR: ['Tyrkir'],
  }
  const rows = await all<{ date: string; home_code: string; away_code: string; home: string; away: string; home_goals: number | null; away_goals: number | null }>(
    'nations_matches', 'date, home_code, away_code, home, away, home_goals, away_goals', (q) => q.or('home_code.eq.IS,away_code.eq.IS'))
  const games = rows.filter((r) => r.home_goals !== null && r.away_goals !== null).map((r) => {
    const home = r.home_code === 'IS'
    let code = home ? r.away_code : r.home_code
    if (code === 'MK') code = 'NM' // Macedonia and North Macedonia are one opponent
    return { code, en: home ? r.away : r.home, year: Number(r.date.slice(0, 4)), diff: home ? r.home_goals! - r.away_goals! : r.away_goals! - r.home_goals! }
  })
  const english = new Map(games.map((g) => [g.code, g.en]))
  for (const g of games) if (!NATION[g.code]) throw new Error(`no Icelandic name for ${g.code} (${g.en})`)
  const UEFA = new Set([...Object.keys(IS_NAMES).slice(0, Object.keys(IS_NAMES).indexOf('AR')), 'DD', 'SU', 'CS', 'WG'])
  const ELO = { name: 'eloratings.net · öll úrslit A-landsliðs Íslands (gagnagrunnur Bestu spárinnar)', url: `${SITE}/landslid` }
  const nationQuestion = (id: string, prompt: string, context: string, rarity: string, list: { code: string; common: number; detail: string }[]) =>
    add({ id, slot: 'landslid', kind: 'nation', prompt, context, rarity, sources: [ELO],
      answers: (() => { const t = tiersBy(list, (r) => r.common); return list.map((r) => ({ id: r.code.toLowerCase(), label: NATION[r.code].is, detail: r.detail, points: t.get(r)! })) })() },
    (a) => {
      const code = a.id.toUpperCase()
      return [NATION[code].is, english.get(code) ?? '', ...(NATION[code].en ?? []), ...(EXTRA_ACCEPT[code] ?? [])].map(normalise)
    })
  const per = (pick: (g: typeof games[number]) => boolean) => {
    const out = new Map<string, { n: number; w: number; d: number }>()
    for (const g of games) if (pick(g)) { const x = out.get(g.code) ?? { n: 0, w: 0, d: 0 }; x.n++; if (g.diff > 0) x.w++; if (g.diff === 0) x.d++; out.set(g.code, x) }
    return out
  }
  const lastYear = Math.max(...games.map((g) => g.year))
  const allTime = per(() => true)
  nationQuestion('landslid-sigrar', 'Nefndu þjóð sem A-landslið karla hefur unnið.', `Allir A-landsleikir frá 1930 til ${lastYear}.`,
    'Því oftar sem Ísland hefur unnið þjóðina, því algengara svar.',
    [...allTime].filter(([, x]) => x.w > 0).map(([code, x]) => ({ code, common: x.w, detail: `${x.w} ${x.w === 1 ? 'sigur' : 'sigrar'} í ${x.n} leikjum` })))
  nationQuestion('landslid-aldrei', 'Nefndu þjóð sem Ísland hefur mætt minnst þrisvar en aldrei unnið.', `A-landslið karla, allir leikir frá 1930 til ${lastYear}.`,
    'Því oftar sem liðin hafa mæst, því algengara svar.',
    [...allTime].filter(([, x]) => x.w === 0 && x.n >= 3).map(([code, x]) => ({ code, common: x.n, detail: `${x.n} leikir, enginn sigur` })))
  const recent = per((g) => g.year >= 2020)
  nationQuestion('landslid-2020', 'Nefndu þjóð sem A-landslið karla hefur mætt frá 2020.', `Allir A-landsleikir 2020-${lastYear}, vináttuleikir líka.`,
    'Því oftar sem liðin hafa mæst, því algengara svar.',
    [...recent].map(([code, x]) => ({ code, common: x.n, detail: `${x.n} ${x.n === 1 ? 'leikur' : 'leikir'} frá 2020` })))
  for (const [from, to, word] of [[1990, 1999, 'á árunum 1990-1999'], [2010, 2019, 'á árunum 2010-2019']] as const) {
    const era = per((g) => g.year >= from && g.year <= to)
    nationQuestion(`landslid-${from}`, `Nefndu þjóð sem A-landslið karla mætti ${word}.`, 'Allir A-landsleikir tímabilsins, vináttuleikir líka.',
      'Því oftar sem liðin mættust, því algengara svar.',
      [...era].map(([code, x]) => ({ code, common: x.n, detail: `${x.n} ${x.n === 1 ? 'leikur' : 'leikir'} ${word}` })))
  }
  nationQuestion('landslid-jafntefli', 'Nefndu þjóð sem A-landslið karla hefur gert jafntefli við.', `Allir A-landsleikir frá 1930 til ${lastYear}.`,
    'Því fleiri jafntefli, því algengara svar.',
    [...allTime].filter(([, x]) => x.d > 0).map(([code, x]) => ({ code, common: x.d, detail: `${x.d} ${x.d === 1 ? 'jafntefli' : 'jafntefli'} í ${x.n} leikjum` })))
  const far = per((g) => !UEFA.has(g.code))
  nationQuestion('landslid-utan-evropu', 'Nefndu þjóð utan Evrópu sem A-landslið karla hefur mætt.', `Allir A-landsleikir frá 1930 til ${lastYear}.`,
    'Því oftar sem liðin hafa mæst, því algengara svar.',
    [...far].map(([code, x]) => ({ code, common: x.n, detail: `${x.n} ${x.n === 1 ? 'leikur' : 'leikir'}, ${x.w} ${x.w === 1 ? 'sigur' : 'sigrar'}` })))
}

// -- útlönd: every verified Tenaball table ----------------------------------------

{
  const LEAGUE: Record<string, { name: string; key: string }> = {
    enska: { name: 'ensku úrvalsdeildinni', key: 'premier' }, spann: { name: 'spænsku deildinni', key: 'laliga' },
    italia: { name: 'ítölsku deildinni', key: 'seriea' }, thyskaland: { name: 'þýsku deildinni', key: 'bundesliga' },
    frakkland: { name: 'frönsku deildinni', key: 'ligue1' }, portugal: { name: 'portúgölsku deildinni', key: 'primeira' },
    holland: { name: 'hollensku deildinni', key: 'eredivisie' }, championship: { name: 'ensku B-deildinni', key: 'championship' },
  }
  const seasonsIn = new Map<string, Map<string, Set<number>>>()
  const foreign = await all<{ league: string; season: number; home_team: number }>('matches', 'league, season, home_team',
    (q) => q.in('league', Object.values(LEAGUE).map((x) => x.key)))
  for (const m of foreign) {
    const byClub = seasonsIn.get(m.league) ?? new Map()
    const n = normalise(teamName.get(m.home_team)!)
    byClub.set(n, (byClub.get(n) ?? new Set()).add(m.season))
    seasonsIn.set(m.league, byClub)
  }
  const files = readdirSync(join(webDir, 'src/lib/topp10/lists')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  const done = new Set(questions.map((q) => q.id))
  // a Tenaball list is named by the year its season starts: 2025 is 2025/26
  const span = (y: number) => `${y}/${String(y + 1).slice(2)}`
  for (const id of files) {
    const m = id.match(/^(enska|spann|italia|thyskaland|frakkland|portugal|holland|championship)-(lokastada|lid|markahaestir)-(\d{4})$/)
    if (!m || done.has(id)) continue
    const [, land, kind, yy] = m
    const l = list(id), y = Number(yy), league = LEAGUE[land]
    if (kind === 'lokastada') {
      const t = tiersBy(l.answers, (a: any) => -Number(a.detail.match(/^(\d+)\./)[1]))
      add({ id, slot: 'utlond', kind: 'club', prompt: `Nefndu lið sem endaði í einu af tíu efstu sætum í ${league.name} ${span(y)}.`,
        context: l.context, rarity: 'Því ofar í töflunni, því algengara svar: meistararnir gefa minnst.', sources: l.sources,
        answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
      (a) => trust(a.label, l.answers.find((x: any) => x.id === a.id).accept))
    } else if (kind === 'lid') {
      const clubs = seasonsIn.get(league.key) ?? new Map()
      const count = (a: any) => Math.max(0, ...l.answers.find((x: any) => x.id === a.id).accept.map((k: string) => clubs.get(k)?.size ?? 0))
      const rows = l.answers.map((a: any) => ({ a, n: count(a) }))
      const t = tiersBy(rows, (r: any) => r.n)
      add({ id, slot: 'utlond', kind: 'club', prompt: `Nefndu lið í ${league.name} ${span(y)}.`,
        context: l.context, rarity: 'Því fleiri tímabil í deildinni, því algengara svar.', sources: l.sources,
        answers: rows.map((r: any) => ({ id: r.a.id, label: r.a.label, detail: r.n ? `${r.n} tímabil í deildinni í gögnunum okkar` : 'nýtt í deildinni', points: t.get(r)! })) },
      (a) => trust(a.label, l.answers.find((x: any) => x.id === a.id).accept))
    } else {
      const t = tiersBy(l.answers, (a: any) => Number(a.detail.match(/^(\d+)/)?.[1] ?? 0))
      for (const a of l.answers) meet(a.label)
      add({ id, slot: 'utlond', kind: 'player', prompt: `Nefndu einn af markahæstu leikmönnum ensku úrvalsdeildarinnar ${span(y)}.`,
        context: l.context, rarity: 'Því fleiri mörk, því algengara svar.', sources: l.sources,
        answers: l.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
      (a) => [...new Set([...personKeys(a.label), ...trust(a.label, l.answers.find((x: any) => x.id === a.id).accept)])])
    }
  }
  const cl = list('evropa-meistaradeildin')
  const t = tiersBy(cl.answers, (a: any) => Number(a.detail.match(/^\d+/)[0]))
  add({ id: 'meistaradeildin-1993', slot: 'utlond', kind: 'club', prompt: 'Nefndu félag sem hefur unnið Meistaradeildina frá 1993.',
    context: cl.context, rarity: 'Því fleiri titlar, því algengara svar.', sources: cl.sources,
    answers: cl.answers.map((a: any) => ({ id: a.id, label: a.label, detail: a.detail, points: t.get(a)! })) },
  (a) => trust(a.label, cl.answers.find((x: any) => x.id === a.id).accept))
}

// ---------------------------------------------------------------- checks

// a short form of one person must never be another person's full name
// ...unless that other name is this same person written shorter (Gylfi Sigurðsson)
for (const q of questions) if (q.kind === 'player') for (const a of q.answers) {
  const full = normalise(a.label)
  a.accept = a.accept.filter((k) => {
    const other = everyone.get(k)
    return k === full || !other || trusted.has(`${full}|${k}`) || personKeys(other).includes(full)
  })
  if (!a.accept.length) throw new Error(`${q.id}: ${a.label} lost every spelling`)
}
for (const q of questions) {
  if (q.prompt.includes('—') || q.context.includes('—')) throw new Error(`${q.id}: em dash`)
  const tiers = new Set(q.answers.map((a) => a.points))
  if (!tiers.has(10)) throw new Error(`${q.id}: no 10-point answer`)
}

const out = join(webDir, 'src/lib/leidin/questions.json')
writeFileSync(out, JSON.stringify(questions, null, 1) + '\n')

// names suggested while typing: one pool per kind, wide enough that seeing a
// name says nothing about whether it answers today's question
const hver: string[] = JSON.parse(readFileSync(join(webDir, 'src/lib/hver/names.json'), 'utf-8'))
const pool = (kind: Kind) => [...new Set(questions.filter((q) => q.kind === kind).flatMap((q) => q.answers.map((a) => a.label)))]
const NATION_POOL = ['Albanía', 'Andorra', 'Argentína', 'Armenía', 'Austurríki', 'Aserbaísjan', 'Belgía', 'Bosnía og Hersegóvína', 'Brasilía', 'Búlgaría',
  'Danmörk', 'Eistland', 'England', 'Finnland', 'Frakkland', 'Færeyjar', 'Georgía', 'Grikkland', 'Holland', 'Hvíta-Rússland', 'Írland', 'Ísrael',
  'Ítalía', 'Japan', 'Kasakstan', 'Kósovó', 'Króatía', 'Kýpur', 'Lettland', 'Liechtenstein', 'Litháen', 'Lúxemborg', 'Malta', 'Mexíkó',
  'Moldóva', 'Norður-Írland', 'Norður-Makedónía', 'Noregur', 'Nígería', 'Pólland', 'Portúgal', 'Rúmenía', 'Rússland', 'San Marínó',
  'Serbía', 'Skotland', 'Slóvakía', 'Slóvenía', 'Spánn', 'Svartfjallaland', 'Sviss', 'Svíþjóð', 'Tékkland', 'Tyrkland', 'Úkraína',
  'Ungverjaland', 'Úrúgvæ', 'Wales', 'Þýskaland', 'Bandaríkin', 'Kanada', 'Kólumbía', 'Síle', 'Egyptaland', 'Marokkó', 'Senegal', 'Gana',
  'Kamerún', 'Ástralía', 'Suður-Kórea', 'Íran', 'Sádi-Arabía']
const TOWNS = ['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Garðabær', 'Mosfellsbær', 'Seltjarnarnes', 'Akranes', 'Borgarnes', 'Ólafsvík',
  'Ísafjörður', 'Bolungarvík', 'Sauðárkrókur', 'Siglufjörður', 'Ólafsfjörður', 'Dalvík', 'Akureyri', 'Húsavík', 'Egilsstaðir', 'Neskaupstaður',
  'Seyðisfjörður', 'Eskifjörður', 'Reyðarfjörður', 'Höfn', 'Selfoss', 'Hveragerði', 'Þorlákshöfn', 'Vestmannaeyjar', 'Grindavík',
  'Reykjanesbær', 'Sandgerði', 'Garður', 'Vogar', 'Hella', 'Hvolsvöllur', 'Vík']
const names = {
  player: [...new Set([...pool('player'), ...hver])].sort((a, b) => a.localeCompare(b, 'is')),
  club: [...new Set([...ALL_CLUBS.map((c) => c.label)])].sort((a, b) => a.localeCompare(b, 'is')),
  nation: [...new Set([...NATION_POOL, ...pool('nation')])].sort((a, b) => a.localeCompare(b, 'is')),
  town: TOWNS.sort((a, b) => a.localeCompare(b, 'is')),
  year: [],
}
for (const k of ['town'] as const) for (const label of pool(k)) if (!names[k].includes(label)) throw new Error(`${label} missing from the ${k} suggestions`)
writeFileSync(join(webDir, 'src/lib/leidin/names.json'), JSON.stringify(names) + '\n')

const bySlot = new Map<string, number>()
for (const q of questions) bySlot.set(q.slot, (bySlot.get(q.slot) ?? 0) + 1)
console.log(`${questions.length} questions`, Object.fromEntries(bySlot))
for (const q of questions) {
  const c = new Map<number, number>()
  for (const a of q.answers) c.set(a.points, (c.get(a.points) ?? 0) + 1)
  console.log(`  ${q.id.padEnd(28)} ${String(q.answers.length).padStart(4)} svör  ${[10, 25, 50, 75, 100].map((t) => `${t}:${c.get(t) ?? 0}`).join(' ')}`)
}
