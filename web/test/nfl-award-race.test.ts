import { describe, it, expect } from 'vitest'
import { fitLogit, logitProbs, standardize, lossAndGrad, type Group } from '../src/lib/nfl/awardRace'

describe('skilyrt logit', () => {
  it('líkur innan hóps summast í 1', () => {
    const p = logitProbs([[1, 0], [0, 1], [2, 2]], [0.5, -0.3])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })
  it('stigullinn passar við tölulega afleiðu', () => {
    const groups: Group[] = [
      { x: [[1, 0.2], [0.3, 1], [-1, 0.5]], winners: [0] },
      { x: [[0.1, 0.1], [2, -1]], winners: [1] },
    ]
    const w = [0.3, -0.7]
    const { grad } = lossAndGrad(groups, w, 0.1)
    for (let k = 0; k < w.length; k++) {
      const h = 1e-6
      const up = w.slice(); up[k] += h
      const dn = w.slice(); dn[k] -= h
      const num = (lossAndGrad(groups, up, 0.1).loss - lossAndGrad(groups, dn, 0.1).loss) / (2 * h)
      expect(grad[k]).toBeCloseTo(num, 5)
    }
  })
  it('lærir að hærra einkenni vinnur', () => {
    const groups: Group[] = Array.from({ length: 40 }, (_, g) => {
      const x = Array.from({ length: 10 }, (_, i) => [Math.sin(g * 7 + i * 3), (i * 37 + g * 11) % 10 / 10])
      const best = x.reduce((b, r, i) => (r[1] > x[b][1] ? i : b), 0)
      return { x, winners: [best] }
    })
    const w = fitLogit(groups, 0.01)
    expect(w[1]).toBeGreaterThan(Math.abs(w[0]) * 3)
    const hits = groups.filter((gr) => { const p = logitProbs(gr.x, w); return p.indexOf(Math.max(...p)) === gr.winners[0] }).length
    expect(hits / groups.length).toBeGreaterThan(0.9)
  })
  it('stöðlun notar meðaltal og staðalfrávik þjálfunargagna', () => {
    const s = standardize([[1, 10], [3, 30]])
    expect(s.apply([2, 20])).toEqual([0, 0])
    expect(s.apply([3, 30])[0]).toBeCloseTo(1, 12)
  })
})
