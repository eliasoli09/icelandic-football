import { describe, expect, it } from 'vitest'
import { formatUefaNumber, probabilityLabel, probabilityWidth, strengthScale, sortStandings } from '../src/lib/uefaDisplay'

describe('UEFA presentation preserves data', () => {
  it('uses stable Icelandic decimals and distinguishes zero from missing', () => {
    expect(formatUefaNumber(15.8, 1)).toBe('15,8')
    expect(formatUefaNumber(20000)).toBe('20.000')
    expect(formatUefaNumber(0)).toBe('0')
    expect(formatUefaNumber(null)).toBe('-')
  })
  it('keeps independent raw probability widths rather than normalizing rounded totals', () => {
    const values = [.655, .315, .03]
    expect(values.map(probabilityLabel)).toEqual(['66%', '32%', '3%'])
    expect(values.map(probabilityWidth)).toEqual([65.5, 31.5, 3])
    expect(probabilityLabel(0)).toBe('0%')
    expect(probabilityLabel(.001)).toBe('<1%')
    expect(probabilityLabel(null)).toBe('-')
  })
  it('gives all league bars one zero-based scale with visible headroom', () => {
    const scale = strengthScale([1809, 1624, 0])
    expect(scale).toBe(1900)
    expect(1809 / scale).toBeGreaterThan(1624 / scale)
    expect(strengthScale([])).toBe(100)
  })
  it('sorts all 36 rows without mutating data or losing their original rank', () => {
    const rows = Array.from({length:36},(_,i)=>({club:`Lið ${i}`,rank:i+1,rating:i===2?null:2000-i,proj_points:36-i,p_top8:i/36,p_playoff:0,p_out:0}))
    const sorted=sortStandings(rows,'p_top8','desc')
    expect(sorted).toHaveLength(36)
    expect(sorted[0].rank).toBe(36)
    expect(rows[0].rank).toBe(1)
    expect(sortStandings(rows,'rating','asc').at(-1)?.club).toBe('Lið 2')
  })
})
