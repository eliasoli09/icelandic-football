import { describe, it, expect } from 'vitest'
import { defenceScore, groupOf, offenceScore, starWeek, statLine, type StarLine } from '../src/lib/nfl/stars'

let n = 0
const L = (name: string, position: string, x: Partial<StarLine> = {}): StarLine => ({
  player_id: `p${n++}`, name, position, headshot: null, team: 'KC', opponent: 'LV', game_id: 'g',
  completions: 0, attempts: 0, passing_yards: 0, passing_tds: 0, interceptions: 0, carries: 0, rushing_yards: 0, rushing_tds: 0,
  receptions: 0, receiving_yards: 0, receiving_tds: 0, fumbles_lost: 0, tackles_solo: 0, tackle_assists: 0, tackles_for_loss: 0,
  def_sacks: 0, qb_hits: 0, def_interceptions: 0, passes_defended: 0, forced_fumbles: 0, def_tds: 0, ...x,
})

describe('stig', () => {
  it('sókn eins og fantasy: 300 jardar + 3 snertimörk − hlerun', () => {
    expect(offenceScore(L('Q', 'QB', { passing_yards: 300, passing_tds: 3, interceptions: 1 }))).toBe(22)
    expect(offenceScore(L('W', 'WR', { receptions: 8, receiving_yards: 120, receiving_tds: 1 }))).toBe(22)
  })
  it('vörn: fellur og hleranir vega mest', () => {
    expect(defenceScore(L('D', 'DE', { def_sacks: 2, tackles_solo: 4, tackles_for_loss: 2 }))).toBe(15)
  })
  it('stöðuhópar', () => {
    expect([groupOf('FB'), groupOf('OLB'), groupOf('SS'), groupOf('K'), groupOf(null)]).toEqual(['RB', 'LB', 'DB', null, null])
  })
})

describe('starWeek', () => {
  const lines = [
    L('Q1', 'QB', { passing_yards: 350, passing_tds: 4 }), L('Q2', 'QB', { passing_yards: 200, passing_tds: 1 }),
    L('R1', 'RB', { rushing_yards: 150, rushing_tds: 2 }), L('R2', 'RB', { rushing_yards: 110, rushing_tds: 1 }),
    L('W1', 'WR', { receptions: 9, receiving_yards: 140, receiving_tds: 2 }), L('W2', 'WR', { receptions: 5, receiving_yards: 60 }),
    L('T1', 'TE', { receptions: 6, receiving_yards: 70 }),
    L('D1', 'DT', { def_sacks: 3, tackles_solo: 4 }), L('B1', 'CB', { def_interceptions: 2, passes_defended: 3, tackles_solo: 3 }),
    L('LB1', 'ILB', { tackles_solo: 9, tackle_assists: 4, tackles_for_loss: 1 }), L('K', 'K', { passing_yards: 999 }),
  ]
  const w = starWeek(lines)
  it('einn í hverja stöðu og flex úr hópi sóknarmanna sem eftir eru', () => {
    expect(w.team.map((s) => `${s.slot}:${s.line.name}`)).toEqual(['QB:Q1', 'RB:R1', 'WR:W1', 'TE:T1', 'FLEX:R2', 'DL:D1', 'LB:LB1', 'DB:B1'])
  })
  it('leikstjórnandi, sóknarmaður og varnarmaður vikunnar', () => {
    expect(w.qb!.line.name).toBe('Q1')
    expect(w.offence!.line.name).toBe('W1')
    expect(w.defence!.line.name).toBe('B1')
  })
  it('tóm vika gefur tómt lið', () => {
    expect(starWeek([])).toEqual({ team: [], qb: null, offence: null, defence: null })
  })
  it('tölfræðilína á íslensku', () => {
    expect(statLine(lines[0], 'QB')).toBe('0/0 · 350 sendingajardar · 4 snertim.')
    expect(statLine(lines[7], 'DL')).toBe('3 fellur · 4 tæklingar')
  })
})
