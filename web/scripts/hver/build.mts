/**
 * Builds "Hver er maðurinn?". A player's career is read from two sources, the
 * Transfermarkt transfer history and the en.wikipedia infobox, and he becomes
 * a puzzle only if they agree on every senior club, every loan and when each
 * spell began. The clues must agree too: date of birth, the line he plays in
 * and his senior national team.
 *
 * Players who disagree go to review.json with the reasons.
 *
 * Usage: cd web && npx tsx scripts/hver/build.mts [--cache DIR] [--only QID] [--limit N] [--offline]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { PoolPlayer } from './pool.mts'
import type { Agreement, CareerRow, TmClub, TmSpell, WikiSpell } from './parse'
import type { WhoPlayer } from '../../src/lib/hver/types'
import type { Level } from '../../src/lib/level'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
const P = await import(join(here, 'parse.ts'))
const { plain } = await import(join(webDir, 'scripts/topp10/wikitext.ts'))
const { normalise } = await import(join(webDir, 'src/lib/topp10/normalise.ts'))
const { cleanName, initials, nameKeys } = await import(join(webDir, 'src/lib/hver/names.ts'))

const POOL: PoolPlayer[] = JSON.parse(readFileSync(join(here, 'pool.json'), 'utf-8'))
const OUT = join(webDir, 'src/lib/hver')
const REVIEW = join(here, 'review.json')
const today = new Date().toISOString().slice(0, 10)
const thisYear = +today.slice(0, 4)
const arg = (name: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
const cacheDir = arg('--cache') ?? join(tmpdir(), 'hver-cache')
mkdirSync(cacheDir, { recursive: true })

// ── the decisions, written down ─────────────────────────────────────

/**
 * Wikipedia editions with an article: 20+ is the Euro 2016 and World Cup 2018
 * generation and the old greats, 10-19 national team players and professionals
 * abroad, fewer than 10 players known mostly at home. Split so each level has
 * enough players for weeks of daily puzzles.
 */
function levelOf(p: PoolPlayer): Level {
  if (LEVEL_OVERRIDES[p.qid]) return LEVEL_OVERRIDES[p.qid]
  return p.sitelinks >= 20 ? 'easy' : p.sitelinks >= 10 ? 'medium' : 'hard'
}
/** Players known differently in Iceland than their number of articles says. */
const LEVEL_OVERRIDES: Record<string, Level> = {
  Q1395340: 'medium', // Fróði Benjaminsen: famous in the Faroes, one season at Fram
  Q20990682: 'medium', // Höskuldur Gunnlaugsson: Breiðablik's captain and champion
  Q2634145: 'medium', // Tryggvi Guðmundsson: two decades of goals in Iceland's top league
}

/** A foreign player is an answer if Iceland knows him: three seasons here, or famous abroad. */
const FOREIGN_SEASONS = 3
const FOREIGN_FAME = 20
/** Fewer different clubs than this is not a puzzle. */
const MIN_CLUBS = 3

/** Transfermarkt and Wikipedia names for one club that share no word. */
const CLUB_ALIASES: [string, string][] = [
  ['Hafnarfjördur', 'FH'],
  ['HK Kópavogs', 'HK'],
  ['KFA', 'Austfjarða'],
  ['Aarhus GF', 'AGF'],
  ['Aalborg BK', 'AaB'],
  ['Odense BK', 'OB'],
  ['Wolves', 'Wolverhampton Wanderers'],
  ['1.FC Nuremberg', 'Nürnberg'],
  ['Boro', 'Middlesbrough'],
  ['SJZ Ever Bright', 'Shijiazhuang Ever Bright'],
  ['JS Guoxin Sainty', 'Jiangsu Sainty'],
  ['JS Suning', 'Jiangsu Suning'],
  ['WH Zall', 'Wuhan Zall'],
  ['GZ R&F', 'Guangzhou R&F'],
  ['MZ Hakka', 'Meizhou Hakka'],
  ['CQ Lifan', 'Chongqing Lifan'],
]

/**
 * Icelandic clubs as Icelanders write them, by Transfermarkt club id, so one
 * club reads the same in every career ("KR", never "KR Reykjavík" or "KR
 * Reykjavik"). A club that changed name (BÍ/Bolungarvík, now Vestri) keeps
 * Wikipedia's name for the time.
 */
const ICELANDIC_CLUB: Record<string, string> = {
  '21881': 'Afturelding', '34438': 'Ármann', '28549': 'Augnablik', '3737': 'Breiðablik', '1185': 'FH',
  '21869': 'Fjarðabyggð', '21855': 'Fjölnir', '3832': 'Fram', '2576': 'Fylkir', '7690': 'Grindavík',
  '25873': 'Grótta', '19469': 'Haukar', '11382': 'HK', '21815': 'Höttur', '82873': 'Höttur/Huginn',
  '1231': 'ÍA', '8036': 'ÍBV', '21859': 'ÍR', '1839': 'KA', '32672': 'Kári', '8037': 'Keflavík',
  '97827': 'KFA', '29366': 'KFG', '35639': 'KFK', '32354': 'KH', '3237': 'KR', '28306': 'KV',
  '36956': 'Leiftur', '21860': 'Leiknir R.', '21877': 'Njarðvík', '21879': 'Selfoss', '21875': 'Stjarnan',
  '21864': 'Þór', '9175': 'Þróttur R.', '650': 'Tindastóll', '1033': 'Valur', '5849': 'Víkingur R.',
  '12118': 'Víkingur Ó.', '28433': 'Völsungur', '28501': 'Ýmir',
  // their youth sides, where Wikipedia counts the club
  '21882': 'Afturelding', '23639': 'Breiðablik', '23646': 'FH', '21856': 'Fjölnir', '23647': 'Fram',
  '23648': 'Fylkir', '23655': 'Grindavík', '59082': 'Grótta', '49981': 'Haukar', '53082': 'HK', '22445': 'ÍA',
  '23649': 'ÍBV', '21868': 'KA', '23650': 'Keflavík', '23651': 'KR', '21861': 'Leiknir R.', '21878': 'Njarðvík',
  '21876': 'Stjarnan', '43574': 'Þór', '21886': 'Tindastóll', '21880': 'Selfoss', '23656': 'Valur',
  '42724': 'Víkingur R.', '71836': 'Völsungur',
}

const POSITION: Record<string, string> = {
  'Goalkeeper': 'Markvörður',
  'Centre-Back': 'Miðvörður',
  'Left-Back': 'Vinstri bakvörður',
  'Right-Back': 'Hægri bakvörður',
  'Defender': 'Varnarmaður',
  'Sweeper': 'Varnarmaður',
  'Defensive Midfield': 'Varnarsinnaður miðjumaður',
  'Central Midfield': 'Miðjumaður',
  'Attacking Midfield': 'Sóknarsinnaður miðjumaður',
  'Left Midfield': 'Vinstri miðjumaður',
  'Right Midfield': 'Hægri miðjumaður',
  'midfield': 'Miðjumaður',
  'Midfield': 'Miðjumaður',
  'Left Winger': 'Vinstri kantmaður',
  'Right Winger': 'Hægri kantmaður',
  'Second Striker': 'Framherji',
  'Centre-Forward': 'Miðframherji',
  'Striker': 'Sóknarmaður',
  'attack': 'Sóknarmaður',
  'Attack': 'Sóknarmaður',
}

const COUNTRY: Record<string, string> = {
  'Iceland': 'Ísland', 'Denmark': 'Danmörk', 'Faroe Islands': 'Færeyjar', 'Norway': 'Noregur', 'Sweden': 'Svíþjóð',
  'Finland': 'Finnland', 'England': 'England', 'Scotland': 'Skotland', 'Wales': 'Wales', 'Northern Ireland': 'Norður-Írland',
  'Republic of Ireland': 'Írland', 'Ireland': 'Írland', 'United States': 'Bandaríkin', 'Canada': 'Kanada', 'Jamaica': 'Jamaíka',
  'Trinidad and Tobago': 'Trínidad og Tóbagó', 'Uganda': 'Úganda', 'Latvia': 'Lettland', 'Lithuania': 'Litháen',
  'Estonia': 'Eistland', 'Serbia': 'Serbía', 'Croatia': 'Króatía', 'Bosnia-Herzegovina': 'Bosnía og Hersegóvína',
  'Bosnia and Herzegovina': 'Bosnía og Hersegóvína', 'Montenegro': 'Svartfjallaland', 'North Macedonia': 'Norður-Makedónía',
  'Macedonia': 'Norður-Makedónía', 'Slovenia': 'Slóvenía', 'Albania': 'Albanía', 'Kosovo': 'Kósovó', 'Georgia': 'Georgía',
  'Ukraine': 'Úkraína', 'Azerbaijan': 'Aserbaídsjan', 'Namibia': 'Namibía', 'Gabon': 'Gabon', 'Cameroon': 'Kamerún',
  'Ghana': 'Gana', 'Nigeria': 'Nígería', 'Sierra Leone': 'Síerra Leóne', 'Senegal': 'Senegal', 'The Gambia': 'Gambía',
  'Gambia': 'Gambía', 'Liberia': 'Líbería', 'Togo': 'Tógó', 'Zimbabwe': 'Simbabve', 'New Zealand': 'Nýja-Sjáland',
  'Philippines': 'Filippseyjar', 'Netherlands': 'Holland', 'Germany': 'Þýskaland', 'Spain': 'Spánn', 'Portugal': 'Portúgal',
  'France': 'Frakkland', 'Czech Republic': 'Tékkland', 'Czechia': 'Tékkland', 'Poland': 'Pólland', 'Hungary': 'Ungverjaland',
  'Slovakia': 'Slóvakía', 'Belgium': 'Belgía', 'Brazil': 'Brasilía', 'Guyana': 'Gvæjana', 'Puerto Rico': 'Púertó Ríkó',
  'El Salvador': 'El Salvador', 'Yugoslavia': 'Júgóslavía', 'Soviet Union': 'Sovétríkin', 'Czechoslovakia': 'Tékkóslóvakía',
  'Serbia and Montenegro': 'Serbía og Svartfjallaland', 'Kenya': 'Kenía', 'Zambia': 'Sambía', 'Mali': 'Malí',
  'Guinea': 'Gínea', 'Guinea-Bissau': 'Gínea-Bissá', "Cote d'Ivoire": 'Fílabeinsströndin', 'Ivory Coast': 'Fílabeinsströndin',
  'Burundi': 'Búrúndí', 'Rwanda': 'Rúanda', 'Tanzania': 'Tansanía', 'Malawi': 'Malaví', 'Equatorial Guinea': 'Miðbaugs-Gínea',
  'Cape Verde': 'Grænhöfðaeyjar', 'Morocco': 'Marokkó', 'Tunisia': 'Túnis', 'Algeria': 'Alsír', 'Egypt': 'Egyptaland',
  'Moldova': 'Moldóva', 'Belarus': 'Hvíta-Rússland', 'Russia': 'Rússland', 'Armenia': 'Armenía', 'Bulgaria': 'Búlgaría',
  'Romania': 'Rúmenía', 'Greece': 'Grikkland', 'Cyprus': 'Kýpur', 'Turkey': 'Tyrkland', 'Türkiye': 'Tyrkland', 'Italy': 'Ítalía',
  'Switzerland': 'Sviss', 'Austria': 'Austurríki', 'Luxembourg': 'Lúxemborg', 'Malta': 'Malta', 'Australia': 'Ástralía',
  'Japan': 'Japan', 'Korea, South': 'Suður-Kórea', 'South Korea': 'Suður-Kórea', 'China': 'Kína', 'Mexico': 'Mexíkó',
  'Argentina': 'Argentína', 'Colombia': 'Kólumbía', 'Venezuela': 'Venesúela', 'Chile': 'Síle', 'Uruguay': 'Úrúgvæ',
  'Costa Rica': 'Kosta Ríka', 'Honduras': 'Hondúras', 'Panama': 'Panama', 'Haiti': 'Haítí', 'Grenada': 'Grenada',
  'Antigua and Barbuda': 'Antígva og Barbúda', 'St. Kitts & Nevis': 'Sankti Kitts og Nevis', 'Saint Kitts and Nevis': 'Sankti Kitts og Nevis',
  'Bermuda': 'Bermúda', 'Barbados': 'Barbados', 'Guam': 'Gvam', 'Fiji': 'Fídjieyjar', 'Tahiti': 'Tahítí', 'Solomon Islands': 'Salómonseyjar',
  'Iran': 'Íran', 'Iraq': 'Írak', 'Israel': 'Ísrael', 'Palestine': 'Palestína', 'Lebanon': 'Líbanon', 'Syria': 'Sýrland',
  'Jordan': 'Jórdanía', 'Kazakhstan': 'Kasakstan', 'Uzbekistan': 'Úsbekistan', 'Thailand': 'Taíland', 'Vietnam': 'Víetnam',
  'Indonesia': 'Indónesía', 'India': 'Indland', 'Pakistan': 'Pakistan', 'Andorra': 'Andorra', 'San Marino': 'San Marínó',
  'Liechtenstein': 'Liechtenstein', 'Gibraltar': 'Gíbraltar', 'DR Congo': 'Austur-Kongó', 'Congo DR': 'Austur-Kongó',
  'Democratic Republic of the Congo': 'Austur-Kongó', 'Congo': 'Kongó', 'Angola': 'Angóla', 'Mozambique': 'Mósambík',
  'South Africa': 'Suður-Afríka', 'Sudan': 'Súdan', 'South Sudan': 'Suður-Súdan', 'Ethiopia': 'Eþíópía', 'Eritrea': 'Erítrea',
  'Somalia': 'Sómalía', 'Benin': 'Benín', 'Burkina Faso': 'Búrkína Fasó', 'Niger': 'Níger', 'Chad': 'Tjad',
  'Central African Republic': 'Mið-Afríkulýðveldið', 'Madagascar': 'Madagaskar', 'Comoros': 'Kómoreyjar', 'Mauritania': 'Máritanía',
  'Libya': 'Líbía', 'Curacao': 'Curaçao', 'Curaçao': 'Curaçao', 'Suriname': 'Súrínam', 'Aruba': 'Arúba', 'Cuba': 'Kúba',
  'Dominican Republic': 'Dóminíska lýðveldið', 'Guatemala': 'Gvatemala', 'Nicaragua': 'Níkaragva', 'Bolivia': 'Bólivía',
  'Peru': 'Perú', 'Ecuador': 'Ekvador', 'Paraguay': 'Paragvæ',
}
const countryIs = (name: string) => COUNTRY[name.replace(/ national (?:football|soccer) team$/i, '').trim()]

// ── fetching, politely and honestly ────────────────────────────────────

const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; checks player quiz answers)'
const PAUSE: Record<string, number> = { 'www.transfermarkt.com': 5000, 'en.wikipedia.org': 1000 }
/** only what is already in the cache; a player not fetched yet is left out */
const offline = process.argv.includes('--offline')
class NotCached extends Error {}
const last = new Map<string, number>()
const cacheFile = (key: string) => join(cacheDir, key.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 200))

async function get(url: string): Promise<string> {
  const file = cacheFile(url)
  if (existsSync(file)) return readFileSync(file, 'utf-8')
  if (offline) throw new NotCached(url)
  const host = new URL(url).host
  let res: Response
  // a refusal means slow down: wait it out, never work around it
  for (let attempt = 0; ; attempt++) {
    const wait = (last.get(host) ?? 0) + (PAUSE[host] ?? 1000) - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last.set(host, Date.now())
    res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } })
    if ((res.status !== 403 && res.status !== 429) || attempt === 3) break
    console.log(`${host} svaraði ${res.status}, bíð ${10 * 2 ** attempt} mínútur`)
    await new Promise((r) => setTimeout(r, 10 * 2 ** attempt * 60_000))
  }
  if (!res.ok) throw new Error(`${url} svaraði ${res.status}`)
  const body = await res.text()
  writeFileSync(file, body)
  return body
}

interface WikiPage { title: string; revid: number; wikitext: string }

/** Articles fifty at a time, each kept in the cache under its requested title. */
async function wikiPages(titles: string[]): Promise<Map<string, WikiPage | null>> {
  const out = new Map<string, WikiPage | null>()
  const missing = titles.filter((t) => {
    const f = cacheFile(`wiki-${t}`)
    if (existsSync(f)) out.set(t, JSON.parse(readFileSync(f, 'utf-8')))
    return !existsSync(f)
  })
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content%7Cids&rvslots=main&format=json&formatversion=2&redirects=1&titles=${batch.map(encodeURIComponent).join('%7C')}`
    const wait = (last.get('en.wikipedia.org') ?? 0) + 1000 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last.set('en.wikipedia.org', Date.now())
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Wikipedia svaraði ${res.status}`)
    const json = await res.json()
    const rename = new Map<string, string>()
    for (const n of json.query.normalized ?? []) rename.set(n.to, n.from)
    for (const r of json.query.redirects ?? []) rename.set(r.to, rename.get(r.from) ?? r.from)
    for (const page of json.query.pages) {
      const asked = rename.get(page.title) ?? page.title
      const rev = page.revisions?.[0]
      const value = rev ? { title: page.title, revid: rev.revid, wikitext: rev.slots.main.content } : null
      out.set(asked, value)
      writeFileSync(cacheFile(`wiki-${asked}`), JSON.stringify(value))
    }
  }
  return out
}

// ── building ─────────────────────────────────────────────────────────

const only = arg('--only')
const limit = arg('--limit') ? Number(arg('--limit')) : Infinity
const candidates = POOL.filter((p) => p.enwiki && (!only || p.qid === only)).slice(0, limit)
const pages = await wikiPages(candidates.map((p) => p.enwiki!))

const players: WhoPlayer[] = []
const review: { qid: string; name: string; problems: string[] }[] = []
const skipped: Record<string, number> = {}
const pairs = new Map<string, number>()
const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1 }

/** Icelandic clubs whose name is part of another's: the Wikipedia name must say which. */
const NAMESAKES: Record<string, { must?: string; not?: string[] }> = {
  '5849': { not: ['olafsvik', 'gota'] },
  '12118': { must: 'olafsvik' },
  '21860': { not: ['faskrudsfjordur', 'faskrudsfirdi'] },
  '9175': { not: ['vogum', 'vogar', 'neskaupstad'] },
  '1033': { not: ['reydarfjordur', 'reydarfirdi'] },
  // GG is Grindavík's second club, not Grindavík
  '54140': { must: 'gg' },
  '7690': { not: ['gg'] },
}

const clubNames = (c: TmClub) => [P.seniorName(c.name), c.slug.replace(/-/g, ' ').replace(/\b(?:u\d{2}|yth|youth|res|reserves|ii)\b/g, ' ')]
function sameClub(tm: TmClub, w: WikiSpell): boolean {
  const wikiNames = [w.club, ...(w.target ? [w.target] : [])]
  const namesake = NAMESAKES[tm.id]
  if (namesake) {
    const said = normalise(wikiNames.join(' ')).split(' ')
    if (namesake.must && !said.includes(namesake.must)) return false
    if (namesake.not?.some((word) => said.includes(word))) return false
  }
  return clubNames(tm).some((a) => wikiNames.some((b) => P.sameClubName(a, b)
    || CLUB_ALIASES.some(([x, y]) => normalise(x) === normalise(a) && P.sameClubName(y, b))))
}

/**
 * How a club reads in a career: an Icelandic club as Icelanders write it, else
 * Wikipedia's label, or the article it links to when the label is misspelt
 * ("Konsvinger" linking to Kongsvinger IL).
 */
function clubLabel(r: CareerRow): string {
  if (r.iceland && ICELANDIC_CLUB[r.tm.id]) return ICELANDIC_CLUB[r.tm.id]
  const label = r.club.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const labelFits = clubNames(r.tm).some((a) => P.sameClubName(a, label) || CLUB_ALIASES.some(([x, y]) => normalise(x) === normalise(a) && P.sameClubName(y, label)))
  return !labelFits && r.target ? r.target.replace(/\s*\([^)]*\)\s*$/, '').trim() : label
}

let n = 0
for (const p of candidates) {
  if (++n % 25 === 0) console.log(`${n}/${candidates.length}: ${players.length} staðfestir, ${review.length} í yfirferð`)
  const page = pages.get(p.enwiki!)
  const params = page ? P.infobox(page.wikitext) : null
  if (!page || !params) { skip('engin upplýsingabox'); continue }
  let wiki: WikiSpell[]
  try { wiki = P.wikiCareer(params) } catch (err) { review.push({ qid: p.qid, name: p.label, problems: [`Wikipedia: ${(err as Error).message}`] }); continue }
  if (new Set(wiki.map((w) => normalise(w.club))).size < MIN_CLUBS) { skip('færri en 3 félög'); continue }
  let name = cleanName(p.icelandic ? p.label : page.title)

  const problems: string[] = []
  let transfers
  try { transfers = JSON.parse(await get(`https://www.transfermarkt.com/ceapi/transferHistory/list/${p.tm}`)) }
  catch (err) {
    if (err instanceof NotCached) { skip('ekki sótt enn'); continue }
    review.push({ qid: p.qid, name, problems: [`Transfermarkt: ${(err as Error).message}`] }); continue
  }
  const tm: TmSpell[] = P.tmSpells(P.tmMoves(transfers))
  // leaving a club Wikipedia calls his youth club, before any known start: that was youth football
  const youthClubs = [...params].filter(([k]) => /^youthclubs\d+$/.test(k)).map(([, v]) => plain(v)).filter(Boolean)
  for (const t of tm) if (!t.from && youthClubs.some((y: string) => sameClub(t.club, { club: y, target: null, from: 0, to: null, loan: false }))) t.optional = true
  const agreed: Agreement = P.agreeCareers(wiki, tm, sameClub)
  problems.push(...agreed.problems)
  if (problems.length) { review.push({ qid: p.qid, name, problems }); continue }

  if (!p.icelandic) {
    const seasons = agreed.rows.filter((r) => r.iceland).reduce((sum, r) => sum + (r.to ?? thisYear) - r.from + 1, 0)
    if (seasons < FOREIGN_SEASONS && p.sitelinks < FOREIGN_FAME) { skip('erlendur, of stutt á Íslandi'); continue }
  }

  let profileHtml: string
  try { profileHtml = await get(`https://www.transfermarkt.com/x/profil/spieler/${p.tm}`) }
  catch (err) { if (err instanceof NotCached) { skip('ekki sótt enn'); continue } throw err }
  const profile = P.tmProfile(profileHtml)
  if (p.icelandic) name = P.respell(name, profile.home ? cleanName(profile.name) : null, cleanName(page.title))
  const nameWords = nameKeys(name).flatMap((k: string) => k.split(' '))
  if (!nameKeys(profile.name).concat(nameKeys(profile.headline)).some((k: string) => k.split(' ').some((w) => w.length > 2 && nameWords.includes(w)))) {
    problems.push(`nafn: Transfermarkt "${profile.name}" og "${name}"`)
  }
  const wikiBorn = P.wikiBirth(params)
  if (!profile.born || profile.born !== wikiBorn) problems.push(`fæðingardagur: Transfermarkt ${profile.born}, Wikipedia ${wikiBorn}`)
  const position = profile.position ? POSITION[profile.position] : undefined
  if (!position) problems.push(`staða Transfermarkt óþekkt: "${profile.position}"`)
  else {
    const wikiLines = P.linesOf(plain(params.get('position') ?? ''))
    if (![...P.tmLines(profile.position!)].some((l) => wikiLines.has(l))) {
      problems.push(`staða: Transfermarkt "${profile.position}", Wikipedia "${plain(params.get('position') ?? '')}"`)
    }
  }
  const tmSenior = profile.international && !P.isYouthTeam(profile.international) ? profile.international : null
  const wikiSenior: string[] = P.wikiNationalTeams(params)
  let national: string | null = null
  if (tmSenior) {
    national = countryIs(tmSenior) ?? null
    if (!national) problems.push(`land óþekkt: "${tmSenior}"`)
    else if (!wikiSenior.some((t: string) => countryIs(t) === national)) problems.push(`landslið: Transfermarkt ${tmSenior}, Wikipedia ${wikiSenior.join(', ') || 'ekkert'}`)
  } else if (wikiSenior.length) problems.push(`landslið: Transfermarkt ekkert A-landslið, Wikipedia ${wikiSenior.join(', ')}`)
  if (problems.length) { review.push({ qid: p.qid, name, problems }); continue }

  for (const [a, b] of agreed.pairs) pairs.set(`${a} = ${b}`, (pairs.get(`${a} = ${b}`) ?? 0) + 1)
  const accept = [...new Set([name, plain(params.get('name') ?? ''), page.title, profile.name, profile.headline, p.enLabel ?? '', p.label].flatMap((x) => x ? nameKeys(cleanName(x)) : []))]
  players.push({
    id: p.qid,
    level: levelOf(p),
    region: p.icelandic ? 'island' : 'erlendis',
    name,
    accept,
    career: agreed.rows.map((r) => ({ from: r.from, to: r.to, club: clubLabel(r), loan: r.loan })),
    hints: { position: position!, born: +profile.born!.slice(0, 4), national, initials: initials(name) },
    sources: [
      { name: 'Transfermarkt', url: `https://www.transfermarkt.com/x/profil/spieler/${p.tm}` },
      { name: `en.wikipedia.org · ${page.title}`, url: `https://en.wikipedia.org/w/index.php?oldid=${page.revid}` },
    ],
    verifiedAt: today,
  })
}

if (!only && limit === Infinity) {
  players.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  writeFileSync(join(OUT, 'players.json'), JSON.stringify(players) + '\n')
  // answers first, so their spelling wins over another spelling of the same name
  const seen = new Set<string>()
  const names = [...players.map((p) => p.name), ...POOL.map((p) => cleanName(p.icelandic || !p.enwiki ? p.label : p.enwiki))]
    .filter((x) => /\s/.test(x) && !seen.has(normalise(x)) && seen.add(normalise(x)))
    .sort((a, b) => a.localeCompare(b, 'is'))
  writeFileSync(join(OUT, 'names.json'), JSON.stringify(names) + '\n')
  writeFileSync(REVIEW, JSON.stringify(review, null, 1) + '\n')
  writeFileSync(join(here, 'club-pairs.txt'), [...pairs].sort().map(([k, v]) => `${v}\t${k}`).join('\n') + '\n')
}
const by = (level: Level) => players.filter((x) => x.level === level).length
console.log(`${players.length} staðfestir (${by('easy')} léttir, ${by('medium')} miðlungs, ${by('hard')} erfiðir; ${players.filter((x) => x.region === 'island').length} íslenskir), ${review.length} í yfirferð`)
console.log('sleppt:', skipped)
if (only) console.log(JSON.stringify(players[0] ?? review[0], null, 1))
