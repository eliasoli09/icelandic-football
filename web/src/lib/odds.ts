/**
 * Bookmaker odds for upcoming Besta deild matches, read politely from
 * BetExplorer (robots.txt allows the league fixtures page and the
 * match-odds JSON endpoint; ~1 request per near-term fixture per run).
 * Display-only: odds never feed the prediction model.
 */
import { createClient } from '@supabase/supabase-js'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const SECRET = () => process.env.CRON_SECRET!

const BASE = 'https://www.betexplorer.com'
/** BetExplorer league slugs we track (current-season URLs). */
const LEAGUE_SLUGS = ['besta-deild-karla', 'division-1']
const fixturesUrl = (leagueSlug: string) => `${BASE}/football/iceland/${leagueSlug}/fixtures/`
const UA = 'Mozilla/5.0 (compatible; islensk-fotbolti.vercel.app; odds display)'
/** Only ask for odds this close to kickoff — books price this league late. */
const HORIZON_DAYS = 12

/** BetExplorer team slug → team name in our teams table. */
const SLUGS: Record<string, string> = {
  'fram': 'Fram',
  'ka-akureyri': 'KA',
  'kr-reykjavik': 'KR',
  'hafnarfjordur': 'FH',
  'breidablik': 'Breiðablik',
  'thor-akureyri': 'Þór',
  'valur': 'Valur',
  'ibv-vestmannaeyjar': 'ÍBV',
  'keflavik': 'Keflavík',
  'akranes': 'ÍA',
  'stjarnan': 'Stjarnan',
  'vikingur-reykjavik': 'Víkingur R.',
  // Lengjudeildin (BetExplorer: division-1)
  'aegir': 'Ægir',
  'afturelding': 'Afturelding',
  'fylkir': 'Fylkir',
  'grindavik': 'Grindavík',
  'grotta': 'Grótta',
  'ir-reykjavik': 'ÍR',
  'kopavogur': 'HK',
  'leiknir-reykjavik': 'Leiknir R.',
  'njardvik': 'Njarðvík',
  'throttur': 'Þróttur R.',
  'vestri': 'Vestri',
  'volsungur': 'Völsungur',
}

export interface BexFixture {
  bexId: string
  homeName: string
  awayName: string
  date: Date | null
}

/** Split a "{home}-{away}" slug using the known team-slug list. */
export function splitFixtureSlug(slug: string): [string, string] | null {
  for (const home of Object.keys(SLUGS)) {
    if (slug.startsWith(home + '-')) {
      const away = slug.slice(home.length + 1)
      if (away in SLUGS) return [SLUGS[home], SLUGS[away]]
    }
  }
  return null
}

/** Parse the fixtures page into fixtures with our team names and kickoff dates. */
export function parseFixtures(html: string, leagueSlug = 'besta-deild-karla'): BexFixture[] {
  const out: BexFixture[] = []
  const seen = new Set<string>()
  // rows sharing a kickoff time only carry the datetime cell on the first row
  let lastDate: Date | null = null
  const rowRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/g
  for (const [, attrs, row] of html.matchAll(rowRe)) {
    const dt = attrs.match(/data-dt="(\d+,\d+,\d+,\d+,\d+)"/)?.[1]
    const link = row.match(new RegExp(`href="/football/iceland/${leagueSlug}/([a-z0-9-]+)/([A-Za-z0-9]{8})/`))
    if (!link) continue
    const [, slug, bexId] = link
    if (seen.has(bexId)) continue
    const teams = splitFixtureSlug(slug)
    if (!teams) continue
    seen.add(bexId)
    let date: Date | null = null
    if (dt) {
      const [d, m, y, hh, mm] = dt.split(',').map(Number)
      date = new Date(Date.UTC(y, m - 1, d, hh, mm))
    } else {
      // fixtures page format: <td class="table-main__datetime">12.07. 20:00
      const t = row.match(/table-main__datetime[^>]*>\s*(\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})/)
      if (t) {
        const now = new Date()
        const [, d, m, hh, mm] = t.map(Number)
        let y = now.getUTCFullYear()
        // season wraps: a January fixture seen in December belongs to next year
        if (m < now.getUTCMonth() + 1 - 6) y++
        date = new Date(Date.UTC(y, m - 1, d, hh, mm))
      }
    }
    if (date) lastDate = date
    out.push({ bexId, homeName: teams[0], awayName: teams[1], date: date ?? lastDate })
  }
  return out
}

export interface BookmakerOdds {
  bookmaker: string
  home: number
  draw: number
  away: number
}

/**
 * Parse the match-odds JSON payload (HTML table) into per-bookmaker 1X2 odds.
 * Cells carry data-pos: 1 = home, 0 = draw, 2 = away (verified against our
 * own predictions). Rows missing any outcome are skipped — heavy favourites
 * often lack the short odds until books post the full market, and the
 * position attributes are unreliable on those partial rows.
 */
export function parseMatchOdds(oddsHtml: string): BookmakerOdds[] {
  const out: BookmakerOdds[] = []
  const POS: Record<string, 'draw' | 'home' | 'away'> = { '0': 'draw', '1': 'home', '2': 'away' }
  for (const chunk of oddsHtml.split(/<tr[ >]/).slice(1)) {
    const name = chunk.match(/in-bookmaker-logo-link[^>]*>(?:<input[^>]*>)?([^<]+)<\/a>/)
    if (!name) continue
    const cells: Partial<Record<'home' | 'draw' | 'away', number>> = {}
    for (const [, attrs] of chunk.matchAll(/<td([^>]*)>/g)) {
      const odd = attrs.match(/data-odd="([\d.]+)"/)?.[1]
      const pos = attrs.match(/data-pos="(\d)"/)?.[1]
      if (odd && pos && POS[pos]) cells[POS[pos]] = Number(odd)
    }
    if (!cells.home || !cells.draw || !cells.away) continue
    out.push({ bookmaker: name[1].trim(), home: cells.home, draw: cells.draw, away: cells.away })
  }
  return out
}

const fetchText = async (url: string, referer?: string) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      ...(referer ? { Referer: referer, 'X-Requested-With': 'XMLHttpRequest' } : {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

/**
 * Fetch odds for near-term fixtures and replace them in match_odds.
 * Failures are reported, never thrown — odds are a bonus layer on top
 * of the ingest pipeline and must not break it.
 */
export async function refreshOdds(): Promise<{
  fixturesSeen: number
  matchesUpdated: number
  rowsWritten: number
  warnings: string[]
}> {
  const warnings: string[] = []
  let fixturesSeen = 0
  let matchesUpdated = 0
  let rowsWritten = 0
  try {
    const fixtures: BexFixture[] = []
    for (const slug of LEAGUE_SLUGS) {
      try {
        fixtures.push(...parseFixtures(await fetchText(fixturesUrl(slug)), slug))
      } catch (err) {
        warnings.push(`${slug}: ${String(err)}`)
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    fixturesSeen = fixtures.length

    const { data: teamRows, error: tErr } = await db().from('teams').select('id, name')
    if (tErr) throw tErr
    const teamId = new Map(teamRows.map((t) => [t.name, t.id]))

    const { data: upcoming, error: mErr } = await db()
      .from('matches')
      .select('id, date, home_team, away_team')
      .eq('status', 'upcoming')
      .in('league', ['besta', 'lengjudeild'])
    if (mErr) throw mErr

    const now = Date.now()
    const horizon = now + HORIZON_DAYS * 86_400_000
    const near = fixtures.filter(
      (f) => f.date && f.date.getTime() > now - 86_400_000 && f.date.getTime() < horizon,
    )

    const rows: { match_id: number; bookmaker: string; home: number; draw: number; away: number }[] = []
    for (const f of near) {
      const home = teamId.get(f.homeName)
      const away = teamId.get(f.awayName)
      const match = upcoming?.find((m) => m.home_team === home && m.away_team === away)
      if (!match) {
        warnings.push(`no match for ${f.homeName}–${f.awayName}`)
        continue
      }
      try {
        const payload = JSON.parse(
          await fetchText(
            `${BASE}/match-odds/${f.bexId}/1/1x2/odds/?lang=en`,
            `${BASE}/football/iceland/x/${f.bexId}/`,
          ),
        ) as { odds?: string }
        const odds = parseMatchOdds(payload.odds ?? '')
        if (odds.length) {
          matchesUpdated++
          rows.push(...odds.map((o) => ({ match_id: match.id, ...o })))
        }
      } catch (err) {
        warnings.push(`${f.homeName}–${f.awayName}: ${String(err)}`)
      }
      await new Promise((r) => setTimeout(r, 300))
    }

    if (rows.length) {
      const { data, error } = await db().rpc('rpc_replace_match_odds', {
        p_secret: SECRET(),
        p_rows: rows,
      })
      if (error) throw error
      rowsWritten = data as number
    }
  } catch (err) {
    warnings.push(String(err))
  }
  return { fixturesSeen, matchesUpdated, rowsWritten, warnings }
}

/** Homepage links for bookmakers we know; names link out from the odds table. */
export const BOOKMAKER_URLS: Record<string, string> = {
  'bet365': 'https://www.bet365.com',
  '1xBet': 'https://1xbet.com',
  '888sport': 'https://www.888sport.com',
  'Betfair': 'https://www.betfair.com',
  'BetInAsia': 'https://betinasia.com',
  'Bets.io': 'https://bets.io',
  'Betsson': 'https://www.betsson.com',
  'Betsafe': 'https://www.betsafe.com',
  'NordicBet': 'https://www.nordicbet.com',
  'Betway': 'https://www.betway.com',
  'bwin': 'https://www.bwin.com',
  'Cloudbet': 'https://www.cloudbet.com',
  'Coolbet': 'https://www.coolbet.com',
  'Duelbits': 'https://duelbits.com',
  'Megapari': 'https://megapari.com',
  'Mozzartbet': 'https://www.mozzartbet.com',
  'Pinnacle': 'https://www.pinnacle.com',
  'Unibet': 'https://www.unibet.com',
  'William Hill': 'https://www.williamhill.com',
  'Stake': 'https://stake.com',
  'Stake.com': 'https://stake.com',
  'Roobet': 'https://roobet.com',
  'N1 Bet': 'https://n1bet.com',
  'BC.Game': 'https://bc.game',
  'Rainbet': 'https://rainbet.com',
  'Epicbet': 'https://epicbet.com/is/ithrottir/fotbolti/island',
  'Lengjan': 'https://games.lotto.is/getraunaleikir/lengjan?sport=1&country=IS',
  'Marathonbet': 'https://www.marathonbet.com',
  'Betano': 'https://www.betano.com',
  '22Bet': 'https://22bet.com',
  'GGBET': 'https://gg.bet',
  'Rabona': 'https://rabona.com',
  'LeoVegas': 'https://www.leovegas.com',
  'Parimatch': 'https://www.parimatch.com',
  '10Bet': 'https://www.10bet.com',
  'Betsamigo': 'https://betsamigo.com',
}
