/**
 * Live games from API-American-Football (api-sports.io): parsing its replies,
 * matching them to our schedule, and our own live win probability. Pure; the
 * route /api/nfl/live does the fetching.
 */

export const API_SPORTS_BASE = 'https://v1.american-football.api-sports.io'
export const NFL_LEAGUE = 1
/** A game counts as possibly live from kickoff until this long after it. */
export const LIVE_WINDOW_MS = 4.5 * 3600 * 1000

export interface LiveGame {
  apiId: number
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string
  /** 1-4, 5 for overtime; null before kickoff, at half time and after the game. */
  quarter: number | null
  /** Time left in the quarter, "MM:SS", when the feed gives it. */
  clock: string | null
  live: boolean
  final: boolean
}

export interface LiveEvent { quarter: string; minute: string | null; team: string; player: string | null; type: string; comment: string; homeScore: number | null; awayScore: number | null }

const QUARTER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4, OT: 5 }
const FINAL = new Set(['FT', 'AOT'])
const LIVE = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT'])

export const STATUS_LABEL: Record<string, string> = {
  NS: 'Ekki hafinn', Q1: '1. leikhluti', Q2: '2. leikhluti', HT: 'Hálfleikur', Q3: '3. leikhluti', Q4: '4. leikhluti',
  OT: 'Framlenging', FT: 'Lokið', AOT: 'Lokið eftir framlengingu', CANC: 'Aflýst', PST: 'Frestað', SUSP: 'Hlé',
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null)
const total = (s: unknown): number | null => (typeof s === 'number' ? s : s && typeof s === 'object' ? num((s as Record<string, unknown>).total) : null)

/** The games of a /games reply; anything that does not look like a game is skipped, not fatal. */
export function parseGames(json: unknown): LiveGame[] {
  const rows = (json as { response?: unknown[] })?.response
  if (!Array.isArray(rows)) return []
  const out: LiveGame[] = []
  for (const r of rows as Record<string, any>[]) {
    const g = r?.game ?? {}
    const status = String(g?.status?.short ?? '')
    const home = r?.teams?.home?.name, away = r?.teams?.away?.name
    if (typeof g?.id !== 'number' || typeof home !== 'string' || typeof away !== 'string') continue
    const timer = typeof g?.status?.timer === 'string' && /^\d{1,2}:\d{2}$/.test(g.status.timer) ? g.status.timer : null
    out.push({
      apiId: g.id, home, away,
      homeScore: total(r?.scores?.home), awayScore: total(r?.scores?.away),
      status,
      quarter: QUARTER[status] ?? null,
      clock: timer,
      live: LIVE.has(status),
      final: FINAL.has(status),
    })
  }
  return out
}

/** Scoring plays and other events of a /games/events reply. */
export function parseEvents(json: unknown): LiveEvent[] {
  const rows = (json as { response?: unknown[] })?.response
  if (!Array.isArray(rows)) return []
  return (rows as Record<string, any>[]).filter((e) => e && typeof e.type === 'string').map((e) => ({
    quarter: String(e.quarter ?? ''), minute: e.minute != null ? String(e.minute) : null,
    team: String(e.team?.name ?? ''), player: e.player?.name ?? null, type: String(e.type), comment: String(e.comment ?? ''),
    homeScore: num(e.score?.home), awayScore: num(e.score?.away),
  }))
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** api-sports names clubs in full ("Kansas City Chiefs"); so do we. Unknown names give null. */
export function teamAbbr(name: string, teams: { abbr: string; name: string }[]): string | null {
  const n = norm(name)
  return teams.find((t) => norm(t.name) === n)?.abbr ?? null
}

/** Games that may be under way now by our own schedule: no request goes out otherwise. */
export function liveWindow<G extends { kickoff: string; home_score: number | null; away_score: number | null }>(games: G[], now: Date): G[] {
  const t = now.getTime()
  return games.filter((g) => {
    const k = new Date(g.kickoff).getTime()
    return k <= t && t - k <= LIVE_WINDOW_MS && (g.home_score === null || g.away_score === null)
  })
}

/** The US Eastern date of a kickoff, which is how api-sports dates games (EST is close enough for kickoff times). */
export const easternDate = (kickoffIso: string) => new Date(new Date(kickoffIso).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)

/** Fraction of regulation left: 1 at kickoff, 0 at the end of the fourth quarter. */
export function fractionLeft(quarter: number | null, clock: string | null, status: string): number {
  if (status === 'NS') return 1
  if (status === 'HT') return 0.5
  if (FINAL.has(status)) return 0
  if (!quarter) return 0.5
  if (quarter >= 5) return 0.05 // overtime: next score decides, roughly
  const [m, s] = (clock ?? '7:30').split(':').map(Number)
  const inQuarter = Math.min(15 * 60, Math.max(0, m * 60 + s))
  return ((4 - quarter) * 15 * 60 + inQuarter) / 3600
}

// Abramowitz-Stegun 7.1.26: good to 1.5e-7, plenty for a probability bar
function erf(x: number) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))

/** Standard deviation of an NFL game's final margin around the spread (Stern 1991). */
export const MARGIN_SD = 13.45

/**
 * Home win probability during a game: the final margin is the current margin
 * plus what is left, normal around the pre-game spread scaled to the time left.
 * `spread` is the expected home margin before kickoff (positive = home favoured).
 */
export function liveWinProb(spread: number, homeScore: number, awayScore: number, left: number): number {
  const margin = homeScore - awayScore
  if (left <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5
  return phi((margin + spread * left) / (MARGIN_SD * Math.sqrt(left)))
}
