import test from './data/vedmal-backtest.json'
import { franchiseOf } from './elo'
import { isUnavailable, type InjuryStatus } from './injuries'
import type { Forecast } from './forecast'
import { isPlayed, type GameType, type NflGame } from './types'
import { MARKETS, SLIPS, bestSlip, gameLegs, impliedPoints, rushProjection, statProjection, tdChance, tdRate, teamFactor, type Market, type Slip, type StatLine, type Usage } from './vedmal'

export const BACKTEST = test

/** The stats a line carries: the markets' plus touchdowns. */
export type Stats = StatLine & { rushing_tds: number; receiving_tds: number }
export const STAT_FIELDS = ['attempts', 'passing_yards', 'interceptions', 'sacks_taken', 'carries', 'rushing_yards', 'targets', 'receptions', 'receiving_yards', 'def_sacks', 'qb_hits', 'tackles_solo', 'tackle_assists', 'rushing_tds', 'receiving_tds'] as const

/** One player-game, as much as the page needs. */
export type VedmalLine = Stats & {
  player_id: string; week: number; game_id: string; team: string; opponent: string
  name: string; position: string | null; headshot: string | null
}
/** Last season's regular-season totals for a player. */
export type PrevTotal = Stats & { player_id: string; games: number }

/** What a number stands on: the player's average, his last three games (newest first) and what the opponent gives up a game against the league. */
export interface Basis { avg: number; recent: number[]; opp: number | null; league: number | null; note?: string }
export interface PlayerPick {
  player_id: string; name: string; position: string | null; headshot: string | null
  team: string; opp: string; game_id: string; value: number; status: InjuryStatus | null; basis: Basis
}
export interface MarketList { key: Market['key']; title: string; unit: string; kind: Market['kind']; picks: PlayerPick[]; test: { score: number; naive: number; metric: string } }
export interface GameTotal { game: NflGame; total: number; home: number; away: number }
export interface Favourite { team: string; opp: string; game: NflGame; p: number; model: number }
/** Touchdown scorers from different games together, at our own fair price. */
export interface ScorerSlip { picks: PlayerPick[]; p: number; fair: number }

export interface VedmalWeek {
  week: number
  type: GameType
  /** Games of the round not yet started. */
  games: NflGame[]
  slips: { key: string; name: string; target: number; slip: Slip | null }[]
  scorers: PlayerPick[]
  scorerSlips: ScorerSlip[]
  rushers: PlayerPick[]
  markets: MarketList[]
  totals: GameTotal[]
  favourites: Favourite[]
}

type Tot = Stats & { games: number }
const zero = (): Tot => ({ games: 0, ...Object.fromEntries(STAT_FIELDS.map((k) => [k, 0])) } as Tot)
const add = (t: Tot, l: Stats) => { t.games++; for (const k of STAT_FIELDS) t[k] += l[k]; return t }
const usage = (t: Tot): Usage => ({ games: t.games, carries: t.carries, targets: t.targets, tds: t.rushing_tds + t.receiving_tds, rushYards: t.rushing_yards })
const per = (t: Tot, k: keyof Stats) => (t.games ? t[k] / t.games : 0)

/** Markets that beat a plain season average and one number for everyone in the backtest, the latter by half a per cent or more (interceptions do not). */
export const SHOWN_MARKETS = MARKETS.filter((m) => {
  const t = (test.markets as Record<string, { test: { score: number; naive: number; flat: number } }>)[m.key]?.test
  return t && t.score < t.naive && t.score < t.flat * 0.995
})

/**
 * The betting page for the round of the next game to start: the three slips,
 * touchdown chances, rushing yards and the other player markets, game totals and
 * favourites. Slips and favourites use the margin-free market at the weight the
 * backtest chose; the player numbers use the knobs it chose. `lines` are this
 * season's games so far; `teamGames` is last season's team-games (two a game).
 * `injured` (from `availability`) drops players who will not play and marks the doubtful.
 */
export function vedmalWeek(games: NflGame[], forecasts: Record<string, Forecast>, lines: VedmalLine[], prev: PrevTotal[], leaguePts: number, teamGames: number, now: Date, injured: (week: number) => Map<string, InjuryStatus> = () => new Map()): VedmalWeek | null {
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

  // team points, and what each side has given up so far: by its defence (against) and by its offence (own)
  const pts = new Map<string, { for: number; games: number }>()
  for (const g of games) if (isPlayed(g) && g.game_type === 'REG') for (const [t, f] of [[g.home, g.home_score!], [g.away, g.away_score!]] as const) {
    const x = pts.get(fr(t)) ?? { for: 0, games: 0 }; x.for += f; x.games++; pts.set(fr(t), x)
  }
  const against = new Map<string, { t: Tot; games: Set<string> }>(), own = new Map<string, { t: Tot; games: Set<string> }>()
  for (const l of lines) for (const [m, key] of [[against, fr(l.opponent)], [own, fr(l.team)]] as const) {
    const x = m.get(key) ?? { t: zero(), games: new Set<string>() }; add(x.t, l); x.t.games--; x.games.add(l.game_id); m.set(key, x)
  }
  const facedBy = (side: 'against' | 'own', team: string, stat: (s: StatLine) => number) => {
    const x = (side === 'against' ? against : own).get(team)
    return x ? { total: stat(x.t), games: x.games.size } : { total: 0, games: 0 }
  }
  const prevSum = zero()
  for (const p of prev) for (const k of STAT_FIELDS) prevSum[k] += p[k]
  const league = (stat: (s: StatLine) => number) => (teamGames ? stat(prevSum) / teamGames : 0)

  const cur = new Map<string, Tot>()
  const recent = new Map<string, VedmalLine[]>()
  for (const l of [...lines].sort((a, b) => b.week - a.week)) {
    cur.set(l.player_id, add(cur.get(l.player_id) ?? zero(), l))
    recent.set(l.player_id, [...(recent.get(l.player_id) ?? []), l])
  }
  const last = new Map(prev.map((p) => [p.player_id, p]))
  const prevTot = (id: string): Tot => last.get(id) ?? zero()
  // a team's latest game, and who turned out in it
  const latest = new Map<string, { week: number; game: string }>()
  for (const l of lines) { const x = latest.get(fr(l.team)); if (!x || l.week > x.week) latest.set(fr(l.team), { week: l.week, game: l.game_id }) }

  const scorers: PlayerPick[] = [], rushers: PlayerPick[] = []
  const byMarket = new Map<string, PlayerPick[]>(SHOWN_MARKETS.map((m) => [m.key, []]))
  const P = test.td.params, R = test.rush.params
  const leagueRush = league((s) => s.rushing_yards)
  for (const g of round) for (const home of [true, false]) {
    const team = fr(home ? g.home : g.away), opp = fr(home ? g.away : g.home)
    const tp = pts.get(team) ?? { for: 0, games: 0 }
    const factor = teamFactor(impliedPoints(g, home), tp.for, tp.games, leaguePts, P.kTeam)
    for (const l of lines) {
      if (fr(l.team) !== team || latest.get(team)?.game !== l.game_id) continue
      const status = hurt.get(l.player_id) ?? null
      if (status && isUnavailable(status)) continue
      const c = cur.get(l.player_id) ?? zero(), pv = prevTot(l.player_id)
      const mine = recent.get(l.player_id) ?? []
      const who = { player_id: l.player_id, name: l.name, position: l.position, headshot: l.headshot, team: home ? g.home : g.away, opp: home ? g.away : g.home, game_id: g.game_id, status }
      const last3 = (f: (s: Stats) => number) => mine.slice(0, 3).map(f)
      if (l.carries + l.targets > 0) {
        scorers.push({ ...who, value: tdChance(tdRate(usage(c), usage(pv), P) * factor ** P.a), basis: {
          avg: (c.rushing_tds + c.receiving_tds) / Math.max(1, c.games), recent: last3((s) => s.rushing_tds + s.receiving_tds), opp: null, league: null,
          note: `${c.rushing_tds + c.receiving_tds} snertimörk í ${c.games} leikjum · ${dec1(per(c, 'carries'))} hlaup og ${dec1(per(c, 'targets'))} skotmörk í leik`,
        } })
      }
      if (l.carries > 0 && c.games && c.carries / c.games >= 5) {
        const o = facedBy('against', opp, (s) => s.rushing_yards)
        rushers.push({ ...who, value: rushProjection(usage(c), usage(pv), o.total, o.games, leagueRush, R), basis: { avg: per(c, 'rushing_yards'), recent: last3((s) => s.rushing_yards), opp: o.games ? o.total / o.games : null, league: leagueRush } })
      }
      const avg = Object.fromEntries(STAT_FIELDS.map((k) => [k, per(c, k)])) as unknown as StatLine
      for (const m of SHOWN_MARKETS) {
        if (!m.eligible(l, avg)) continue
        const MP = (test.markets as Record<string, { params: { prev: number; kDef: number; a: number; k: number; prior: number } }>)[m.key].params
        const o = facedBy(m.faced, opp, m.oppStat)
        const lg = league(m.oppStat)
        const proj = statProjection({ games: c.games, total: m.per(c) }, { games: pv.games, total: m.per(pv) }, o, lg, factor, MP)
        byMarket.get(m.key)!.push({ ...who, value: m.kind === 'chance' ? tdChance(proj) : proj, basis: { avg: m.per(avg), recent: last3(m.per), opp: o.games ? o.total / o.games : null, league: lg } })
      }
    }
  }
  scorers.sort((a, b) => b.value - a.value)
  rushers.sort((a, b) => b.value - a.value)

  // touchdown doubles and trebles: the likeliest scorers, one per game
  const scorerSlips: ScorerSlip[] = []
  for (const n of [2, 3]) {
    const picks: PlayerPick[] = []
    for (const s of scorers) if (picks.length < n && !picks.some((p) => p.game_id === s.game_id)) picks.push(s)
    if (picks.length === n) { const p = picks.reduce((t, x) => t * x.value, 1); scorerSlips.push({ picks, p, fair: 1 / p }) }
  }

  const markets: MarketList[] = SHOWN_MARKETS.map((m) => {
    const t = (test.markets as Record<string, { test: { score: number; naive: number; metric: string } }>)[m.key].test
    return { key: m.key, title: m.title, unit: m.unit, kind: m.kind, picks: byMarket.get(m.key)!.sort((a, b) => b.value - a.value).slice(0, 10), test: t }
  })

  // Vegas beat our own totals in the backtest, so the line leads
  const totals: GameTotal[] = round.filter((g) => g.total_line !== null && g.spread_line !== null)
    .map((g) => ({ game: g, total: g.total_line!, home: impliedPoints(g, true)!, away: impliedPoints(g, false)! }))
    .sort((a, b) => b.total - a.total)

  return { week, type, games: round, slips, scorers: scorers.slice(0, 15), scorerSlips, rushers: rushers.slice(0, 10), markets, totals, favourites }
}

const dec1 = (x: number) => x.toFixed(1).replace('.', ',')
