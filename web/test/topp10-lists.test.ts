import { describe, it, expect } from 'vitest'
import { readdirSync } from 'fs'
import { join } from 'path'
import { LISTS } from '../src/lib/topp10/lists'
import { normalise } from '../src/lib/topp10/normalise'
import { matchGuess, ambiguousAliases } from '../src/lib/topp10/match'

// Every list here was written by scripts/topp10/build.mts after two sources
// agreed. These checks catch a list edited by hand into something unplayable.
describe('Topp 10 lists', () => {
  it('has lists for every region', () => {
    for (const region of ['island', 'enska', 'evropa']) {
      expect(LISTS.some((l) => l.region === region)).toBe(true)
    }
  })

  it('loads every list file, once', () => {
    const files = readdirSync(join(__dirname, '../src/lib/topp10/lists')).filter((f) => f.endsWith('.json'))
    expect(LISTS.length).toBe(files.length)
    expect(new Set(LISTS.map((l) => l.id)).size).toBe(LISTS.length)
  })

  for (const list of LISTS) {
    describe(list.id, () => {
      it('has at least ten answers, in order', () => {
        expect(list.answers.length).toBeGreaterThanOrEqual(10)
        list.answers.forEach((a, i) => {
          if (i > 0) expect(a.rank).toBeGreaterThanOrEqual(list.answers[i - 1].rank)
        })
      })

      it('comes from two different sources and says when it was checked', () => {
        const pages = new Set(list.sources.map((s) => { const u = new URL(s.url); return u.host + u.pathname + u.search }))
        expect(pages.size).toBeGreaterThanOrEqual(2)
        expect(list.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('opens each answer by its own name, and no spelling opens two', () => {
        expect(ambiguousAliases(list)).toEqual([])
        list.answers.forEach((a, i) => {
          expect(a.accept.length).toBeGreaterThan(0)
          for (const key of a.accept) expect(normalise(key)).toBe(key)
          for (const name of a.label.split(' / ')) expect(matchGuess(list, name)).toContain(i)
        })
      })

      it('uses a plain hyphen, not a dash, in what it shows', () => {
        const shown = [list.title, list.question, list.note ?? '', ...list.sources.map((s) => s.name),
          ...list.answers.flatMap((a) => [a.label, a.detail, a.hint ?? '', a.slot ?? ''])]
        for (const text of shown) expect(text).not.toMatch(/[\u2013\u2014]/)
      })
    })
  }
})
