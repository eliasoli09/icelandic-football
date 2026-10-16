import { describe, it, expect } from 'vitest'
import { MODEL_ID, lastGameOf, modelPicks, pickPoints, pickWeek, seasonBoard, weekBoard, type PickGame } from '../src/lib/nfl/pickem'

let n = 0
const g = (week: number, home: string, hs: number | null, away: string, as: number | null, day = week, hour = 17): PickGame => ({
  game_id: `2026_${week}_${away}_${home}_${n++}`, season: 2026, week, game_type: 'REG',
  kickoff: `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  home, away, home_score: hs, away_score: as,
})

describe('pickPoints', () => {
  it('1 fyrir réttan, 0 fyrir rangan, ½ fyrir jafntefli, null óspilað', () => {
    const won = g(1, 'A', 20, 'B', 10)
    expect(pickPoints('A', won)).toBe(1)
    expect(pickPoints('B', won)).toBe(0)
    expect(pickPoints('B', g(1, 'A', 17, 'B', 17))).toBe(0.5)
    expect(pickPoints('A', g(1, 'A', null, 'B', null))).toBeNull()
  })
})

describe('modelPicks', () => {
  it('velur sigurstranglegra liðið, heimaliðið á jöfnu', () => {
    const a = g(1, 'A', null, 'B', null)
    const b = g(1, 'C', null, 'D', null)
    const c = g(1, 'E', null, 'F', null)
    const picks = modelPicks([a, b, c], new Map([[a.game_id, 0.6], [b.game_id, 0.4], [c.game_id, 0.5]]))
    expect(picks.map((p) => p.pick)).toEqual(['A', 'D', 'E'])
    expect(picks.every((p) => p.player === MODEL_ID)).toBe(true)
  })
  it('enginn leikur án líkna', () => {
    expect(modelPicks([g(1, 'A', null, 'B', null)], new Map())).toEqual([])
  })
})

describe('lastGameOf og pickWeek', () => {
  const w1 = [g(1, 'A', 20, 'B', 10, 1, 17), g(1, 'C', 3, 'D', 7, 3, 1)]
  const w2 = [g(2, 'A', null, 'C', null, 8, 17), g(2, 'B', null, 'D', null, 9, 1)]
  it('síðasti leikur umferðar eftir upphafstíma', () => {
    expect(lastGameOf([...w1, ...w2], 2026, 1)!.game_id).toBe(w1[1].game_id)
    expect(lastGameOf(w1, 2026, 5)).toBeNull()
  })
  it('fyrsta umferð sem á óhafinn leik', () => {
    expect(pickWeek([...w1, ...w2], new Date('2026-09-05T00:00:00Z'))).toEqual({ season: 2026, week: 2 })
    // the first game of week 2 has started, the second has not
    expect(pickWeek([...w1, ...w2], new Date('2026-09-08T20:00:00Z'))).toEqual({ season: 2026, week: 2 })
    expect(pickWeek([...w1, ...w2], new Date('2026-09-10T00:00:00Z'))).toBeNull()
  })
})

describe('töflur', () => {
  const games = [g(1, 'A', 20, 'B', 10, 1, 17), g(1, 'C', 3, 'D', 7, 3, 1), g(2, 'A', 10, 'C', 13, 8)]
  const [x, y, z] = games
  const names = new Map([['u1', 'Anna'], ['u2', 'Bjarni'], ['u3', 'Clara']])
  const picks = [
    { player: 'u1', game_id: x.game_id, pick: 'A' }, { player: 'u1', game_id: y.game_id, pick: 'D' },
    { player: 'u2', game_id: x.game_id, pick: 'A' }, { player: 'u2', game_id: y.game_id, pick: 'D' },
    { player: 'u3', game_id: x.game_id, pick: 'B' }, { player: 'u3', game_id: z.game_id, pick: 'C' },
    { player: MODEL_ID, game_id: x.game_id, pick: 'A' }, { player: MODEL_ID, game_id: y.game_id, pick: 'C' },
  ]
  it('vikan: stig, svo bráðabani (heildarstig síðasta leiks = 10)', () => {
    const board = weekBoard(games, picks, [
      { player: 'u1', season: 2026, week: 1, total: 20 }, { player: 'u2', season: 2026, week: 1, total: 9 },
    ], names, 2026, 1)
    expect(board.map((r) => [r.name, r.points, r.place])).toEqual([['Bjarni', 2, 1], ['Anna', 2, 2], ['Líkanið', 1, 3], ['Clara', 0, 4]])
    expect(board[0].tiebreakOff).toBe(1)
    expect(board.find((r) => r.id === MODEL_ID)!.model).toBe(true)
  })
  it('jafnir deila sæti', () => {
    const board = weekBoard(games, picks, [], names, 2026, 1)
    expect(board.map((r) => r.place)).toEqual([1, 1, 3, 4])
  })
  it('tímabilið leggur saman allar umferðir', () => {
    const board = seasonBoard(games, picks, names, 2026)
    expect(board.map((r) => [r.name, r.points, r.place])).toEqual([['Anna', 2, 1], ['Bjarni', 2, 1], ['Clara', 1, 3], ['Líkanið', 1, 3]])
  })
})
