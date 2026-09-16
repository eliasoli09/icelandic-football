import { describe, it, expect } from 'vitest'
import { normalise } from '../src/lib/topp10/normalise'
import { matchGuess, ambiguousAliases } from '../src/lib/topp10/match'
import { dailyList, dailyOrder, dayNumber } from '../src/lib/topp10/daily'
import type { Topp10List } from '../src/lib/topp10/types'

const list = (answers: Topp10List['answers']): Topp10List => ({
  id: 'prof', region: 'island', level: 'medium', kind: 'club', competition: 'PRÓF', title: 'Próf', question: 'Nefndu?', context: '',
  answers, sources: [{ name: 'a', url: 'x' }, { name: 'b', url: 'y' }], verifiedAt: '2026-09-15',
})
const ans = (id: string, label: string, accept: string[]) => ({ id, label, detail: '', accept: accept.map(normalise) })

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
    ans('psg', 'Paris SG', ['Paris SG', 'Paris Saint-Germain', 'PSG']),
    ans('parisfc', 'Paris FC', ['Paris FC']),
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
    const scorers = list([ans('nokkvi', 'Nökkvi Þeyr Þórisson', ['Nökkvi Þeyr Þórisson', 'Nökkvi Þórisson'])])
    expect(matchGuess(scorers, 'nokkvi theyr thorisson')).toEqual([0])
    expect(matchGuess(scorers, 'Nökkvi Þórisson')).toEqual([0])
  })
})

describe('ambiguousAliases', () => {
  it('flags a spelling that two different answers accept', () => {
    const bad = list([ans('psg', 'Paris SG', ['Paris']), ans('parisfc', 'Paris FC', ['Paris'])])
    expect(ambiguousAliases(bad)).toEqual(['paris'])
  })

  it('allows a spelling repeated within one answer', () => {
    expect(ambiguousAliases(list([ans('kr', 'KR', ['KR', 'kr'])]))).toEqual([])
  })
})

describe('daily question', () => {
  const lists = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]

  it('gives everyone the same question on the same day', () => {
    expect(dailyList(lists, new Date('2026-09-15T08:00:00Z'))).toEqual(dailyList(lists, new Date('2026-09-15T23:59:00Z')))
  })

  it('does not depend on the order the questions arrive in', () => {
    const d = new Date('2026-09-15T12:00:00Z')
    expect(dailyList(lists, d)).toEqual(dailyList([...lists].reverse(), d))
  })

  it('moves on each day and cycles through every question', () => {
    const start = new Date('2026-09-15T12:00:00Z').getTime()
    const seen = new Set<string>()
    for (let i = 0; i < 3; i++) seen.add(dailyList(lists, new Date(start + i * 86_400_000))!.id)
    expect(seen.size).toBe(3)
  })

  it('spreads the regions so the same one rarely comes twice in a row', () => {
    const many = ['island', 'enska', 'evropa'].flatMap((region) =>
      Array.from({ length: 4 }, (_, i) => ({ id: `${region}-${i}`, region })))
    const order = dailyOrder(many)
    expect(order).toHaveLength(12)
    expect(new Set(order.map((l) => l.id)).size).toBe(12)
    order.forEach((l, i) => { if (i > 0) expect(l.region).not.toBe(order[i - 1].region) })
  })

  it('rolls over at midnight in Reykjavík', () => {
    expect(dayNumber(new Date('2026-09-15T23:59:59Z'))).toBe(dayNumber(new Date('2026-09-15T00:00:00Z')))
    expect(dayNumber(new Date('2026-09-16T00:00:00Z'))).toBe(dayNumber(new Date('2026-09-15T00:00:00Z')) + 1)
  })

  it('returns nothing when there are no questions', () => {
    expect(dailyList([], new Date())).toBeNull()
  })
})
