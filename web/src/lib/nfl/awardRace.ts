import type { Award } from './awards'
import { OFFENCE_POSITIONS } from './positions'
import { STATS, type PlayerWeek, type Stat } from './players'

// ── Conditional logit: one softmax over each season-week's candidates ───────

export interface Group { x: number[][]; winners: number[] }

export function logitProbs(x: number[][], w: number[]): number[] {
  const s = x.map((r) => r.reduce((t, v, k) => t + v * w[k], 0))
  const m = Math.max(...s)
  const e = s.map((v) => Math.exp(v - m))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / z)
}

/** Negative log-likelihood of the winners plus an L2 penalty, and its gradient. */
export function lossAndGrad(groups: Group[], w: number[], l2: number): { loss: number; grad: number[] } {
  let loss = 0
  const grad = w.map((v) => 2 * l2 * v)
  for (const g of groups) {
    const p = logitProbs(g.x, w)
    for (const win of g.winners) {
      loss -= Math.log(Math.max(p[win], 1e-12))
      for (let k = 0; k < w.length; k++) {
        let expected = 0
        for (let i = 0; i < g.x.length; i++) expected += p[i] * g.x[i][k]
        grad[k] -= g.x[win][k] - expected
      }
    }
  }
  return { loss: loss + l2 * w.reduce((t, v) => t + v * v, 0), grad }
}

/** Adam on the full batch; small problems (hundreds of groups, a dozen features). */
export function fitLogit(groups: Group[], l2: number, iters = 1500, lr = 0.05): number[] {
  const d = groups[0].x[0].length
  const w = Array(d).fill(0)
  const m = Array(d).fill(0)
  const v = Array(d).fill(0)
  const n = groups.reduce((t, g) => t + g.winners.length, 0)
  for (let t = 1; t <= iters; t++) {
    const { grad } = lossAndGrad(groups, w, l2 * n)
    for (let k = 0; k < d; k++) {
      const g = grad[k] / n
      m[k] = 0.9 * m[k] + 0.1 * g
      v[k] = 0.999 * v[k] + 0.001 * g * g
      w[k] -= (lr * (m[k] / (1 - 0.9 ** t))) / (Math.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8)
    }
  }
  return w
}

export function standardize(rows: number[][]): { mean: number[]; sd: number[]; apply: (x: number[]) => number[] } {
  const d = rows[0].length
  const mean = Array.from({ length: d }, (_, k) => rows.reduce((t, r) => t + r[k], 0) / rows.length)
  const sd = Array.from({ length: d }, (_, k) => Math.sqrt(rows.reduce((t, r) => t + (r[k] - mean[k]) ** 2, 0) / rows.length) || 1)
  return { mean, sd, apply: (x) => x.map((v, k) => (v - mean[k]) / sd[k]) }
}

// ── Candidates and features ──────────────────────────────────────────────────

type Totals = Record<Stat, number>

const offEpa = (t: Totals) => t.passing_epa + t.rushing_epa + t.receiving_epa
/** One number for a defender's season: big plays weigh more than tackles for loss. */
export const defScore = (t: Totals) =>
  2 * t.def_sacks + 2 * t.def_interceptions + t.tackles_for_loss + 2 * t.forced_fumbles + 0.5 * t.passes_defended + 0.5 * t.qb_hits + 3 * t.def_tds
const scrimmage = (t: Totals) => t.rushing_yards + t.receiving_yards
const tds = (t: Totals) => t.passing_tds + t.rushing_tds + t.receiving_tds

export interface PlayerInfo { position: string | null; rookie_season: number | null }
export interface PastSeason { season: number; games: number; off: number; def: number }

export interface Candidate {
  player_id: string
  team: string
  /** Ranking numbers for the pool screens (see POOLS). */
  screens: number[]
  /** The single number the "leader wins" baseline ranks by. */
  main: number
  x: number[]
  totals: Totals & { games: number }
}

export interface Context {
  award: Award
  season: number
  /** Weeks of the regular season played so far. */
  week: number
  seasonWeeks: number
  info: Map<string, PlayerInfo>
  team: Map<string, { games: number; pct: number }>
  /** Earlier seasons per player, for the comeback award. */
  past?: Map<string, PastSeason[]>
}

/**
 * Each award's pool is a union of several screens, so no one kind of winner
 * falls out: big-yardage backs next to high-EPA quarterbacks, tackling
 * linebackers next to pass rushers. Sizes per screen.
 */
const POOLS: Record<Award, number[]> = { MVP: [20, 10], OPOY: [15, 15], DPOY: [20, 10], OROY: [15, 15], DROY: [20, 10], CPOY: [40] }

/** Sum a player's regular-season rows up to `week`. */
export function totalsTo(weeks: PlayerWeek[], week: number): Map<string, Totals & { games: number; team: string }> {
  const out = new Map<string, Totals & { games: number; team: string }>()
  for (const w of weeks) {
    if (w.season_type !== 'REG' || w.week > week) continue
    const t = out.get(w.player_id) ?? ({ games: 0, team: w.team, ...Object.fromEntries(STATS.map((k) => [k, 0])) } as Totals & { games: number; team: string })
    t.games++
    t.team = w.team
    for (const k of STATS) t[k] += w[k]
    out.set(w.player_id, t)
  }
  return out
}

/** Candidates and features for one award at one point of one season. */
export function candidates(ctx: Context, totals: Map<string, Totals & { games: number; team: string }>): Candidate[] {
  const { award, season, info, team } = ctx
  const frac = ctx.week / ctx.seasonWeeks
  const out: Candidate[] = []
  for (const [id, t] of totals) {
    const p = info.get(id)
    const pos = p?.position ?? null
    const off = pos !== null && OFFENCE_POSITIONS.has(pos)
    const def = pos !== null && !off
    const rookie = p?.rookie_season === season
    const tm = team.get(t.team) ?? { games: Math.max(t.games, 1), pct: 0.5 }
    const tg = Math.max(tm.games, 1)
    let x: number[] | null = null
    let screens: number[] = []
    let main = 0
    const tackles = t.tackles_solo + t.tackle_assists
    if (award === 'MVP' && off && ['QB', 'RB', 'WR', 'TE'].includes(pos!)) {
      x = [t.passing_epa / tg, (t.rushing_epa + t.receiving_epa) / tg, tds(t) / tg, t.passing_yards / tg / 100, tm.pct, pos === 'QB' ? 1 : 0]
      screens = [offEpa(t), scrimmage(t)]
      main = t.passing_epa
    } else if ((award === 'OPOY' || (award === 'OROY' && rookie)) && off) {
      x = [scrimmage(t) / tg / 100, t.passing_yards / tg / 100, tds(t) / tg, offEpa(t) / tg, tm.pct, pos === 'QB' ? 1 : 0]
      screens = [offEpa(t), scrimmage(t)]
      main = scrimmage(t)
    } else if ((award === 'DPOY' || (award === 'DROY' && rookie)) && def) {
      x = [t.def_sacks / tg, t.def_interceptions / tg, t.tackles_for_loss / tg, t.forced_fumbles / tg, t.passes_defended / tg, t.qb_hits / tg, tackles / tg / 10, tm.pct]
      screens = [defScore(t), tackles]
      main = t.def_sacks
    } else if (award === 'CPOY' && pos !== null) {
      const hist = (ctx.past?.get(id) ?? []).filter((s) => s.season < season)
      if (hist.length) {
        const prev = hist.find((s) => s.season === season - 1)
        const prevFrac = prev ? Math.min(prev.games / 16, 1) : 0
        const bestOff = Math.max(...hist.map((s) => s.off / Math.max(s.games, 1)))
        const bestDef = Math.max(...hist.map((s) => s.def / Math.max(s.games, 1)))
        const nowOff = offEpa(t) / tg
        const nowDef = defScore(t) / tg
        const prevOff = prev ? prev.off / Math.max(prev.games, 1) : 0
        const prevDef = prev ? prev.def / Math.max(prev.games, 1) : 0
        const missed = 1 - prevFrac
        // a comeback is either a return from injury (missed) or from a poor year (the jump)
        const jump = nowOff - prevOff + 3 * (nowDef - prevDef)
        x = [prevFrac, bestOff, bestDef, nowOff, nowDef, missed * nowOff, missed * nowDef, nowOff - prevOff, nowDef - prevDef, hist.length, tm.pct]
        screens = [jump + missed * (nowOff + 3 * nowDef)]
        main = screens[0]
      }
    }
    if (!x) continue
    // the same features scaled by how far the season has run, so early
    // weeks can learn to be less sure than late ones
    out.push({ player_id: id, team: t.team, screens, main, x: [...x, ...x.map((v) => v * frac)], totals: t })
  }
  const pool = new Map<string, Candidate>()
  POOLS[award].forEach((size, k) => {
    for (const c of [...out].sort((a, b) => b.screens[k] - a.screens[k]).slice(0, size)) pool.set(c.player_id, c)
  })
  return [...pool.values()]
}
