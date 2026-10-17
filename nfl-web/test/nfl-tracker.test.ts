import { describe, expect, it } from 'vitest'
import type { LivePlayer } from '../src/lib/nfl/live'
import { defencePoints, findLive, legState, matchShown, normName, playerPoints, slipStatus, type GameNow } from '../src/lib/nfl/tracker'

const line = (o: Partial<LivePlayer>): LivePlayer => ({ name: 'X', team: 'KC', passYds: 0, passTd: 0, ints: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, fumLost: 0, twoPt: 0, kPts: 0, ...o })

describe('fantasy points', () => {
  it('scores a quarterback and a receiver in each format', () => {
    expect(playerPoints(line({ passYds: 300, passTd: 2, ints: 1, rushYds: 20 }), 'std')).toBeCloseTo(12 + 8 - 2 + 2)
    const wr = line({ rec: 8, recYds: 110, recTd: 1 })
    expect(playerPoints(wr, 'std')).toBeCloseTo(17)
    expect(playerPoints(wr, 'half')).toBeCloseTo(21)
    expect(playerPoints(wr, 'ppr')).toBeCloseTo(25)
    expect(playerPoints(line({ kPts: 10 }), 'ppr')).toBe(10)
  })
  it('scores a defence by what it did and what it allowed', () => {
    expect(defencePoints({ team: 'KC', rzMade: 0, rzAtt: 0, sacks: 3, ints: 1, fumRec: 1, safeties: 0, defTd: 1, pointsAgainst: 10 })).toBe(3 + 4 + 6 + 4)
    expect(defencePoints({ team: 'KC', rzMade: 0, rzAtt: 0, sacks: 0, ints: 0, fumRec: 0, safeties: 0, defTd: 0, pointsAgainst: 0 })).toBe(10)
    expect(defencePoints({ team: 'KC', rzMade: 0, rzAtt: 0, sacks: 0, ints: 0, fumRec: 0, safeties: 0, defTd: 0, pointsAgainst: 38 })).toBe(-4)
  })
})

describe('matching names', () => {
  it('ignores case, dots, accents and suffixes', () => {
    expect(normName('J.K. Dobbins')).toBe(normName('JK Dobbins'))
    expect(normName('Kenneth Walker III')).toBe(normName('Kenneth Walker'))
    expect(normName('Amon-Ra St. Brown')).toBe('amonrastbrown')
  })
  it('prefers the same club, else a unique name', () => {
    const live = [line({ name: 'Josh Allen', team: 'BUF' }), line({ name: 'Josh Allen', team: 'JAX' }), line({ name: 'Puka Nacua', team: 'LA' })]
    expect(findLive({ name: 'Josh Allen', team: 'JAX' }, live)?.team).toBe('JAX')
    expect(findLive({ name: 'Josh Allen', team: 'MIA' }, live)).toBeUndefined()
    expect(findLive({ name: 'Puka Nacua', team: 'LAR' }, live)?.team).toBe('LA')
  })
})

describe('bet legs', () => {
  const g = (o: Partial<GameNow>): GameNow => ({ game_id: 'g', home: 'KC', away: 'LV', homeScore: 14, awayScore: 10, live: true, final: false, ...o })
  it('a win is ahead, behind, won or lost', () => {
    const leg = { kind: 'win' as const, game_id: 'g', team: 'KC' }
    expect(legState(leg, g({}), undefined)).toEqual({ status: 'ahead', now: '14-10' })
    expect(legState({ ...leg, team: 'LV' }, g({}), undefined).status).toBe('behind')
    expect(legState(leg, g({ final: true, live: false }), undefined).status).toBe('won')
    expect(legState(leg, g({ homeScore: null, awayScore: null, live: false }), undefined).status).toBe('open')
  })
  it('a touchdown is won when it happens, lost only at the end', () => {
    const leg = { kind: 'td' as const, game_id: 'g', player_id: 'p', name: 'X', team: 'KC' }
    expect(legState(leg, g({}), line({ recTd: 1 })).status).toBe('won')
    expect(legState(leg, g({}), line({})).status).toBe('open')
    expect(legState(leg, g({ final: true }), line({})).status).toBe('lost')
  })
  it('a yards line is won once passed', () => {
    const leg = { kind: 'yards' as const, game_id: 'g', player_id: 'p', name: 'X', team: 'KC', stat: 'rush' as const, line: 74.5 }
    expect(legState(leg, g({}), line({ rushYds: 60 }))).toEqual({ status: 'open', now: '60 / 74,5' })
    expect(legState(leg, g({}), line({ rushYds: 80 })).status).toBe('won')
    expect(legState(leg, g({ final: true }), line({ rushYds: 60 })).status).toBe('lost')
  })
  it('a slip', () => {
    expect(slipStatus([{ status: 'won', now: null }, { status: 'lost', now: null }])).toBe('lost')
    expect(slipStatus([{ status: 'won', now: null }, { status: 'won', now: null }])).toBe('won')
    expect(slipStatus([{ status: 'won', now: null }, { status: 'ahead', now: null }])).toBe('open')
  })
})

describe('matching a screenshot', () => {
  const c = [
    { name: 'Josh Allen', team: 'BUF', position: 'QB' },
    { name: 'Josh Allen', team: 'JAX', position: 'DE' },
    { name: 'Keenan Allen', team: 'LAC', position: 'WR' },
    { name: 'Patrick Mahomes', team: 'KC', position: 'QB' },
  ]
  it('full names, initials and surnames', () => {
    expect(matchShown({ name: 'Patrick Mahomes', team: '', position: '' }, c)?.team).toBe('KC')
    expect(matchShown({ name: 'P. Mahomes', team: '', position: '' }, c)?.team).toBe('KC')
    expect(matchShown({ name: 'Mahomes', team: '', position: '' }, c)?.team).toBe('KC')
    expect(matchShown({ name: 'K. Allen', team: '', position: '' }, c)?.team).toBe('LAC')
  })
  it('club or position settles a shared name, else none', () => {
    expect(matchShown({ name: 'Josh Allen', team: 'BUF', position: '' }, c)?.position).toBe('QB')
    expect(matchShown({ name: 'J. Allen', team: '', position: 'QB' }, c)?.team).toBe('BUF')
    expect(matchShown({ name: 'Allen', team: '', position: '' }, c)).toBeNull()
  })
})
