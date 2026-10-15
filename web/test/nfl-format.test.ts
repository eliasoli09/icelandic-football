import { describe, it, expect } from 'vitest'
import { qbAdjLabel, spreadLabel, totalLabel, pctLabel, diffLabel, REASON_LABEL } from '../src/lib/nfl/format'

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

import { barColor, modelSpreadLabel, probLabel } from '../src/lib/nfl/format'

describe('spásnið', () => {
  it('líkur og forgjöf líkansins á hálfu stigi', () => {
    expect(probLabel(0.584)).toBe('58%')
    expect(modelSpreadLabel('DEN', 'SEA', -2.2)).toBe('SEA −2')
    expect(modelSpreadLabel('DEN', 'SEA', 3.3)).toBe('DEN −3,5')
    expect(modelSpreadLabel('DEN', 'SEA', 0.1)).toBe('Jafnt')
  })
  it('litur sem sést: dökkblár víkur fyrir aukalit', () => {
    expect(barColor({ color: '#002244', color2: '#69be28' })).toBe('#69be28')
    expect(barColor({ color: '#e31837', color2: '#ffb612' })).toBe('#e31837')
    expect(barColor({ color: '#000000', color2: '#ffffff' })).toBe('var(--text-2)')
  })
})

import { eloMove } from '../src/lib/nfl/format'

describe('eloMove', () => {
  it('ör aðeins þegar breytingin rúnnast ekki í núll', () => {
    expect(eloMove(-0.3)).toEqual({ text: '0', dir: 'flat' })
    expect(eloMove(17.6)).toEqual({ text: '▲ 18', dir: 'up' })
    expect(eloMove(-38.2)).toEqual({ text: '▼ 38', dir: 'down' })
  })
})

describe('qbAdjLabel', () => {
  it('formerki og heil Elo-stig með alvöru mínus', () => {
    expect(qbAdjLabel(-64.6)).toBe('−65 Elo')
    expect(qbAdjLabel(53.2)).toBe('+53 Elo')
    expect(qbAdjLabel(0.3)).toBe('0 Elo')
  })
})
