/**
 * How great a side was, from its verified season: the league (points and goal
 * difference per game, and the margin over the best other side), a cup double,
 * and Europe that summer (ties won, a group or league phase, knockout rounds
 * beyond it). The league figures are standardised across the sides compared,
 * so an era of ten clubs and one of twelve stand side by side.
 */
export interface VerifiedSide {
  year: number; club: string; label: string; champion: boolean; position: number
  record: { w: number; d: number; l: number; gf: number; ga: number; games: number; points: number }
  bestOther: number; cupDouble: boolean
  europe: { round: string; through: boolean }[]
}

export const WEIGHTS = { ppg: 1, gdpg: 1, margin: 0.5, champion: 0.5, double: 0.5, tie: 0.3, mainPhase: 1, knockout: 0.5 }

export interface Europe { tiesWon: number; mainPhase: boolean; knockout: boolean }

export function europeOf(side: VerifiedSide): Europe {
  const stage = (r: string) => r.split(': ')[1] ?? r
  const phase = (r: string) => /group stage|league phase|league stage/i.test(stage(r))
  return {
    // a tie is a two-legged round; group and league matches are not ties
    tiesWon: side.europe.filter((t) => t.through && !phase(t.round)).length,
    mainPhase: side.europe.some((t) => phase(t.round)),
    knockout: side.europe.some((t) => /knockout|round of 16|quarter|semi/i.test(stage(t.round))),
  }
}

export function rank<T extends VerifiedSide>(sides: T[]): (T & { score: number; europeSummary: Europe })[] {
  const per = (s: T) => ({
    ppg: s.record.points / s.record.games,
    gdpg: (s.record.gf - s.record.ga) / s.record.games,
    margin: (s.record.points - s.bestOther) / s.record.games,
  })
  const values = sides.map(per)
  const z = (key: 'ppg' | 'gdpg' | 'margin') => {
    const xs = values.map((v) => v[key])
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1
    return (x: number) => (x - mean) / sd
  }
  const zp = z('ppg'), zg = z('gdpg'), zm = z('margin')
  return sides
    .map((s, i) => {
      const e = europeOf(s)
      const v = values[i]
      const score = WEIGHTS.ppg * zp(v.ppg) + WEIGHTS.gdpg * zg(v.gdpg) + WEIGHTS.margin * zm(v.margin)
        + (s.champion ? WEIGHTS.champion : 0) + (s.cupDouble ? WEIGHTS.double : 0)
        + WEIGHTS.tie * e.tiesWon + (e.mainPhase ? WEIGHTS.mainPhase : 0) + (e.knockout ? WEIGHTS.knockout : 0)
      return { ...s, score: Math.round(score * 100) / 100, europeSummary: e }
    })
    .sort((a, b) => b.score - a.score)
}
