/**
 * The greatest sides in the history of Iceland's top division, for "Reyndu að
 * verða bikarmeistari". Every champion since 1986 (the first season whose KSÍ
 * match reports carry line-ups) is scored on what can be checked:
 *
 * - the title itself: en.wikipedia's season-by-season list against the
 *   finishing positions table on is.wikipedia
 * - the league record: points and goal difference per game (three points a
 *   win in every era) and the margin over the runner-up, from our results, and
 *   the champion's own record confirmed match by match against KSÍ reports
 * - a cup double: en.wikipedia's list of finals by club against is.wikipedia's
 * - Europe that summer: ties won and the furthest stage reached, from
 *   en.wikipedia's record of Icelandic clubs in European competitions
 *
 * Writes scripts/bikar/teams.json. Usage: cd web && npx tsx scripts/bikar/teams.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const W = await import(join(webDir, 'scripts/topp10/wikitext.ts'))
const { CLUBS } = await import(join(webDir, 'scripts/topp10/names.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { parseKsiReport } = await import(join(webDir, 'scripts/xi/parse.ts'))
const { db } = await import(join(webDir, 'src/lib/db.ts'))

export const FIRST = 1986
/** is.wikipedia's season table ends here */
export const LAST = 2024
const cacheDir = join(tmpdir(), 'bikar-cache')
mkdirSync(cacheDir, { recursive: true })

const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; cup game)'
const PAUSE: Record<string, number> = { 'www.ksi.is': 1000, 'en.wikipedia.org': 1000, 'is.wikipedia.org': 1000 }
const last = new Map<string, number>()
export async function get(url: string): Promise<string> {
  const file = join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 200))
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  const host = new URL(url).host
  const wait = (last.get(host) ?? 0) + (PAUSE[host] ?? 5000) - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last.set(host, Date.now())
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`${url} svaraði ${res.status}`)
  const body = await res.text()
  writeFileSync(file, body)
  return body
}
async function wiki(lang: 'en' | 'is', page: string) {
  const json = JSON.parse(await get(`https://${lang}.wikipedia.org/w/api.php?action=parse&prop=wikitext%7Crevid&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(page)}`))
  if (json.error) throw new Error(`${lang}.wikipedia "${page}": ${json.error.info}`)
  return { wikitext: json.parse.wikitext as string, source: { name: `${lang}.wikipedia.org · ${json.parse.title}`, url: `https://${lang}.wikipedia.org/w/index.php?oldid=${json.parse.revid}` } }
}

/** A club name from any source, as our own id; a name we do not know stops the build. */
function clubId(name: string): string {
  const key = normalise(name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/ men'?s football$/i, ''))
  for (const c of CLUBS) {
    if ([c.label, ...c.names, ...(c.extra ?? [])].some((n) => normalise(n) === key)) return c.id
  }
  const extra: Record<string, string> = {
    'knattspyrnufelag reykjavikur': 'kr', 'knattspyrnufelagid fram': 'fram', 'ithrottabandalag akraness': 'ia',
    'knattspyrnudeild keflavik': 'keflavik', 'knattspyrnufelagid vikingur': 'vikingur', 'knattspyrnufelag akureyrar': 'ka',
    'ibv': 'ibv', 'ib vestmannaeyja': 'ibv', 'ibk': 'keflavik', 'ib keflavik': 'keflavik', 'valur': 'valur',
    'fimleikafelag hafnarfjardar': 'fh', 'ungmennafelagid stjarnan': 'stjarnan', 'stjarnan': 'stjarnan',
    'breidablik': 'breidablik', 'fh': 'fh', 'ka': 'ka', 'ia': 'ia', 'kr': 'kr', 'fram': 'fram', 'vikingur': 'vikingur',
    'keflavik': 'keflavik', 'fylkir': 'fylkir', 'ibv vestmannaeyjar': 'ibv',
  }
  if (extra[key]) return extra[key]
  throw new Error(`óþekkt félag: "${name}"`)
}
export const clubLabel = (id: string) => CLUBS.find((c: { id: string }) => c.id === id)?.label ?? id

function mustAgree(problems: string[], what: string) {
  if (problems.length) throw new Error(`${what}: ${problems.slice(0, 10).join('; ')}`)
}

// ── champions ────────────────────────────────────────────────────────

const enLeague = await wiki('en', 'Besta deild karla')
const isLeague = await wiki('is', 'Besta deild karla')

const enChampions = new Map<number, string>()
for (const m of enLeague.wikitext.matchAll(/^\*\s*(?:\[\[[^\]|]*\|)?(\d{4})(?:\]\])?\s*:\s*(.+)$/gm)) {
  const year = +m[1]
  if (year < FIRST || year > LAST) continue
  enChampions.set(year, clubId(W.plain(m[2]).replace(/\s*\(.*$/, '').replace(/\*+$/, '').trim()))
}

// is.wikipedia's season table: champion and points, runner-up and points, a row a season
interface IsSeason { champion: string; points: number; runnerUp: string; runnerUpPoints: number }
const isSeasons = new Map<number, IsSeason>()
{
  const template = (t: string) => clubId(t.replace(/^Lið\s+/, '').replace(/\s+(Reykjavík|Akranes|Keflavík|Akureyri|Hafnarfjörður|Vestmannaeyjar)$/, '').replace(/^ÍBK$/, 'Keflavík'))
  for (const m of isLeague.wikitext.matchAll(/^\|''\[\[[^\]|]*\|(\d{4})\]\]''\s*\|\|\s*\d+\s*\|\|[^|]*\|\|\s*''\{\{([^}]+)\}\}\s*\(\d+\)''\s*\|\|\s*(\d+)\s*\|\|\s*\{\{([^}]+)\}\}\s*\|\|\s*(\d+)/gm)) {
    isSeasons.set(+m[1], { champion: template(m[2]), points: +m[3], runnerUp: template(m[4]), runnerUpPoints: +m[5] })
  }
}
const isChampions = new Map([...isSeasons].map(([y, s]) => [y, s.champion]))
// ── cup winners ──────────────────────────────────────────────────────

function cupYears(rows: string[][], clubCol: number, titlesCol: number, yearsCol: number) {
  const out = new Map<number, string>()
  for (const r of rows) {
    const titles = Number(W.plain(r[titlesCol] ?? ''))
    if (!Number.isInteger(titles) || titles === 0) continue
    const id = clubId(W.plain(r[clubCol]).replace(/\s*\+$/, ''))
    const years = [...W.plain(r[yearsCol] ?? '').matchAll(/\b(?:19|20)\d{2}\b/g)].map((x) => +x[0])
    if (years.length !== titles) throw new Error(`bikar ${id}: ${titles} titlar en ${years.length} ártöl`)
    for (const y of years) out.set(y, id)
  }
  return out
}
const enCup = await wiki('en', "Icelandic Men's Football Cup")
const isCup = await wiki('is', 'Bikarkeppni karla í knattspyrnu')
const cupA = cupYears(W.dataRows(W.tableAfter(enCup.wikitext, '==Performance by club==')), 0, 1, 2)
const cupB = cupYears(W.dataRows(W.tableAfter(isCup.wikitext, '=== Sigrar í úrslitaleikjum')), 0, 1, 2)
{
  const problems: string[] = []
  for (let y = FIRST; y <= LAST; y++) if (cupA.get(y) !== cupB.get(y)) problems.push(`${y}: ${cupA.get(y)} og ${cupB.get(y)}`)
  mustAgree(problems, 'bikarmeistarar')
}

// ── Europe ───────────────────────────────────────────────────────────

interface Tie { season: string; club: string; round: string; opponent: string; aggregate: string; through: boolean }
const europe = await wiki('en', 'Icelandic football clubs in European competitions')
const ties: Tie[] = []
{
  const sections = europe.wikitext.split(/^==\s*([^=]+?)\s*==\s*$/m)
  for (let i = 1; i < sections.length; i += 2) {
    const competition = sections[i].trim()
    if (/references/i.test(competition)) continue
    const start = sections[i + 1].indexOf('{|')
    if (start < 0) continue
    // rowspans are spread onto every row they cover
    for (const row of W.wikitableRows(sections[i + 1].slice(start))) {
      if (row.every((c: { header: boolean }) => c.header) || row.length < 8) continue
      const [seasonCell, teamCell, roundCell, opponentCell, , , aggregateCell, resultCell] = row.map((c: { text: string }) => c.text)
      const season = W.plain(seasonCell).match(/\d{4}–\d{2}/)?.[0]
      if (!season) continue
      let club: string
      try { club = clubId(W.plain(teamCell)) } catch { continue }
      ties.push({
        season, club, round: `${competition}: ${W.plain(roundCell)}`, opponent: W.plain(opponentCell),
        aggregate: W.plain(aggregateCell), through: /Symbol keep vote/.test(resultCell),
      })
    }
  }
  if (ties.length < 100) throw new Error(`aðeins ${ties.length} Evrópueinvígi lesin`)
}

// ── league records ───────────────────────────────────────────────────

const { data: teamRows } = await db().from('teams').select('id, name')
const teamName = new Map<number, string>((teamRows ?? []).map((t: { id: number; name: string }) => [t.id, t.name]))
/** a club our lists know by its id; any other (Víðir, Leiftur…) by its own name, which is only ever compared with itself */
const tableId = (teamId: number) => { const name = teamName.get(teamId)!; try { return clubId(name) } catch { return `db:${normalise(name)}` } }

interface Rec { w: number; d: number; l: number; gf: number; ga: number; games: number; points: number }
const blank = (): Rec => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, games: 0, points: 0 })
const sameRecord = (a: Rec, b: Rec) => a.w === b.w && a.d === b.d && a.l === b.l && a.gf === b.gf && a.ga === b.ga

/** The season's table on en.wikipedia, whole-season totals for every club (after a split, the half that holds them). */
async function enTable(y: number): Promise<Map<string, Rec>> {
  const page = await wiki('en', y >= 2022 ? `${y} Besta deild karla` : `${y} Úrvalsdeild`)
  let tables = W.sportsTables(page.wikitext)
  const template = page.wikitext.match(/\{\{\s*(\d{4}[ _](?:Úrvalsdeild|Besta[ _]deild[ _]karla)[ _]table)\s*\}\}/)
  if (!tables.length && template) tables = W.sportsTables((await wiki('en', `Template:${template[1].replace(/_/g, ' ')}`)).wikitext)
  const out = new Map<string, Rec>()
  for (const args of tables) {
    for (const r of W.readSportsTable(args)) {
      let id: string
      try { id = clubId(r.name) } catch { continue }
      const rec = { w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, games: r.w + r.d + r.l, points: r.pts }
      if ((out.get(id)?.games ?? -1) < rec.games) out.set(id, rec)
    }
  }
  if (out.size < 8) throw new Error(`${y}: tafla en.wikipedia fannst ekki`)
  return out
}

// candidates: every champion, and every side whose European summer reached a group or league phase
const EUROPE_STAGE = /group stage|league phase|league stage|knockout|round of 16|first round|second round/i
const candidates = new Map<string, { year: number; club: string }>()
for (let y = FIRST; y <= LAST; y++) candidates.set(`${y}:${enChampions.get(y)}`, { year: y, club: enChampions.get(y)! })
for (const t of ties) {
  const y = +t.season.slice(0, 4)
  if (y < FIRST || y > LAST) continue
  // a group or league phase reached, or a main-draw round won (every 1980s entrant started in the first round)
  const main = EUROPE_STAGE.test(t.round.split(': ')[1] ?? '') && !/qualif|preliminary/i.test(t.round)
  if (main && (t.through || /group|league phase|league stage|knockout|round of 16/i.test(t.round))) candidates.set(`${y}:${t.club}`, { year: y, club: t.club })
}

const teams = []
const review: string[] = []
const matchesBySeason = new Map<number, { id: number; home_team: number; away_team: number; home_goals: number; away_goals: number }[]>()
for (const { year: y, club } of [...candidates.values()].sort((a, b) => a.year - b.year)) {
  if (!matchesBySeason.has(y)) {
    const { data, error } = await db().from('matches').select('id, home_team, away_team, home_goals, away_goals')
      .eq('league', 'besta').eq('season', y).eq('status', 'played')
    if (error || !data?.length) throw new Error(`${y}: engin úrslit (${error?.message})`)
    matchesBySeason.set(y, data)
  }
  const matches = matchesBySeason.get(y)!
  const champion = enChampions.get(y) === club

  // source 1: every KSÍ report of the club's matches
  const ksi = blank(), reportIds: number[] = []
  for (const m of matches.filter((m) => tableId(m.home_team) === club || tableId(m.away_team) === club)) {
    const html = await get(`https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${m.id}&banner-tab=report`)
    // a few reports have the score but no line-ups; the record needs only the score
    const sc = html.match(/<h1[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/h1>/)
    if (!sc) throw new Error(`KSÍ-skýrsla ${m.id} án úrslita`)
    const home = tableId(m.home_team) === club
    const gf = +sc[home ? 1 : 2], ga = +sc[home ? 2 : 1]
    ksi.games++; ksi.gf += gf; ksi.ga += ga
    if (gf > ga) { ksi.w++; ksi.points += 3 } else if (gf === ga) { ksi.d++; ksi.points++ } else ksi.l++
    reportIds.push(m.id)
  }
  // source 2: en.wikipedia's season table; source 3 for champions: is.wikipedia's points
  const en = await enTable(y)
  const enRec = en.get(club)
  const isPoints = champion ? isSeasons.get(y)!.points : null
  let record: Rec | null = null, basis = ''
  if (enRec && sameRecord(ksi, enRec)) { record = { ...enRec }; basis = 'KSÍ og en.wikipedia' }
  else if (enRec && isPoints !== null && enRec.points === isPoints) { record = { ...enRec }; basis = 'en.wikipedia og is.wikipedia (KSÍ-skýrslur víkja frá)' }
  if (!record) {
    review.push(`${y} ${clubLabel(club)}: KSÍ ${ksi.w}-${ksi.d}-${ksi.l} ${ksi.gf}:${ksi.ga} (${ksi.points}), en.wikipedia ${enRec ? `${enRec.w}-${enRec.d}-${enRec.l} ${enRec.gf}:${enRec.ga} (${enRec.points})` : 'vantar'}${isPoints !== null ? `, is.wikipedia ${isPoints} stig` : ''}`)
    console.log(`${y} ${clubLabel(club)}: í yfirferð`)
    continue
  }
  // the best other side's points, from the same table
  const others = [...en].filter(([id]) => id !== club).map(([, r]) => r.points)
  const bestOther = Math.max(...others)
  const cupDouble = cupA.get(y) === club
  const summer = `${y}–${String((y + 1) % 100).padStart(2, '0')}`
  const euro = ties.filter((t) => t.club === club && t.season === summer)
  const position = 1 + others.filter((pts) => pts > record!.points).length
  teams.push({ year: y, club, label: clubLabel(club), champion, position, record, basis, bestOther, cupDouble, europe: euro, reportIds })
  console.log(`${y} ${clubLabel(club)}${champion ? ' (meistari)' : ` (${position}. sæti)`}: ${record.w}-${record.d}-${record.l}, ${record.gf}:${record.ga}${cupDouble ? ', tvenna' : ''}${euro.length ? `, Evrópa: ${euro.map((t) => `${t.round.split(': ')[1]} ${t.through ? '✓' : '✗'}`).join(' / ')}` : ''} [${basis}]`)
}

writeFileSync(join(here, 'teams.json'), JSON.stringify({
  sources: [enLeague.source, isLeague.source, enCup.source, isCup.source, europe.source],
  teams,
  review,
}, null, 1) + '\n')
console.log(`${teams.length} lið staðfest, ${review.length} í yfirferð`)
