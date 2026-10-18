import { describe, it, expect } from 'vitest'
import { freshMoments, scoringMoments } from '../src/lib/nfl/celebrations'
import type { LiveEvent } from '../src/lib/nfl/live'

const teams = [{ abbr: 'JAX', name: 'Jacksonville Jaguars' }, { abbr: 'HOU', name: 'Houston Texans' }]
const ev = (type: string, home: number, away: number, team = '', minute = '10:00'): LiveEvent => ({ quarter: 'Q1', minute, team, player: null, type, comment: `${type} play`, homeScore: home, awayScore: away })
const game = (events: LiveEvent[]) => ({ game_id: 'g1', home: 'JAX', away: 'HOU', events })

describe('scoringMoments', () => {
  it('keeps touchdowns and field goals, not the extra points', () => {
    const m = scoringMoments([game([ev('TD', 6, 0, 'Jacksonville Jaguars'), ev('PAT', 7, 0, 'Jacksonville Jaguars', '09:58'), ev('FG', 7, 3, 'Houston Texans', '04:00')])], teams)
    expect(m.map((x) => [x.kind, x.team])).toEqual([['TD', 'JAX'], ['FG', 'HOU']])
  })
  it('finds the scorer from the score when the feed gives no club', () => {
    const m = scoringMoments([game([ev('TD', 0, 6), ev('PAT', 0, 7, '', '09:58'), ev('TD', 6, 7, '', '02:00')])], teams)
    expect(m.map((x) => x.team)).toEqual(['HOU', 'JAX'])
  })
})

describe('freshMoments', () => {
  it('the first look only takes note, later plays come once', () => {
    const first = scoringMoments([game([ev('TD', 6, 0, 'Jacksonville Jaguars')])], teams)
    const a = freshMoments(null, first)
    expect(a.fresh).toEqual([])
    const second = scoringMoments([game([ev('TD', 6, 0, 'Jacksonville Jaguars'), ev('FG', 7, 3, 'Houston Texans', '04:00')])], teams)
    const b = freshMoments(a.seen, second)
    expect(b.fresh.map((x) => x.kind)).toEqual(['FG'])
    expect(freshMoments(b.seen, second).fresh).toEqual([])
  })
})
