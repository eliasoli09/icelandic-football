import { describe, it, expect } from 'vitest'
import { GROUP_COLUMNS } from '../src/lib/nfl/statColumns'

describe('dálkar leikmannasíðunnar', () => {
  it('mínusmerki og komma', () => {
    const rush = GROUP_COLUMNS.hlaup.find((c) => c.title === 'Hlaupajardar')!
    expect(rush.value({ rushing_yards: -1 })).toBe('−1')
    const sacks = GROUP_COLUMNS.vorn.find((c) => c.label === 'Fellur')!
    expect(sacks.value({ def_sacks: 2.5 })).toBe('2,5')
    const epa = GROUP_COLUMNS.sendingar.find((c) => c.label === 'EPA')!
    expect(epa.value({ passing_epa: -2.44 })).toBe('−2,4')
  })
  it('tæklingar eru einar + aðstoð', () => {
    expect(GROUP_COLUMNS.vorn[0].value({ tackles_solo: 5, tackle_assists: 3 })).toBe('8')
  })
})
