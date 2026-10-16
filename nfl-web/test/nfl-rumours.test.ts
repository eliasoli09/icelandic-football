import { describe, it, expect } from 'vitest'
import { countdown, isRumour, tradeTeams, TRADE_DEADLINE } from '../src/lib/nfl/rumours'

describe('isRumour', () => {
  it('slúður um skipti', () => {
    for (const t of [
      'Chiefs acquire WR in deal with Raiders',
      'Cowboys open to trading veteran pass rusher',
      'Report: Jets have shopped receiver, could be on the block',
      'Eagles traded for a linebacker on Tuesday',
      'Several teams have trade interest in the Titans running back',
      'Browns receive 2027 pick in exchange for defensive end',
      'Bills, Dolphins discuss swap of backup quarterbacks',
    ]) expect([t, isRumour(t)]).toEqual([t, true])
  })
  it('ekki slúður', () => {
    for (const t of [
      'Chiefs beat Raiders 31-17 on Sunday night',
      'Mahomes questionable with ankle injury',
      'What to watch before the trade deadline',
      'Patriots sign veteran tight end off practice squad',
      'Fantasy football: 17 players to trade for before Week 7',
    ]) expect([t, isRumour(t)]).toEqual([t, false])
  })
})

describe('countdown', () => {
  it('fresturinn er kl. 21:00 að íslenskum tíma 10. nóvember', () => {
    expect(TRADE_DEADLINE).toBe('2026-11-10T21:00:00.000Z')
    expect(countdown(new Date('2026-10-17T14:30:00Z'))).toEqual({ days: 24, hours: 6, minutes: 30 })
    expect(countdown(new Date('2026-11-10T20:59:00Z'))).toEqual({ days: 0, hours: 0, minutes: 1 })
  })
  it('null þegar fresturinn er liðinn', () => {
    expect(countdown(new Date('2026-11-10T21:00:00Z'))).toBeNull()
  })
})

describe('tradeTeams', () => {
  it('öll lið í skiptunum, einu sinni', () => {
    expect(tradeTeams({ moves: [{ player: 'A', from: 'LV', to: 'NYJ' }, { player: 'B', from: 'NYJ', to: 'LV' }] })).toEqual(['LV', 'NYJ'])
  })
})
