import { diffFor, franchiseOf, movMultiplier, ratingFor, winProb, type EloState, type QbAdj } from './elo'
import { computeStandings } from './standings'
import { CONFERENCES, DIVISIONS, isPlayed, type Conference, type GameType, type NflGame, type NflTeam } from './types'

/** Seven clubs per conference and one bye from 2020; six and two before. */
export const seasonFormat = (season: number) => (season >= 2020 ? { seeds: 7, byes: 1 } : { seeds: 6, byes: 2 })

/** Best against worst, second against second-worst; input is in seed order. */
export function pairUp<T>(bySeed: T[]): [T, T][] {
  const out: [T, T][] = []
  for (let i = 0; i < bySeed.length / 2; i++) out.push([bySeed[i], bySeed[bySeed.length - 1 - i]])
  return out
}

/** Small, fast, seedable: the same seed gives the same simulation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimTeam {
  team: string
  p_div: number
  p_playoffs: number
  p_bye: number
  /** Probability of each seed, index 0 = seed 1. */
  p_seed: number[]
  p_round2: number
  p_round3: number
  p_sb: number
  p_title: number
}

export interface SimOptions {
  sims: number
  hot: boolean
  seed?: number
  /** Quarterback adjustment by game_id, for games with a listed starter; others get none. */
  qbAdj?: Record<string, QbAdj>
}

/** Margin assumed for an Elo update inside a hot simulation. */
const SIM_MARGIN = 7

/**
 * Play out the rest of one season `sims` times from the current ratings.
 * `games` is the whole season (played and not); `teams` the clubs in it.
 */
export function simulateSeason(games: NflGame[], teams: NflTeam[], state: EloState, opts: SimOptions): Record<string, SimTeam> {
  const season = games[0].season
  const fmt = seasonFormat(season)
  const rand = mulberry32(opts.seed ?? 1)
  const { K, HFA } = state.params
  const reg = games.filter((g) => g.game_type === 'REG').sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const open = reg.filter((g) => !isPlayed(g))
  const done = reg.filter(isPlayed)
  // a playoff game already played between the same clubs in the same round decides it
  const playedPost = new Map<string, string>()
  for (const g of games) if (g.game_type !== 'REG' && isPlayed(g)) {
    playedPost.set(`${g.game_type}:${[g.home, g.away].sort().join('-')}`, g.home_score! > g.away_score! ? g.home : g.away)
  }
  const base = new Map(teams.map((t) => [t.abbr, ratingFor(state, franchiseOf(t.abbr), season)]))

  const blank = (): SimTeam => ({ team: '', p_div: 0, p_playoffs: 0, p_bye: 0, p_seed: Array(fmt.seeds).fill(0), p_round2: 0, p_round3: 0, p_sb: 0, p_title: 0 })
  const tally = new Map(teams.map((t) => [t.abbr, { ...blank(), team: t.abbr }]))

  for (let s = 0; s < opts.sims; s++) {
    const r = new Map(base)
    const update = (home: string, away: string, diff: number, homeWon: boolean) => {
      if (!opts.hot) return
      const p = winProb(diff)
      const delta = K * movMultiplier(SIM_MARGIN, homeWon ? diff : -diff) * ((homeWon ? 1 : 0) - p)
      r.set(home, r.get(home)! + delta)
      r.set(away, r.get(away)! - delta)
    }

    const simmed: NflGame[] = done.slice()
    for (const g of open) {
      const adj = opts.qbAdj?.[g.game_id]
      const diff = diffFor(state, g, r.get(g.home)!, r.get(g.away)!) + (adj ? adj.home - adj.away : 0)
      const homeWon = rand() < winProb(diff)
      update(g.home, g.away, diff, homeWon)
      simmed.push({ ...g, home_score: homeWon ? 1 : 0, away_score: homeWon ? 0 : 1 })
    }

    const st = computeStandings(simmed, teams)
    const champs: Partial<Record<Conference, string>> = {}
    for (const c of CONFERENCES) {
      const seeds = st.seeds[c].slice(0, fmt.seeds).map((x) => x.abbr)
      const seedOf = new Map(seeds.map((a, i) => [a, i]))
      for (const d of DIVISIONS) tally.get(st.divisions[c][d][0].abbr)!.p_div++
      seeds.forEach((a, i) => {
        const x = tally.get(a)!
        x.p_playoffs++
        x.p_seed[i]++
        if (i < fmt.byes) x.p_bye++
      })
      const play = (hi: string, lo: string, type: GameType): string => {
        const real = playedPost.get(`${type}:${[hi, lo].sort().join('-')}`)
        if (real) return real
        const diff = r.get(hi)! - r.get(lo)! + HFA
        const won = rand() < winProb(diff)
        update(hi, lo, diff, won)
        return won ? hi : lo
      }
      const bySeed = (xs: string[]) => xs.sort((a, b) => seedOf.get(a)! - seedOf.get(b)!)
      const wc = pairUp(seeds.slice(fmt.byes)).map(([a, b]) => play(a, b, 'WC'))
      const round2 = bySeed([...seeds.slice(0, fmt.byes), ...wc])
      round2.forEach((a) => tally.get(a)!.p_round2++)
      const round3 = bySeed(pairUp(round2).map(([a, b]) => play(a, b, 'DIV')))
      round3.forEach((a) => tally.get(a)!.p_round3++)
      const champ = play(round3[0], round3[1], 'CON')
      tally.get(champ)!.p_sb++
      champs[c] = champ
    }
    const afc = champs.AFC!
    const nfc = champs.NFC!
    const real = playedPost.get(`SB:${[afc, nfc].sort().join('-')}`)
    const winner = real ?? (rand() < winProb(r.get(afc)! - r.get(nfc)!) ? afc : nfc)
    tally.get(winner)!.p_title++
  }

  const out: Record<string, SimTeam> = {}
  const n = opts.sims
  for (const [a, x] of tally) {
    out[a] = {
      team: a, p_div: x.p_div / n, p_playoffs: x.p_playoffs / n, p_bye: x.p_bye / n, p_seed: x.p_seed.map((v) => v / n),
      p_round2: x.p_round2 / n, p_round3: x.p_round3 / n, p_sb: x.p_sb / n, p_title: x.p_title / n,
    }
  }
  return out
}
