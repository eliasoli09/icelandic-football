import test from './data/vedmal-backtest.json'
import { franchiseOf } from './elo'
import { isUnavailable, type InjuryStatus } from './injuries'
import type { Forecast } from './forecast'
import { isPlayed, type GameType, type NflGame } from './types'
import { NO_USAGE, SLIPS, bestSlip, gameLegs, impliedPoints, rushProjection, tdChance, tdRate, teamFactor, type Slip, type Usage } from './vedmal'

export const BACKTEST = test

/** One player-game, as much as the page needs. */
export interface VedmalLine {
  player_id: string; week: number; game_id: string; team: string; opponent: string
  carries: number; targets: number; rushing_tds: number; receiving_tds: number; rushing_yards: number
  name: string; position: string | null; headshot: string | null
}
/** Last season's totals for a player. */
export type PrevTotal = Usage & { player_id: string }

export interface PlayerPick { player_id: string; name: string; position: string | null; headshot: string | null; team: string; opp: string; game_id: string; value: number; status: InjuryStatus | null }
export interface GameTotal { game: NflGame; total: number; home: number; away: number }
export interface Favourite { team: string; opp: string; game: NflGame; p: number; model: number }

export interface VedmalWeek {
  week: number
  type: GameType
  /** Games of the round not yet started. */
  games: NflGame[]
  slips: { key: string; name: string; target: number; slip: Slip | null }[]
  scorers: PlayerPick[]
  rushers: PlayerPick[]
  totals: GameTotal[]
  favourites: Favourite[]
}

const use = (l: VedmalLine): Usage => ({ games: 1, carries: l.carries, targets: l.targets, tds: l.rushing_tds + l.receiving_tds, rushYards: l.rushing_yards })
const plus = (a: Usage, b: Usage): Usage => ({ games: a.games + b.games, carries: a.carries + b.carries, targets: a.targets + b.targets, tds: a.tds + b.tds, rushYards: a.rushYards + b.rushYards })

/**
 * The betting page for the round of the next game to start: the three slips,
 * touchdown chances, rushing yards, game totals and favourites. Slips and
 * favourites use the margin-free market at the weight the backtest chose; the
 * player numbers use the knobs it chose. `lines` are this season's games so far.
 * `injured` (from `availability`) drops players who will not play and marks the doubtful.
 */
export function vedmalWeek(games: NflGame[], forecasts: Record<string, Forecast>, lines: VedmalLine[], prev: PrevTotal[], leaguePts: number, leagueRush: number, now: Date, injured: (week: number) => Map<string, InjuryStatus> = () => new Map()): VedmalWeek | null {
  const upcoming = games.filter((g) => !isPlayed(g) && new Date(g.kickoff) > now).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  if (!upcoming.length) return null
  const { week, game_type: type } = upcoming[0]
  const round = upcoming.filter((g) => g.week === week && g.game_type === type)
  const hurt = injured(week)
  const fr = franchiseOf

  const choices = round.map((g) => gameLegs(g, forecasts[g.game_id]?.pHome, test.slipWeight)).filter((l) => l.length)
  const slips = SLIPS.map((s) => ({ ...s, slip: bestSlip(choices, s.target) }))

  const favourites: Favourite[] = []
  for (const legs of choices) for (const l of legs) {
    const g = round.find((x) => x.game_id === l.game_id)!
    const model = l.home ? forecasts[g.game_id].pHome : 1 - forecasts[g.game_id].pHome
    if (l.p >= 0.5) favourites.push({ team: l.team, opp: l.opp, game: g, p: l.p, model })
  }
  favourites.sort((a, b) => b.p - a.p)

  // team points and the rushing each defence has given up so far
  const pts = new Map<string, { for: number; games: number }>()
  for (const g of games) if (isPlayed(g) && g.game_type === 'REG') for (const [t, f] of [[g.home, g.home_score!], [g.away, g.away_score!]] as const) {
    const x = pts.get(fr(t)) ?? { for: 0, games: 0 }; x.for += f; x.games++; pts.set(fr(t), x)
  }
  const allowed = new Map<string, { yards: number; games: Set<string> }>()
  for (const l of lines) { const x = allowed.get(fr(l.opponent)) ?? { yards: 0, games: new Set<string>() }; x.yards += l.rushing_yards; x.games.add(l.game_id); allowed.set(fr(l.opponent), x) }

  const cur = new Map<string, Usage>()
  for (const l of lines) cur.set(l.player_id, plus(cur.get(l.player_id) ?? NO_USAGE, use(l)))
  const last = new Map(prev.map((p) => [p.player_id, p]))
  // a team's latest game, and who turned out in it
  const latest = new Map<string, { week: number; game: string }>()
  for (const l of lines) { const x = latest.get(fr(l.team)); if (!x || l.week > x.week) latest.set(fr(l.team), { week: l.week, game: l.game_id }) }

  const scorers: PlayerPick[] = [], rushers: PlayerPick[] = []
  const P = test.td.params, R = test.rush.params
  for (const g of round) for (const home of [true, false]) {
    const team = fr(home ? g.home : g.away), opp = fr(home ? g.away : g.home)
    const tp = pts.get(team) ?? { for: 0, games: 0 }
    const factor = teamFactor(impliedPoints(g, home), tp.for, tp.games, leaguePts, P.kTeam) ** P.a
    const op = allowed.get(opp) ?? { yards: 0, games: new Set() }
    for (const l of lines) {
      if (fr(l.team) !== team || latest.get(team)?.game !== l.game_id) continue
      const status = hurt.get(l.player_id) ?? null
      if (status && isUnavailable(status)) continue
      const c = cur.get(l.player_id) ?? NO_USAGE, p = last.get(l.player_id) ?? NO_USAGE
      const who = { player_id: l.player_id, name: l.name, position: l.position, headshot: l.headshot, team: home ? g.home : g.away, opp: home ? g.away : g.home, game_id: g.game_id, status }
      if (l.carries + l.targets > 0) scorers.push({ ...who, value: tdChance(tdRate(c, p, P) * factor) })
      if (l.carries > 0 && c.games && c.carries / c.games >= 5) rushers.push({ ...who, value: rushProjection(c, p, op.yards, op.games.size, leagueRush, R) })
    }
  }
  scorers.sort((a, b) => b.value - a.value)
  rushers.sort((a, b) => b.value - a.value)

  // Vegas beat our own totals in the backtest, so the line leads
  const totals: GameTotal[] = round.filter((g) => g.total_line !== null && g.spread_line !== null)
    .map((g) => ({ game: g, total: g.total_line!, home: impliedPoints(g, true)!, away: impliedPoints(g, false)! }))
    .sort((a, b) => b.total - a.total)

  return { week, type, games: round, slips, scorers: scorers.slice(0, 15), rushers: rushers.slice(0, 10), totals, favourites }
}
