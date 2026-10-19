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
const LIVE = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'BT'])

export const STATUS_LABEL: Record<string, string> = {
  NS: 'Ekki hafinn', Q1: '1. leikhluti', Q2: '2. leikhluti', HT: 'Hálfleikur', Q3: '3. leikhluti', Q4: '4. leikhluti',
  OT: 'Framlenging', BT: 'Leikhlutaskil', FT: 'Lokið', AOT: 'Lokið eftir framlengingu', CANC: 'Aflýst', PST: 'Frestað', SUSP: 'Hlé',
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
    // between quarters the feed gives no short code, only "End of Period"; the quarter that ended is the last one scored
    const between = !g?.status?.short && /end of period/i.test(String(g?.status?.long ?? ''))
    const status = between ? 'BT' : String(g?.status?.short ?? '')
    const ended = between ? [4, 3, 2, 1].find((q) => r?.scores?.home?.[`quarter_${q}`] != null) ?? null : null
    const home = r?.teams?.home?.name, away = r?.teams?.away?.name
    if (typeof g?.id !== 'number' || typeof home !== 'string' || typeof away !== 'string') continue
    const timer = typeof g?.status?.timer === 'string' && /^\d{1,2}:\d{2}$/.test(g.status.timer) ? g.status.timer : null
    out.push({
      apiId: g.id, home, away,
      homeScore: total(r?.scores?.home), awayScore: total(r?.scores?.away),
      status,
      quarter: QUARTER[status] ?? ended,
      clock: timer,
      live: LIVE.has(status),
      final: FINAL.has(status),
    })
  }
  return out
}

const QUARTER_LABEL: Record<string, string> = { first: '1. lh.', second: '2. lh.', third: '3. lh.', fourth: '4. lh.', overtime: 'Framl.' }
export const quarterLabel = (q: string) => QUARTER_LABEL[q.toLowerCase()] ?? q

export const EVENT_LABEL: Record<string, string> = { TD: 'Snertimark', FG: 'Vallarmark', SF: 'Sjálfsmark', PAT: 'Aukastig' }

/**
 * The feed's play descriptions in Icelandic for the common patterns
 * ("J.K. Dobbins 4 Yd Rush (Wil Lutz Kick)"); anything else stays as given.
 */
export function playIs(comment: string): string {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(comment)
  const main = (m ? m[1] : comment).trim()
  const extra = m ? m[2].trim() : ''
  const rules: [RegExp, string][] = [
    [/^(.+?) (\d+) Yd Rush$/i, '$1, $2 jarda hlaup'],
    [/^(.+?) (\d+) Yd pass from (.+)$/i, '$1 greip $2 jarda sendingu frá $3'],
    [/^(.+?) (\d+) Yd Field Goal$/i, '$1, $2 jarda vallarmark'],
    [/^(.+?) (\d+) Yd Interception Return$/i, '$1 hleraði og hljóp $2 jarda í snertimark'],
    [/^(.+?) (\d+) Yd Fumble Return$/i, '$1 náði boltamissi og hljóp $2 jarda í snertimark'],
  ]
  let out = main
  for (const [re, to] of rules) if (re.test(main)) { out = main.replace(re, to); break }
  if (extra) {
    const kick = /^(.+?) Kick$/i.exec(extra)
    if (kick) out += ` (aukastig: ${kick[1]})`
    else if (/two-point conversion/i.test(extra)) out += ' (og 2 stig til viðbótar)'
    else if (/kick (failed|blocked)/i.test(extra) || /failed/i.test(extra)) out += ' (aukastigið mistókst)'
    else out += ` (${extra})`
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

/** How long after kickoff a game is planned for in the request budget (most end within 3.5 hours). */
export const PLAN_WINDOW_MS = 4 * 3600 * 1000

/**
 * Seconds between polls so the day's requests come close to `budget`: each poll
 * costs `base` requests while any game is on plus `perGame` for each game under
 * way (the scoreboard and one events request: 1 and 1; the stats: 0 and 2), so
 * the day's cost is (base × time any game is on + perGame × the sum of each
 * game's time on) / interval. The quota resets at midnight UTC, so the day is a UTC day.
 */
export function planInterval(kickoffs: string[], dayUtc: Date, budget: number, floor = 15, base = 1, perGame = 1): number {
  const start = Date.UTC(dayUtc.getUTCFullYear(), dayUtc.getUTCMonth(), dayUtc.getUTCDate())
  const end = start + 86400_000
  const spans = kickoffs
    .map((k) => [Math.max(start, new Date(k).getTime()), Math.min(end, new Date(k).getTime() + PLAN_WINDOW_MS)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  if (!spans.length) return floor
  let union = 0, sum = 0, curA = spans[0][0], curB = spans[0][1]
  for (const [a, b] of spans) {
    sum += b - a
    if (a > curB) { union += curB - curA; curA = a; curB = b } else curB = Math.max(curB, b)
  }
  union += curB - curA
  return Math.max(floor, Math.ceil((base * union + perGame * sum) / 1000 / Math.max(1, budget)))
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
  const [m, s] = (clock ?? (status === 'BT' ? '0:00' : '7:30')).split(':').map(Number)
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

/** A player's line in a game, as api-sports counts it: the numbers fantasy points and bets need. */
export interface LivePlayer {
  name: string
  /** api-sports team name, e.g. "Denver Broncos". */
  team: string
  passYds: number; passTd: number; ints: number
  rushYds: number; rushTd: number
  rec: number; recYds: number; recTd: number
  fumLost: number; twoPt: number
  /** A kicker's points as api-sports counts them (three a field goal, one an extra point). */
  kPts: number
}

const count = (v: unknown) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }
const stat = (stats: { name?: string; value?: unknown }[] | undefined, name: string) => count(stats?.find((x) => x.name === name)?.value)

/** Every player with a line in a /games/statistics/players reply, groups merged per player. */
export function parsePlayerStats(json: unknown): LivePlayer[] {
  const teams = (json as { response?: unknown[] })?.response
  if (!Array.isArray(teams)) return []
  const out = new Map<string, LivePlayer>()
  for (const t of teams as { team?: { name?: string }; groups?: { name?: string; players?: { player?: { id?: number; name?: string }; statistics?: { name?: string; value?: unknown }[] }[] }[] }[]) {
    const team = t.team?.name ?? ''
    for (const g of t.groups ?? []) for (const p of g.players ?? []) {
      const name = p.player?.name
      if (!name) continue
      const key = `${team}|${p.player?.id ?? name}`
      const x = out.get(key) ?? { name, team, passYds: 0, passTd: 0, ints: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, fumLost: 0, twoPt: 0, kPts: 0 }
      const s = p.statistics
      if (g.name === 'Passing') { x.passYds += stat(s, 'yards'); x.passTd += stat(s, 'passing touch downs'); x.ints += stat(s, 'interceptions'); x.twoPt += stat(s, 'two pt') }
      if (g.name === 'Rushing') { x.rushYds += stat(s, 'yards'); x.rushTd += stat(s, 'rushing touch downs'); x.twoPt += stat(s, 'two pt') }
      if (g.name === 'Receiving') { x.rec += stat(s, 'total receptions'); x.recYds += stat(s, 'yards'); x.recTd += stat(s, 'receiving touch downs'); x.twoPt += stat(s, 'two pt') }
      if (g.name === 'Fumbles') x.fumLost += stat(s, 'lost')
      if (g.name === 'Kicking') x.kPts += stat(s, 'points')
      out.set(key, x)
    }
  }
  return [...out.values()]
}

/** What a team did in a game: red-zone touchdowns from trips ("2-3"), and its defence for fantasy. */
export interface LiveTeamStats { team: string; rzMade: number; rzAtt: number; sacks: number; ints: number; fumRec: number; safeties: number; defTd: number; pointsAgainst: number }

/** One row per team of a /games/statistics/teams reply. */
export function parseTeamStats(json: unknown): LiveTeamStats[] {
  const rows = (json as { response?: unknown[] })?.response
  if (!Array.isArray(rows)) return []
  type S = { total?: unknown; made_att?: string }
  return (rows as { team?: { name?: string }; statistics?: Record<string, S | undefined> }[]).flatMap((r) => {
    const st = r.statistics ?? {}
    if (!r.team?.name) return []
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(st.red_zone?.made_att ?? '')
    return [{
      team: r.team.name, rzMade: m ? Number(m[1]) : 0, rzAtt: m ? Number(m[2]) : 0,
      sacks: count(st.sacks?.total), ints: count(st.interceptions?.total), fumRec: count(st.fumbles_recovered?.total),
      safeties: count(st.safeties?.total), defTd: count(st.int_touchdowns?.total), pointsAgainst: count(st.points_against?.total),
    }]
  })
}
