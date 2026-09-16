/**
 * Builds the lineup game's matches. Every starting eleven is read from two
 * independent sources, KSÍ or Wikipedia on one side and Transfermarkt on the
 * other, and a match is written only if they agree on the date, the score and
 * all twenty-two starters with their shirt numbers. A captain's armband or a
 * goal is shown only where both sources give the same one.
 *
 * Anything that disagrees goes to review.json and its earlier copy is removed.
 *
 * Usage: cd web && npx tsx scripts/xi/build.mts [--cache DIR] [--only id]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { Side, XiMatch, XiPlayer, XiTeam } from '../../src/lib/xi/types'
import type { MatchSpec } from './matches'
import type { SourcePlayer } from './parse'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const P = await import(join(here, 'parse.ts'))
const { MATCHES } = await import(join(here, 'matches.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { parseEvents } = await import(join(webDir, 'src/lib/ksiEvents.ts'))
const { targetWord, firstName, letters } = await import(join(webDir, 'src/lib/xi/word.ts'))
const { wikiLine, tmLine } = await import(join(webDir, 'src/lib/xi/layout.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const OUT = join(webDir, 'src/lib/xi/matches')
const REVIEW = join(here, 'review.json')
const today = new Date().toISOString().slice(0, 10)
const arg = (name: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
const cacheDir = arg('--cache') ?? join(tmpdir(), 'xi-cache')
mkdirSync(cacheDir, { recursive: true })

class FetchError extends Error {}

// ── fetching, politely and honestly ────────────────────────────────────

const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; checks lineup quiz answers)'
const PAUSE: Record<string, number> = { 'www.transfermarkt.com': 3000, 'www.ksi.is': 1000, 'en.wikipedia.org': 1000 }
const last = new Map<string, number>()

async function get(url: string): Promise<string> {
  const file = join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 200))
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  const host = new URL(url).host
  const wait = (last.get(host) ?? 0) + (PAUSE[host] ?? 1000) - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last.set(host, Date.now())
  let res: Response
  try { res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }) }
  catch (err) { throw new FetchError(`${url}: ${(err as Error).message}`) }
  if (!res.ok) throw new FetchError(`${url} svaraði ${res.status}`)
  const body = await res.text()
  writeFileSync(file, body)
  return body
}

async function wiki(page: string) {
  const api = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext%7Crevid&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(page)}`
  const json = JSON.parse(await get(api))
  if (json.error) throw new Error(`Wikipedia "${page}": ${json.error.info}`)
  return {
    wikitext: json.parse.wikitext as string,
    source: { name: `en.wikipedia.org · ${String(json.parse.title).replace(/[–—]/g, '-')}`, url: `https://en.wikipedia.org/w/index.php?oldid=${json.parse.revid}` },
  }
}

// ── comparing ──────────────────────────────────────────────────────────

const tokens = (s: string) => normalise(s).split(' ').filter(Boolean)

/** Two spellings of one person: equal, same last word, or one's words all inside the other's. */
function sameName(a: string, b: string): boolean {
  const x = tokens(a), y = tokens(b)
  if (!x.length || !y.length) return false
  if (x.join(' ') === y.join(' ') || x[x.length - 1] === y[y.length - 1]) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.every((t: string) => long.includes(t))
}

/** The one starter a scorer's name belongs to: full name first, then the looser match, else nobody. */
function scorer(players: SourcePlayer[], name: string): SourcePlayer | undefined {
  const exact = players.filter((x) => [x.name, x.short ?? ''].some((n) => normalise(n) === normalise(name)))
  if (exact.length === 1) return exact[0]
  const loose = players.filter((x) => sameName(x.short ?? x.name, name) || sameName(x.name, name))
  return loose.length === 1 ? loose[0] : undefined
}

const EN: Record<string, string> = {
  'Ísland': 'Iceland', 'Argentína': 'Argentina', 'Brasilía': 'Brazil', 'Þýskaland': 'Germany',
  'Frakkland': 'France', 'QPR': 'Queens Park Rangers', 'Bayern München': 'Bayern Munich', 'Víkingur R.': 'Víkingur',
  'Tottenham': 'Tottenham Hotspur', 'Króatía': 'Croatia', 'Holland': 'Netherlands', 'Spánn': 'Spain', 'Ítalía': 'Italy',
  'Portúgal': 'Portugal', 'Austurríki': 'Austria', 'Ungverjaland': 'Hungary', 'Inter': 'Inter Milan', 'Newcastle': 'Newcastle United',
  'Atlético Madrid': 'Atletico Madrid', 'Leiknir R.': 'Leiknir',
}

function mustAgree(problems: string[], what: string) {
  if (problems.length) throw new Error(`${what}: ${problems.slice(0, 6).join('; ')}${problems.length > 6 ? ` (og ${problems.length - 6} til viðbótar)` : ''}`)
}

/** The Transfermarkt report id of the match, from a club's fixtures on that date. */
async function tmMatchId(spec: MatchSpec): Promise<number> {
  const year = Number(spec.date.slice(0, 4))
  for (const season of [year - 1, year]) {
    const html = await get(`https://www.transfermarkt.com/${spec.tm.slug}/spielplandatum/verein/${spec.tm.id}/saison_id/${season}`)
    const hit = P.parseTmFixtures(html).filter((f: { date: string }) => f.date === spec.date)
    if (hit.length === 1) return hit[0].id
    if (hit.length > 1) throw new Error(`Transfermarkt: ${hit.length} leikir ${spec.date}`)
  }
  throw new Error(`Transfermarkt: enginn leikur ${spec.date} hjá ${spec.tm.slug}`)
}

let teamColors: Map<string, string> | null = null
async function dbColor(name: string): Promise<string | undefined> {
  if (!teamColors) {
    const { data, error } = await db().from('teams').select('name,color').range(0, 9999)
    if (error) throw new FetchError(error.message)
    teamColors = new Map((data ?? []).filter((t: { color: string | null }) => t.color).map((t: { name: string; color: string }) => [normalise(t.name), t.color]))
  }
  return teamColors.get(normalise(name))
}

const ink = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62 ? '#111111' : '#ffffff'
}

interface Primary {
  date: string
  home: string
  away: string
  score: [number, number]
  extraTime?: boolean
  penalties?: [number, number]
  lineups: Record<Side, SourcePlayer[]>
  /** number → goals, per side, from this source */
  goals: Record<Side, Map<number, number>>
  kits: Partial<Record<Side, string>>
  source: { name: string; url: string }
  layout: 'wiki' | 'tm'
}

async function fromKsi(spec: MatchSpec): Promise<Primary> {
  const base = `https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${spec.ksi}`
  const report = P.parseKsiReport(await get(`${base}&banner-tab=report`))
  const events = parseEvents(await get(base))
  const goals: Primary['goals'] = { home: new Map(), away: new Map() }
  for (const e of events) {
    if (e.type !== 'goal' && e.type !== 'penalty') continue
    const p = report.lineups[e.side as Side].find((x: SourcePlayer) => x.ksiId === e.playerKsiId)
    if (p) goals[e.side as Side].set(p.number, (goals[e.side as Side].get(p.number) ?? 0) + 1)
  }
  return {
    date: report.date, home: report.home, away: report.away, score: report.score,
    // KSÍ prints no "after extra time", but a goal or card after the 90th minute shows it
    extraTime: events.some((e: { minute: number }) => e.minute > 90),
    lineups: report.lineups, goals, kits: {},
    source: { name: `ksi.is · ${report.home} - ${report.away}, ${report.competition}`, url: base },
    layout: 'tm',
  }
}

async function fromWiki(spec: MatchSpec): Promise<Primary> {
  const page = await wiki(spec.wiki!)
  const want = [EN[spec.names.home] ?? spec.names.home, EN[spec.names.away] ?? spec.names.away]
  const w = P.parseWikiMatch(page.wikitext, spec.date, (h: string, a: string) =>
    (sameName(h, want[0]) && sameName(a, want[1])) || (sameName(h, want[1]) && sameName(a, want[0])))
  const goals: Primary['goals'] = { home: new Map(), away: new Map() }
  for (const g of w.goals) {
    const p = scorer(w.lineups[g.side as Side], g.name)
    if (p) goals[g.side as Side].set(p.number, (goals[g.side as Side].get(p.number) ?? 0) + g.count)
  }
  const pens = w.penalties?.match(/(\d+)\s*[–-]\s*(\d+)/)
  return {
    date: w.date, home: w.home, away: w.away, score: w.score,
    extraTime: w.extraTime,
    penalties: pens ? [Number(pens[1]), Number(pens[2])] : undefined,
    lineups: w.lineups, goals, kits: w.kits, source: page.source, layout: 'wiki',
  }
}

async function build(spec: MatchSpec): Promise<XiMatch> {
  const primary = spec.ksi ? await fromKsi(spec) : await fromWiki(spec)
  const problems: string[] = []

  for (const side of ['home', 'away'] as Side[]) {
    const shown = EN[spec.names[side]] ?? spec.names[side]
    if (!sameName(shown, primary[side])) problems.push(`${side} er ${primary[side]} í heimild en ${spec.names[side]} í matches.ts`)
  }
  if (primary.date !== spec.date) problems.push(`dagsetning ${primary.date} í heimild, ${spec.date} í matches.ts`)
  mustAgree(problems, 'lýsing leiks')

  const tmId = await tmMatchId(spec)
  const tmReportHtml = await get(`https://www.transfermarkt.com/spielbericht/index/spielbericht/${tmId}`)
  const tmReport = P.parseTmReport(tmReportHtml)
  const tmLineups = P.parseTmLineups(await get(`https://www.transfermarkt.com/spielbericht/aufstellung/spielbericht/${tmId}`))
  const tmLines = P.parseTmLines(tmReportHtml)
  const tmFormation = P.parseTmFormation(tmReportHtml)

  // neutral venues: Transfermarkt may list the teams the other way round
  const overlap = (a: SourcePlayer[], b: SourcePlayer[]) => a.filter((p) => b.some((q) => q.number === p.number && sameName(p.name, q.name))).length
  const flipped = overlap(primary.lineups.home, tmLineups.away.players) > overlap(primary.lineups.home, tmLineups.home.players)
  type TmSide = { team: string; players: SourcePlayer[]; lines?: Map<string, string>; spots?: Map<number, { top: number; left: number }> }
  const tm: Record<Side, TmSide> = flipped
    ? { home: { ...tmLineups.away, lines: tmLines?.away, spots: tmFormation?.away }, away: { ...tmLineups.home, lines: tmLines?.home, spots: tmFormation?.home } }
    : { home: { ...tmLineups.home, lines: tmLines?.home, spots: tmFormation?.home }, away: { ...tmLineups.away, lines: tmLines?.away, spots: tmFormation?.away } }
  const orient = (x: [number, number]): [number, number] => (flipped ? [x[1], x[0]] : x)
  const tmScore = orient(tmReport.score)
  const tmPens = tmReport.penalties ? orient(tmReport.penalties) : undefined
  const tmGoals: Record<Side, Map<number, number>> = { home: new Map(), away: new Map() }
  for (const g of tmReport.goals) {
    if (g.ownGoal) continue
    const side: Side = flipped ? (g.side === 'home' ? 'away' : 'home') : g.side
    const p = scorer(tm[side].players, g.name)
    if (p) tmGoals[side].set(p.number, (tmGoals[side].get(p.number) ?? 0) + 1)
  }

  if (tmReport.date !== spec.date) problems.push(`Transfermarkt segir ${tmReport.date}`)
  if (tmScore[0] !== primary.score[0] || tmScore[1] !== primary.score[1]) problems.push(`úrslit ${primary.score.join('-')} og ${tmScore.join('-')} á Transfermarkt`)
  // KSÍ does not report shoot-outs, so a cup final decided on penalties cannot be confirmed twice
  if (Boolean(primary.penalties) !== Boolean(tmPens)) problems.push('aðeins önnur heimildin nefnir vítaspyrnukeppni')
  // a shoot-out's kicks are shown only where both count them the same
  const note = primary.penalties && tmPens
    ? primary.penalties.join() === tmPens.join()
      ? `Eftir framlengingu. Vítaspyrnukeppni ${primary.penalties.join('-')}.`
      : 'Eftir framlengingu. Réðst í vítaspyrnukeppni.'
    : primary.extraTime && tmReport.extraTime ? 'Eftir framlengingu.' : undefined

  const teams = {} as Record<Side, XiTeam>
  for (const side of ['home', 'away'] as Side[]) {
    const ours = primary.lineups[side], theirs = tm[side].players
    if (ours.length !== 11) problems.push(`${spec.names[side]}: ${ours.length} í byrjunarliði í heimild`)
    if (theirs.length !== 11) problems.push(`${spec.names[side]}: ${theirs.length} í byrjunarliði á Transfermarkt`)
    const pairs = ours.map((p) => ({ p, q: theirs.find((q) => q.number === p.number) }))
    for (const { p, q } of pairs) {
      if (!q) problems.push(`${spec.names[side]} nr. ${p.number} ${p.name} er ekki á Transfermarkt`)
      else if (!sameName(p.short ?? p.name, q.name) && !sameName(p.name, q.name) && !spec.aliases?.some(([a, b]) => normalise(a) === normalise(p.name) && normalise(b) === normalise(q.name))) {
        problems.push(`${spec.names[side]} nr. ${p.number}: ${p.name} og ${q.name}`)
      }
    }
    const gk = ours.filter((p) => p.goalkeeper), tmGk = theirs.filter((q) => q.goalkeeper)
    if (gk.length !== 1 || tmGk.length !== 1 || gk[0].number !== tmGk[0].number) problems.push(`${spec.names[side]}: markvörður ${gk.map((p) => p.number)} og ${tmGk.map((q) => q.number)}`)
    if (problems.length) continue

    const captain = ours.filter((p) => p.captain).map((p) => p.number)
    const tmCaptain = theirs.filter((q) => q.captain).map((q) => q.number)
    const agreedCaptain = captain.length === 1 && tmCaptain.length === 1 && captain[0] === tmCaptain[0] ? captain[0] : null
    const goalKey = (m: Map<number, number>) => [...m].filter(([n]) => ours.some((p) => p.number === n)).sort((a, b) => a[0] - b[0]).join(';')
    const goalsAgree = goalKey(primary.goals[side]) === goalKey(tmGoals[side])

    const placed = pairs.map(({ p, q }, index) => {
      let pos: { line: number; lateral: number }
      if (primary.layout === 'wiki') pos = wikiLine(p.position!)
      else if (tm[side].spots) {
        // the pitch graphic: lines by height, from the goalkeeper up
        const tops = [...tm[side].spots!.values()].map((s) => s.top).sort((a, b) => b - a)
        const levels: number[] = []
        for (const t of tops) if (!levels.length || levels[levels.length - 1] - t > 4) levels.push(t)
        const spot = tm[side].spots!.get(p.number)
        if (!spot) throw new Error(`${spec.names[side]} nr. ${p.number}: ekki á mynd Transfermarkt`)
        pos = { line: levels.findIndex((l) => l - spot.top <= 4 && l >= spot.top), lateral: spot.left }
      } else {
        const lines = tm[side].lines
        const group = lines ? (lines.get(q!.name) ?? [...lines].filter(([name]) => sameName(name, q!.name)).map(([, g]) => g).find((g, _, all) => all.length === 1)) : undefined
        if (!group) throw new Error(`${spec.names[side]} nr. ${p.number}: lína fannst ekki á Transfermarkt`)
        pos = tmLine(group, q!.position)
      }
      const override = spec.words?.[`${side}:${p.number}`]
      const icelandic = spec.icelandic.includes(side)
      if (icelandic && !q!.nations?.length) throw new Error(`${spec.names[side]} nr. ${p.number}: þjóðerni vantar á Transfermarkt`)
      // Icelanders are guessed by their first name, everyone else by the surname
      const fullName = primary.layout === 'wiki' ? (p.short ?? p.name) : p.name
      const word = override ?? (q!.nations?.includes('Iceland')
        ? letters(firstName(fullName), icelandic)
        : targetWord(primary.layout === 'wiki' ? p.name : (p.short ?? p.name), icelandic))
      if (word.length < 2) throw new Error(`${spec.names[side]} nr. ${p.number}: ólesanlegt orð úr ${p.name}`)
      return {
        index, pos, player: {
          number: p.number,
          name: primary.layout === 'wiki' ? (p.short ?? p.name) : p.name,
          word,
          line: pos.line,
          x: 0,
          ...(agreedCaptain === p.number ? { captain: true as const } : {}),
          ...(goalsAgree && primary.goals[side].get(p.number) ? { goals: primary.goals[side].get(p.number) } : {}),
        } satisfies XiPlayer,
      }
    })
    if (placed.filter((x) => x.pos.line === 0).length !== 1) problems.push(`${spec.names[side]}: ${placed.filter((x) => x.pos.line === 0).length} markverðir í uppstillingu`)
    // Wikipedia lists each line from right to left; show it left to right
    for (const line of new Set(placed.map((x) => x.pos.line))) {
      placed.filter((x) => x.pos.line === line)
        .sort((a, b) => a.pos.lateral - b.pos.lateral || (primary.layout === 'wiki' ? b.index - a.index : a.index - b.index))
        .forEach((x, i) => { x.player.x = i })
    }
    // a shirt colour is decoration, not an answer: without a source it is a neutral grey, never a guess
    const color = spec.colors?.[side] ?? primary.kits[side] ?? await dbColor(primary[side]) ?? '#8a94a6'
    teams[side] = {
      name: spec.names[side], color, ink: ink(color),
      icelandic: spec.icelandic.includes(side),
      players: placed.map((x) => x.player),
    }
  }
  mustAgree(problems, 'heimildir ósammála')

  return {
    id: spec.id, region: spec.region, competition: spec.competition, stage: spec.stage, date: spec.date, blurb: spec.blurb,
    score: { home: primary.score[0], away: primary.score[1], ...(note ? { note } : {}) },
    home: teams.home, away: teams.away,
    layout: primary.layout === 'wiki' ? 'Stöður í leiknum samkvæmt Wikipedia' : tmFormation ? 'Uppstilling í leiknum samkvæmt Transfermarkt' : 'Línur í leiknum samkvæmt Transfermarkt',
    sources: [primary.source, { name: `transfermarkt.com · ${tmReport.home} - ${tmReport.away}`, url: `https://www.transfermarkt.com/spielbericht/index/spielbericht/${tmId}` }],
    verifiedAt: today,
  }
}

// ── run ────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true })
const only = arg('--only')
const known = new Set(MATCHES.map((m: MatchSpec) => m.id))
for (const f of readdirSync(OUT)) if (f.endsWith('.json') && !known.has(f.slice(0, -5))) rmSync(join(OUT, f))

const shipped: string[] = []
const review: { id: string; reason: string }[] = []
for (const spec of MATCHES as MatchSpec[]) {
  if (only && spec.id !== only) continue
  const file = join(OUT, `${spec.id}.json`)
  try {
    const match = await build(spec)
    writeFileSync(file, JSON.stringify(match, null, 2) + '\n')
    shipped.push(spec.id)
    const line = (t: XiTeam) => t.players.filter((p) => p.captain || p.goals).map((p) => `${p.number}${p.captain ? 'C' : ''}${p.goals ? `⚽${p.goals}` : ''}`).join(' ')
    console.log(`✓ ${spec.id} ${match.score.home}-${match.score.away} · ${line(match.home)} | ${line(match.away)}`)
  } catch (err) {
    const reason = (err as Error).message
    review.push({ id: spec.id, reason })
    if (!(err instanceof FetchError) && existsSync(file)) rmSync(file)
    console.log(`✗ ${spec.id} - ${reason}`)
  }
}

const files = readdirSync(OUT).filter((f) => f.endsWith('.json')).sort()
const ident = (f: string) => f.slice(0, -5).replace(/[^a-z0-9]+/gi, '_')
writeFileSync(join(OUT, 'index.ts'), [
  '// Written by scripts/xi/build.mts: only matches whose two sources agreed.',
  "import type { XiMatch } from '../types'",
  ...files.map((f) => `import ${ident(f)} from './${f}'`),
  '',
  `export const MATCHES = [${files.map(ident).join(', ')}] as XiMatch[]`,
  '',
].join('\n'))
if (!only) writeFileSync(REVIEW, JSON.stringify({ builtAt: today, shipped, review }, null, 2) + '\n')
console.log(`\n${shipped.length} leikir staðfestir, ${review.length} til yfirferðar`)
