import { describe, expect, it } from 'vitest'
import {
  BY_ID, CLUBS, LAUNCH_DAY, POOLS, TOP5, addGuess, dailyClub, emptyStats, evaluate, isOver, newGame, record, restore,
  shareText, suggest, won,
} from '../src/lib/vallarleit/game'
import { LEAGUES } from '../src/lib/vallarleit/leagues'
import { distanceM, formatM, heat, heatWord } from '../src/lib/vallarleit/geo'

const id = (name: string) => CLUBS.find((c) => c.name === name)!.id

describe('Vallarleit: the clubs', () => {
  it('has every league, each with a believable number of clubs, all placed in Europe', () => {
    for (const l of LEAGUES) {
      const n = CLUBS.filter((c) => c.league === l.key).length
      expect(n, l.key).toBeGreaterThanOrEqual(8)
      expect(n, l.key).toBeLessThanOrEqual(24)
    }
    for (const c of CLUBS) {
      expect(c.lat, c.name).toBeGreaterThan(27)
      expect(c.lat, c.name).toBeLessThan(71)
      expect(c.lon, c.name).toBeGreaterThan(-26)
      expect(c.lon, c.name).toBeLessThan(90)
    }
  })

  it('has unique ids and unique names on screen', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length)
    expect(new Set(CLUBS.map((c) => c.name)).size).toBe(CLUBS.length)
  })

  it('knows where the famous grounds are', () => {
    // Anfield and Goodison/Hill Dickinson are under 3 km apart; San Siro is shared
    expect(distanceM(BY_ID.get(id('Liverpool'))!, BY_ID.get(id('Everton'))!)).toBeLessThan(4000)
    expect(distanceM(BY_ID.get(id('Inter Milan'))!, BY_ID.get(id('Milan'))!)).toBeLessThan(150)
    const bernabeu = BY_ID.get(id('Real Madrid'))!
    expect(bernabeu.lat).toBeCloseTo(40.453, 1)
    expect(bernabeu.lon).toBeCloseTo(-3.688, 1)
  })

  it('splits the big five into three pools, the famous clubs first', () => {
    expect(TOP5.length).toBe(96)
    expect(POOLS.easy.map((c) => c.name)).toContain('Barcelona')
    expect(POOLS.hard.map((c) => c.name)).not.toContain('Barcelona')
    expect(POOLS.easy.length + POOLS.medium.length + POOLS.hard.length).toBe(TOP5.length)
  })
})

describe('Vallarleit: the daily ground', () => {
  it('walks every club in a pool before one comes back', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const n = POOLS[level].length
      const seen = new Set(Array.from({ length: n }, (_, i) => dailyClub(level, LAUNCH_DAY + i).id))
      expect(seen.size, level).toBe(n)
      expect(dailyClub(level, LAUNCH_DAY + n).id).toBe(dailyClub(level, LAUNCH_DAY).id)
    }
  })

  it('is the same for everyone on a given day', () => {
    expect(newGame('hard', LAUNCH_DAY + 5).answer).toBe(newGame('hard', LAUNCH_DAY + 5).answer)
  })
})

describe('Vallarleit: playing', () => {
  const game = { level: 'easy' as const, day: LAUNCH_DAY, answer: id('Milan'), guesses: [] as string[] }

  it('marks a neighbour on the same ground, and the right club as a win', () => {
    let g = addGuess(game, id('Inter Milan'))
    const [inter] = evaluate(g)
    expect(inter.sameGround).toBe(true)
    expect(inter.correct).toBe(false)
    expect(won(g)).toBe(false)
    g = addGuess(g, id('Milan'))
    expect(won(g)).toBe(true)
    expect(isOver(g)).toBe(true)
    expect(addGuess(g, id('Juventus'))).toBe(g)
  })

  it('ignores a repeated guess', () => {
    const g = addGuess(addGuess(game, id('Juventus')), id('Juventus'))
    expect(g.guesses).toHaveLength(1)
  })

  it('gets warmer as guesses close in', () => {
    expect(heat(5_000)).toBeGreaterThan(heat(50_000))
    expect(heat(50_000)).toBeGreaterThan(heat(2_000_000))
    expect(heat(0)).toBe(1)
    expect(heatWord(10_000)).toBe('Sjóðheitt')
    expect(formatM(1234567.4)).toBe('1.234.567 m')
  })

  it('suggests by any name, best known first, never a guessed club', () => {
    expect(suggest('real m', 'easy', new Set())[0].name).toBe('Real Madrid')
    expect(suggest('bayern', 'easy', new Set([id('Bayern Munich')])).map((c) => c.name)).not.toContain('Bayern Munich')
    // Icelandic clubs only in the impossible level
    expect(suggest('víkingur', 'easy', new Set())).toHaveLength(0)
    expect(suggest('víkingur', 'impossible', new Set()).length).toBeGreaterThan(0)
  })

  it('restores only a game that belongs to this level and day', () => {
    const raw = JSON.stringify(addGuess(game, id('Juventus')))
    expect(restore(raw, 'easy', LAUNCH_DAY)?.guesses).toHaveLength(1)
    expect(restore(raw, 'easy', LAUNCH_DAY + 1)).toBeNull()
    expect(restore(raw, 'hard', LAUNCH_DAY)).toBeNull()
    expect(restore('nonsense', 'easy', LAUNCH_DAY)).toBeNull()
  })

  it('counts a win once and keeps a streak across days', () => {
    const w = addGuess(game, id('Milan'))
    let s = record(emptyStats(), w, LAUNCH_DAY)
    s = record(s, w, LAUNCH_DAY)
    expect(s.played).toBe(1)
    s = record(s, { ...w, day: LAUNCH_DAY + 1 }, LAUNCH_DAY + 1)
    expect(s.streak).toBe(2)
    s = record(s, { ...game, day: LAUNCH_DAY + 2, gaveUp: true }, LAUNCH_DAY + 2)
    expect(s.streak).toBe(0)
    expect(s.best).toBe(2)
  })

  it('shares squares, not the answer', () => {
    const g = addGuess(addGuess(game, id('Real Madrid')), id('Milan'))
    const text = shareText(g)
    expect(text).toContain('Vallarleit #1')
    expect(text).toContain('🏟️')
    expect(text).not.toMatch(/Milan|San Siro/)
  })
})
