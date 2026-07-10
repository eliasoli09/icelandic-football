/**
 * World Cup 2026 layer: fixtures from fixturedownload.com (open JSON feed,
 * all 104 matches incl. results), national-team Elo from eloratings.net,
 * probabilities via the site's own Elo→Poisson engine (predictMatch).
 * Display + Miðavaktin layer — completely separate from the Icelandic model.
 */
import { createClient } from '@supabase/supabase-js'
import { predictMatch } from './predict'
import { HFA } from './elo'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const SECRET = () => process.env.CRON_SECRET!

const FEED = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026'
const ELO_TSV = 'https://www.eloratings.net/World.tsv'
const ELO_NAMES = 'https://www.eloratings.net/en.teams.tsv'

/** WC 2026 hosts get real home advantage; every other venue is neutral. */
const HOSTS = new Set(['USA', 'Mexico', 'Canada'])

/** Feed team name → eloratings.net name where they differ. */
const ELO_NAME_OVERRIDES: Record<string, string> = {
  'USA': 'United States',
  'South Korea': 'South Korea',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Ivory Coast': 'Côte d’Ivoire',
  'Cape Verde': 'Cabo Verde',
  'DR Congo': 'DR Congo',
  'UAE': 'United Arab Emirates',
  'Iran': 'Iran',
  'Curacao': 'Curaçao',
}

export interface WcFeedMatch {
  MatchNumber: number
  RoundNumber: number
  DateUtc: string
  Location: string | null
  HomeTeam: string
  AwayTeam: string
  Group: string | null
  HomeTeamScore: number | null
  AwayTeamScore: number | null
  Winner: string | null
}

export const ROUND_NAMES: Record<number, string> = {
  1: 'Riðlakeppni — 1. umferð',
  2: 'Riðlakeppni — 2. umferð',
  3: 'Riðlakeppni — 3. umferð',
  4: '32-liða úrslit',
  5: '16-liða úrslit',
  6: '8-liða úrslit',
  7: 'Undanúrslit',
  8: 'Bronsleikur og úrslitaleikur',
}

/** Parse eloratings.net TSVs into name → rating. */
export function parseEloRatings(worldTsv: string, namesTsv: string): Map<string, number> {
  const codeToName = new Map<string, string>()
  for (const line of namesTsv.split('\n')) {
    const [code, name] = line.split('\t')
    if (code && name) codeToName.set(code.trim(), name.trim())
  }
  const out = new Map<string, number>()
  for (const line of worldTsv.split('\n')) {
    const cols = line.split('\t')
    if (cols.length < 4) continue
    const name = codeToName.get(cols[2]?.trim())
    const rating = Number(cols[3])
    if (name && rating > 0) out.set(name, rating)
  }
  return out
}

export function eloFor(team: string, ratings: Map<string, number>): number | null {
  return ratings.get(ELO_NAME_OVERRIDES[team] ?? team) ?? ratings.get(team) ?? null
}

/**
 * Neutral-venue probabilities: predictMatch adds HFA to the home side, so we
 * subtract it up front unless the "home" team is a real host playing at home.
 */
export function wcPredict(eloHome: number, eloAway: number, homeIsHost: boolean) {
  const adj = homeIsHost ? 0 : HFA
  return predictMatch({ home: null, away: null, eloHome: eloHome - adj, eloAway })
}

/** Pull feed + ratings, compute predictions for unplayed matches, store all. */
export async function refreshWorldCup(): Promise<{
  matches: number
  predictions: number
  missingElo: string[]
}> {
  const feed = (await (await fetch(FEED, { cache: 'no-store' })).json()) as WcFeedMatch[]
  const [worldTsv, namesTsv] = await Promise.all([
    fetch(ELO_TSV, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }).then((r) => r.text()),
    fetch(ELO_NAMES, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }).then((r) => r.text()),
  ])
  const ratings = parseEloRatings(worldTsv, namesTsv)

  const matches = feed.map((m) => ({
    id: m.MatchNumber,
    round: m.RoundNumber,
    date: m.DateUtc.replace(' ', 'T'),
    venue: m.Location,
    grp: m.Group,
    home: m.HomeTeam,
    away: m.AwayTeam,
    home_score: m.HomeTeamScore,
    away_score: m.AwayTeamScore,
    winner: m.Winner || null,
  }))

  const missingElo: string[] = []
  const preds: object[] = []
  for (const m of feed) {
    if (m.HomeTeamScore !== null) continue // played — result speaks for itself
    if (/winner|runner|loser|1[a-l]|2[a-l]|3rd/i.test(m.HomeTeam + m.AwayTeam) && !ratings.has(m.HomeTeam)) {
      // placeholder pairing (e.g. "Winner match 101") — skip until teams are known
      const eh = eloFor(m.HomeTeam, ratings)
      if (eh === null) continue
    }
    const eloHome = eloFor(m.HomeTeam, ratings)
    const eloAway = eloFor(m.AwayTeam, ratings)
    if (eloHome === null) { missingElo.push(m.HomeTeam); continue }
    if (eloAway === null) { missingElo.push(m.AwayTeam); continue }
    const p = wcPredict(eloHome, eloAway, HOSTS.has(m.HomeTeam))
    preds.push({
      match_id: m.MatchNumber,
      p_home: p.pHome, p_draw: p.pDraw, p_away: p.pAway,
      elo_home: Math.round(eloHome), elo_away: Math.round(eloAway),
    })
  }

  const { error } = await db().rpc('rpc_replace_wc', {
    p_secret: SECRET(),
    p_matches: matches,
    p_preds: preds,
  })
  if (error) throw error
  return { matches: matches.length, predictions: preds.length, missingElo: [...new Set(missingElo)] }
}

/** Map wc_matches to API-Football fixture ids (needs the paid plan). */
export async function mapWcApifIds(): Promise<{ mapped: number; unmatched: string[] }> {
  const { fetchWcFixtures, matchFixture } = await import('./apif')
  const fixtures = await fetchWcFixtures()
  if (!fixtures.length) return { mapped: 0, unmatched: ['API-Football svaraði ekki (lykill/plan?)'] }
  const { data: matches, error } = await db()
    .from('wc_matches')
    .select('id, date, home, away, apif_fixture_id')
    .is('apif_fixture_id', null)
  if (error) throw error
  const rows: { id: number; apif_fixture_id: number }[] = []
  const unmatched: string[] = []
  for (const m of matches ?? []) {
    if (/to be announced/i.test(m.home + m.away)) continue
    const fid = matchFixture(m.date, m.home, m.away, fixtures)
    if (fid) rows.push({ id: m.id, apif_fixture_id: fid })
    else unmatched.push(`${m.home}–${m.away}`)
  }
  if (rows.length) {
    const { error: e2 } = await db().rpc('rpc_set_wc_apif', { p_secret: SECRET(), p_rows: rows })
    if (e2) throw e2
  }
  return { mapped: rows.length, unmatched }
}

/** Scores-only refresh (no Elo/prediction fetch) — used by the live status route. */
export async function refreshWcScores(): Promise<number> {
  const feed = (await (await fetch(FEED, { cache: 'no-store' })).json()) as WcFeedMatch[]
  const matches = feed.map((m) => ({
    id: m.MatchNumber, round: m.RoundNumber, date: m.DateUtc.replace(' ', 'T'),
    venue: m.Location, grp: m.Group, home: m.HomeTeam, away: m.AwayTeam,
    home_score: m.HomeTeamScore, away_score: m.AwayTeamScore, winner: m.Winner || null,
  }))
  const { error } = await db().rpc('rpc_replace_wc', { p_secret: SECRET(), p_matches: matches, p_preds: [] })
  if (error) throw error
  return matches.length
}

/** ISO flag emoji for feed team names (England etc. get special flags). */
const FLAG_OVERRIDES: Record<string, string> = {
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Wales: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
}
const ISO2: Record<string, string> = {
  Mexico: 'MX', 'South Africa': 'ZA', 'South Korea': 'KR', 'Czech Republic': 'CZ', Canada: 'CA',
  'Bosnia-Herzegovina': 'BA', USA: 'US', Paraguay: 'PY', Australia: 'AU', Qatar: 'QA',
  Brazil: 'BR', Morocco: 'MA', Haiti: 'HT', Scotland: 'GB', 'Ivory Coast': 'CI', Uzbekistan: 'UZ',
  Argentina: 'AR', Algeria: 'DZ', Austria: 'AT', Jordan: 'JO', France: 'FR', Senegal: 'SN',
  England: 'GB', Croatia: 'HR', Ghana: 'GH', Panama: 'PA', Portugal: 'PT', Uruguay: 'UY',
  Colombia: 'CO', Japan: 'JP', Germany: 'DE', Curacao: 'CW', Ecuador: 'EC', Tunisia: 'TN',
  'Saudi Arabia': 'SA', Spain: 'ES', 'Cape Verde': 'CV', Belgium: 'BE', Egypt: 'EG', Iran: 'IR',
  'New Zealand': 'NZ', Netherlands: 'NL', Norway: 'NO', Switzerland: 'CH', Italy: 'IT', Turkey: 'TR',
  UAE: 'AE', 'DR Congo': 'CD', Iraq: 'IQ', Denmark: 'DK',
}
export function flag(team: string): string {
  if (FLAG_OVERRIDES[team]) return FLAG_OVERRIDES[team]
  const iso = ISO2[team]
  if (!iso) return '⚽'
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}
