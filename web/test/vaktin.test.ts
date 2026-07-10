import { describe, expect, it } from 'vitest'
import { evaluateLeg, evaluateSlip, type SlipLeg } from '../src/lib/vaktin'
import type { WcMatchRow } from '../src/lib/queries'

const mkMatch = (over: Partial<WcMatchRow>): WcMatchRow => ({
  id: 98, round: 6, date: '2026-07-10T19:00:00Z', venue: null, grp: null,
  home: 'Spain', away: 'Belgium', home_score: null, away_score: null, winner: null,
  ...over,
})
const leg = (over: Partial<SlipLeg>): SlipLeg => ({ id: 'a', match_id: 98, market: 'urslit', label: 'x', ...over })

const PAST = '2020-01-01T00:00:00Z'
const FUTURE = '2030-01-01T00:00:00Z'

describe('evaluateLeg — úrslit', () => {
  it('wins on correct pick, loses on wrong', () => {
    const m = mkMatch({ date: PAST, home_score: 2, away_score: 1 })
    expect(evaluateLeg(leg({ pick: '1' }), m).status).toBe('vann')
    expect(evaluateLeg(leg({ pick: '2' }), m).status).toBe('tapad')
    expect(evaluateLeg(leg({ pick: 'X' }), m).status).toBe('tapad')
  })
  it('is obyrjad before kickoff and i_gangi without final score', () => {
    expect(evaluateLeg(leg({ pick: '1' }), mkMatch({ date: FUTURE })).status).toBe('obyrjad')
    expect(evaluateLeg(leg({ pick: '1' }), mkMatch({ date: PAST })).status).toBe('i_gangi')
  })
})

describe('evaluateLeg — mörk', () => {
  it('over secures early, under dies early', () => {
    const live = mkMatch({ date: PAST, home_score: 2, away_score: 1 })
    // feed only has final scores, but logic must handle partial data the same way
    expect(evaluateLeg(leg({ market: 'mork_yfir', line: 2.5 }), live).status).toBe('vann')
    expect(evaluateLeg(leg({ market: 'mork_undir', line: 2.5 }), live).status).toBe('tapad')
  })
  it('under holds while below the line and match unfinished', () => {
    const m = mkMatch({ date: PAST, home_score: 1, away_score: 0 })
    // finished → settle
    expect(evaluateLeg(leg({ market: 'mork_undir', line: 2.5 }), m).status).toBe('vann')
  })
})

describe('evaluateLeg — bæði skora + markaskorari', () => {
  it('BTTS wins as soon as both have scored', () => {
    expect(evaluateLeg(leg({ market: 'baedi_skora' }), mkMatch({ date: PAST, home_score: 1, away_score: 1 })).status).toBe('vann')
    expect(evaluateLeg(leg({ market: 'baedi_skora' }), mkMatch({ date: PAST, home_score: 3, away_score: 0 })).status).toBe('tapad')
  })
  it('scorer uses events when present (accent-insensitive), manual fallback otherwise', () => {
    const m = mkMatch({ date: PAST, home_score: 1, away_score: 0 })
    const events = [{ type: 'Goal', detail: 'Normal Goal', player: { name: 'Julián Álvarez' }, team: { name: 'Spain' } }]
    expect(evaluateLeg(leg({ market: 'markaskorari', player: 'Julian Alvarez' }), m, events).status).toBe('vann')
    expect(evaluateLeg(leg({ market: 'markaskorari', player: 'Olise' }), m, events).status).toBe('tapad')
    expect(evaluateLeg(leg({ market: 'markaskorari', player: 'Olise' }), m, null).status).toBe('handvirkt')
    expect(evaluateLeg(leg({ market: 'markaskorari', player: 'Olise', manualDone: true }), m, null).status).toBe('vann')
  })
  it('ignores own goals for scorer legs', () => {
    const m = mkMatch({ date: PAST, home_score: 1, away_score: 0 })
    const og = [{ type: 'Goal', detail: 'Own Goal', player: { name: 'Olise' }, team: { name: 'Spain' } }]
    expect(evaluateLeg(leg({ market: 'markaskorari', player: 'Olise' }), m, og).status).toBe('tapad')
  })
})

describe('evaluateSlip', () => {
  it('aggregates and kills the slip on any lost leg', () => {
    const matches = new Map([[98, mkMatch({ date: PAST, home_score: 2, away_score: 0 })]])
    const s = evaluateSlip(
      [leg({ id: '1', pick: '1' }), leg({ id: '2', market: 'baedi_skora' }), leg({ id: '3', market: 'mork_yfir', line: 1.5 })],
      matches,
    )
    expect(s.vann).toBe(2)
    expect(s.tapad).toBe(1)
    expect(s.alive).toBe(false)
  })
})
