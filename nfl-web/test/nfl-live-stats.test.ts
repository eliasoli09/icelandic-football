import { readFileSync, existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { parsePlayerStats, parseTeamStats, planInterval } from '../src/lib/nfl/live'

const players = {
  response: [{
    team: { name: 'Denver Broncos' },
    groups: [
      { name: 'Passing', players: [{ player: { id: 1, name: 'Bo Nix' }, statistics: [{ name: 'yards', value: '107' }, { name: 'passing touch downs', value: '1' }, { name: 'interceptions', value: '0' }, { name: 'two pt', value: '0' }] }] },
      { name: 'Rushing', players: [{ player: { id: 1, name: 'Bo Nix' }, statistics: [{ name: 'yards', value: '23' }, { name: 'rushing touch downs', value: '0' }] }, { player: { id: 2, name: 'J.K. Dobbins' }, statistics: [{ name: 'yards', value: '41' }, { name: 'rushing touch downs', value: '1' }] }] },
      { name: 'Receiving', players: [{ player: { id: 3, name: 'RJ Harvey' }, statistics: [{ name: 'total receptions', value: '3' }, { name: 'yards', value: '31' }, { name: 'receiving touch downs', value: '0' }] }] },
      { name: 'Fumbles', players: [{ player: { id: 2, name: 'J.K. Dobbins' }, statistics: [{ name: 'lost', value: '1' }] }] },
      { name: 'Kicking', players: [{ player: { id: 4, name: 'Wil Lutz' }, statistics: [{ name: 'points', value: '5' }] }] },
    ],
  }],
}

describe('live stats', () => {
  it('merges a player across groups', () => {
    const p = parsePlayerStats(players)
    const nix = p.find((x) => x.name === 'Bo Nix')!
    expect(nix).toMatchObject({ team: 'Denver Broncos', passYds: 107, passTd: 1, rushYds: 23 })
    expect(p.find((x) => x.name === 'J.K. Dobbins')).toMatchObject({ rushYds: 41, rushTd: 1, fumLost: 1 })
    expect(p.find((x) => x.name === 'Wil Lutz')?.kPts).toBe(5)
    expect(parsePlayerStats({ errors: ['x'] })).toEqual([])
  })
  it('reads red-zone trips and the defence', () => {
    const t = parseTeamStats({ response: [{ team: { name: 'Denver Broncos' }, statistics: { red_zone: { made_att: '2-3' }, sacks: { total: 5 }, interceptions: { total: 2 }, fumbles_recovered: { total: 1 }, safeties: { total: 0 }, int_touchdowns: { total: 0 }, points_against: { total: 14 } } }] })
    expect(t[0]).toEqual({ team: 'Denver Broncos', rzMade: 2, rzAtt: 3, sacks: 5, ints: 2, fumRec: 1, safeties: 0, defTd: 0, pointsAgainst: 14 })
  })
  it('reads the real api-sports replies when they are on disk', () => {
    const dir = process.env.AS_SAMPLES
    if (!dir || !existsSync(`${dir}/as-players.json`)) return
    const p = parsePlayerStats(JSON.parse(readFileSync(`${dir}/as-players.json`, 'utf-8')))
    expect(p.length).toBeGreaterThan(20)
    expect(parseTeamStats(JSON.parse(readFileSync(`${dir}/as-teams.json`, 'utf-8')))).toHaveLength(2)
  })
  it('plans the stats share: no scoreboard, two requests a game', () => {
    const day = new Date('2026-10-18T12:00:00Z')
    const k = ['2026-10-18T17:00:00Z', '2026-10-18T17:00:00Z']
    // 4 h each, two games: 8 h of games × 2 requests = 57,600 s of request-time; budget 960 → 60 s
    expect(planInterval(k, day, 960, 15, 0, 2)).toBe(60)
    expect(planInterval(k, day, 960, 15)).toBe(45)
  })
})
