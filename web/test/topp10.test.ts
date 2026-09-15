import { describe, it, expect } from 'vitest'
import { normalise } from '../src/lib/topp10/normalise'
import { matchGuess, ambiguousAliases } from '../src/lib/topp10/match'
import { newGame, guess, hint, hintFor, LIVES } from '../src/lib/topp10/game'
import { dailyList, dayNumber } from '../src/lib/topp10/daily'
import { shareText } from '../src/lib/topp10/share'
import type { Topp10List } from '../src/lib/topp10/types'

const list = (answers: Topp10List['answers']): Topp10List => ({
  id: 'prof', region: 'island', title: 'Próf', question: 'Nefndu?',
  answers, sources: [{ name: 'a', url: 'x' }, { name: 'b', url: 'y' }], verifiedAt: '2026-09-15',
})
const ans = (label: string, accept: string[], extra: Partial<Topp10List['answers'][number]> = {}) =>
  ({ rank: 1, label, detail: '', accept: accept.map(normalise), ...extra })

describe('normalise', () => {
  it('spells Icelandic letters out instead of dropping them', () => {
    expect(normalise('Nökkvi Þeyr Þórisson')).toBe('nokkvi theyr thorisson')
    expect(normalise('Guðmundur')).toBe('gudmundur')
    expect(normalise('Æsir')).toBe('aesir')
  })

  it('ignores case, punctuation and extra spacing', () => {
    expect(normalise('  Víkingur  R. ')).toBe('vikingur r')
    expect(normalise("Nott'm Forest")).toBe('nott m forest')
  })

  it('is stable when applied twice', () => {
    const once = normalise('Real Betis Balompié')
    expect(normalise(once)).toBe(once)
  })
})

describe('matchGuess', () => {
  const clubs = list([
    ans('Paris SG', ['Paris SG', 'Paris Saint-Germain', 'PSG']),
    ans('Paris FC', ['Paris FC']),
  ])

  // the mistake this exists to prevent, seen elsewhere on this site
  it('never matches on part of a name', () => {
    expect(matchGuess(clubs, 'paris')).toEqual([])
    expect(matchGuess(clubs, 'Saint')).toEqual([])
  })

  it('matches any accepted spelling exactly', () => {
    expect(matchGuess(clubs, 'psg')).toEqual([0])
    expect(matchGuess(clubs, 'Paris Saint Germain')).toEqual([0])
    expect(matchGuess(clubs, 'PARIS FC')).toEqual([1])
  })

  it('does not care whether the accents were typed', () => {
    const scorers = list([ans('Nökkvi Þeyr Þórisson', ['Nökkvi Þeyr Þórisson', 'Nökkvi Þórisson'])])
    expect(matchGuess(scorers, 'nokkvi theyr thorisson')).toEqual([0])
    expect(matchGuess(scorers, 'Nökkvi Þórisson')).toEqual([0])
  })

  it('opens every slot a player fills, when a list has a slot per year', () => {
    const years = list([
      ans('Patrick Pedersen', ['Patrick Pedersen'], { slot: '2018' }),
      ans('Emil Atlason', ['Emil Atlason'], { slot: '2023' }),
      ans('Patrick Pedersen', ['Patrick Pedersen'], { slot: '2025' }),
    ])
    expect(matchGuess(years, 'patrick pedersen')).toEqual([0, 2])
  })
})

describe('ambiguousAliases', () => {
  it('flags a spelling that two different answers accept', () => {
    const bad = list([ans('Paris SG', ['Paris']), ans('Paris FC', ['Paris'])])
    expect(ambiguousAliases(bad)).toEqual(['paris'])
  })

  it('allows the same spelling across slots that are the same player', () => {
    const ok = list([
      ans('Patrick Pedersen', ['Patrick Pedersen'], { slot: '2018' }),
      ans('Patrick Pedersen', ['Patrick Pedersen'], { slot: '2025' }),
    ])
    expect(ambiguousAliases(ok)).toEqual([])
  })
})

describe('game', () => {
  const three = list([ans('KR', ['KR']), ans('Valur', ['Valur']), ans('Fram', ['Fram'])])

  it('starts with three lives and nothing open', () => {
    const g = newGame(three)
    expect(g.lives).toBe(LIVES)
    expect(g.found).toEqual([])
    expect(g.status).toBe('playing')
  })

  it('opens a slot on a right answer and costs nothing', () => {
    const r = guess(three, newGame(three), 'valur')
    expect(r.outcome).toBe('correct')
    expect(r.state.found).toEqual([1])
    expect(r.state.lives).toBe(LIVES)
  })

  it('takes a life for a wrong answer, but not twice for the same one', () => {
    const once = guess(three, newGame(three), 'ÍA')
    expect(once.outcome).toBe('wrong')
    expect(once.state.lives).toBe(LIVES - 1)
    const again = guess(three, once.state, 'ia')
    expect(again.outcome).toBe('repeat')
    expect(again.state.lives).toBe(LIVES - 1)
  })

  it('charges nothing for typing a found answer again', () => {
    const a = guess(three, newGame(three), 'KR').state
    const r = guess(three, a, 'kr')
    expect(r.outcome).toBe('repeat')
    expect(r.state).toEqual(a)
  })

  it('is won when every slot is open', () => {
    let s = newGame(three)
    for (const name of ['KR', 'Valur', 'Fram']) s = guess(three, s, name).state
    expect(s.status).toBe('won')
  })

  it('is lost on the third wrong answer, and then accepts nothing', () => {
    let s = newGame(three)
    for (const name of ['ÍA', 'FH', 'KA']) s = guess(three, s, name).state
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
    expect(guess(three, s, 'KR').outcome).toBe('over')
  })

  it('ignores an empty guess', () => {
    expect(guess(three, newGame(three), '   ').outcome).toBe('empty')
  })
})

describe('hint', () => {
  const two = list([ans('KR', ['KR'], { hint: 'Vesturbær' }), ans('Valur', ['Valur'])])

  it('costs a life and marks the answer', () => {
    const s = hint(two, newGame(two), 0)
    expect(s.lives).toBe(LIVES - 1)
    expect(s.hinted).toEqual([0])
    expect(hintFor(two, 0)).toBe('Vesturbær')
  })

  it('falls back to the first letter when no hint was written', () => {
    expect(hintFor(two, 1)).toBe('V…')
  })

  it('is refused on the last life, so it can never end a game', () => {
    let s = newGame(two)
    s = { ...s, lives: 1 }
    expect(hint(two, s, 1)).toEqual(s)
  })

  it('cannot be spent twice on one answer, or on one already found', () => {
    const once = hint(two, newGame(two), 0)
    expect(hint(two, once, 0)).toEqual(once)
    const found = guess(two, newGame(two), 'Valur').state
    expect(hint(two, found, 1)).toEqual(found)
  })
})

describe('dailyList', () => {
  const lists = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]

  it('gives everyone the same list on the same day', () => {
    const d = new Date('2026-09-15T08:00:00Z')
    const later = new Date('2026-09-15T23:59:00Z')
    expect(dailyList(lists, d)).toEqual(dailyList(lists, later))
  })

  it('does not depend on the order the lists arrive in', () => {
    const d = new Date('2026-09-15T12:00:00Z')
    expect(dailyList(lists, d)).toEqual(dailyList([...lists].reverse(), d))
  })

  it('moves to the next list the following day and cycles through all', () => {
    const start = new Date('2026-09-15T12:00:00Z')
    const seen = new Set<string>()
    for (let i = 0; i < 3; i++) {
      seen.add(dailyList(lists, new Date(start.getTime() + i * 86_400_000))!.id)
    }
    expect(seen.size).toBe(3)
  })

  it('rolls over at midnight in Reykjavík', () => {
    expect(dayNumber(new Date('2026-09-15T23:59:59Z')))
      .toBe(dayNumber(new Date('2026-09-15T00:00:00Z')))
    expect(dayNumber(new Date('2026-09-16T00:00:00Z')))
      .toBe(dayNumber(new Date('2026-09-15T00:00:00Z')) + 1)
  })

  it('returns nothing when there are no lists', () => {
    expect(dailyList([], new Date())).toBeNull()
  })
})

describe('shareText', () => {
  it('shows which slots were found and never what was in them', () => {
    const l = list([ans('KR', ['KR']), ans('Valur', ['Valur']), ans('Fram', ['Fram'])])
    let s = newGame(l)
    s = guess(l, s, 'Valur').state
    s = guess(l, s, 'ÍA').state
    const text = shareText(l, s, 'https://islensk-fotbolti.vercel.app/topp10')
    expect(text).toContain('1/3')
    expect(text).toContain('⬛🟩⬛')
    expect(text).not.toMatch(/Valur|KR|Fram/)
  })
})
