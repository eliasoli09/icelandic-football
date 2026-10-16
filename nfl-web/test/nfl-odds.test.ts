import { describe, it, expect } from 'vitest'
import { devig, impliedProb } from '../src/lib/nfl/odds'

describe('amerískir stuðlar', () => {
  it('neikvæður og jákvæður stuðull', () => {
    expect(impliedProb(-142)).toBeCloseTo(142 / 242, 12)
    expect(impliedProb(120)).toBeCloseTo(100 / 220, 12)
  })
  it('álagið er dregið frá og summan er 1', () => {
    const p = devig(120, -142)!
    expect(p.home + p.away).toBeCloseTo(1, 12)
    expect(p.away).toBeCloseTo(0.5635, 3)
  })
  it('null ef stuðul vantar', () => {
    expect(devig(null, -142)).toBeNull()
  })
})
