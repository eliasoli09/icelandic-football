import { describe, it, expect } from 'vitest'
import { spreadLabel, totalLabel, pctLabel, diffLabel, REASON_LABEL } from '../src/lib/nfl/format'

describe('NFL-snið', () => {
  it('forgjöf: jákvætt spread_line þýðir að heimaliðið er sigurstranglegra', () => {
    expect(spreadLabel({ home: 'DEN', away: 'SEA', spread_line: -2.5 })).toBe('SEA −2,5')
    expect(spreadLabel({ home: 'ATL', away: 'CHI', spread_line: 3 })).toBe('ATL −3')
    expect(spreadLabel({ home: 'A', away: 'B', spread_line: 0 })).toBe('Jafnt')
    expect(spreadLabel({ home: 'A', away: 'B', spread_line: null })).toBeNull()
  })
  it('heildarstig, hlutfall og mismunur með íslenskri kommu og alvöru mínus', () => {
    expect(totalLabel(40.5)).toBe('40,5')
    expect(pctLabel(2 / 3)).toBe('0,667')
    expect(diffLabel(12)).toBe('+12')
    expect(diffLabel(-7)).toBe('−7')
    expect(diffLabel(0)).toBe('0')
  })
  it('hvert viðmið hefur texta', () => {
    expect(REASON_LABEL.h2h).toBe('raðað eftir innbyrðis viðureignum')
    expect(Object.keys(REASON_LABEL).sort()).toEqual(['alpha', 'common', 'conference', 'diff', 'division', 'h2h', 'sov'])
  })
})
