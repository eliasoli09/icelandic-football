import { describe, expect, it } from 'vitest'
import { KEY, MIN_GAMES, cleanName, nameProblem, rank, winPct, type Row } from '../src/lib/leaderboard/rank'

const row = (name: string, won: number, played: number): Row =>
  ({ id: name, name, won, played, winPct: winPct(won, played) })

describe('the leaderboard order', () => {
  it('counts wins as whole per cent of games played', () => {
    expect(winPct(0, 0)).toBe(0)
    expect(winPct(1, 3)).toBe(33)
    expect(winPct(2, 3)).toBe(67)
    expect(winPct(7, 7)).toBe(100)
  })

  it('ranks by wins, and the better percentage settles a tie', () => {
    const rows = [row('Anna', 4, 10), row('Baldur', 6, 12), row('Dísa', 6, 8)]
    expect(rank(rows, 'won').map((r) => r.name)).toEqual(['Dísa', 'Baldur', 'Anna'])
  })

  it('keeps a one-game hundred per cent off the top of the percentage board', () => {
    const rows = [row('Eitt', 1, 1), row('Þrautseig', 8, 10), row('Jafn', 8, 12)]
    const ranked = rank(rows, 'pct')
    expect(ranked.map((r) => r.name)).toEqual(['Þrautseig', 'Jafn'])
    expect(rows.filter((r) => r.played < MIN_GAMES)).toHaveLength(1)
  })

  it('does not disturb the rows it was given', () => {
    const rows = [row('Anna', 1, 4), row('Baldur', 3, 4)]
    rank(rows, 'won')
    expect(rows.map((r) => r.name)).toEqual(['Anna', 'Baldur'])
  })
})

describe('the name on the board', () => {
  it('takes an ordinary Icelandic name', () => {
    expect(nameProblem('Þórdís Ösp')).toBeNull()
    expect(cleanName('  Þórdís   Ösp ')).toBe('Þórdís Ösp')
  })
  it('refuses what is too short, too long or full of signs', () => {
    expect(nameProblem(' a ')).toContain('tveir stafir')
    expect(nameProblem('x'.repeat(25))).toContain('24')
    expect(nameProblem('<script>')).toContain('bókstafi')
  })
})

describe('what counts as one puzzle', () => {
  it('names the puzzle, not the day it was played', () => {
    expect(KEY.tenaball('island-landsleikir')).toBe('island-landsleikir')
    expect(KEY.hver('4711', 'hard')).toBe('hard:4711')
    expect(KEY.byrjunarlid('liverpool-milan-2005', 'away')).toBe('liverpool-milan-2005:away')
    // the cup draws fresh players every run, so it is counted once a day per mode
    expect(KEY.bikar('sogulegt', 20716)).toBe('sogulegt:20716')
  })
})
