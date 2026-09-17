import { describe, expect, it } from 'vitest'
import { HINTS, LAUNCH_DAY, untilMidnight, clubsShown, hintOpensAfter, dailyPlayer, giveUp, guess, hintValue, hintsOpen, nameIndex, newState, playersAt, restore, shareText, suggest, triesFor } from '../src/lib/hver/game'
import { cleanName, initials, nameKeys } from '../src/lib/hver/names'
import { NAMES, PLAYERS, SCHEDULE } from '../src/lib/hver/data'
import { normalise } from '../src/lib/topp10/normalise'
import { LEVELS } from '../src/lib/level'
import type { WhoPlayer } from '../src/lib/hver/types'

const gylfi: WhoPlayer = {
  id: 'Q59105', level: 'easy', region: 'island', name: 'Gylfi Þór Sigurðsson',
  accept: ['gylfi thor sigurdsson', 'gylfi sigurdsson'],
  career: [{ from: 2008, to: 2010, club: 'Reading', loan: false }, { from: 2010, to: 2012, club: 'TSG Hoffenheim', loan: false }, { from: 2012, to: 2014, club: 'Tottenham Hotspur', loan: false }],
  hints: { position: 'Sóknarsinnaður miðjumaður', born: 1989, national: 'Ísland', initials: 'G. Þ. S.' },
  sources: [], verifiedAt: '2026-09-16',
}
const names = ['Gylfi Þór Sigurðsson', 'Gylfi Einarsson', 'Aron Einar Gunnarsson', 'Eiður Smári Guðjohnsen', 'Birkir Bjarnason', 'Rúnar Kristinsson', 'Hannes Þór Halldórsson', 'Ragnar Sigurðsson']
const index = nameIndex(names, [gylfi])

describe('names', () => {
  it('cleans Wikipedia and Wikidata spellings', () => {
    expect(cleanName('Gary Martin (footballer, born 1990)')).toBe('Gary Martin')
    expect(cleanName('Theódór Elmar "Teddy" Bjarnason')).toBe('Theódór Elmar Bjarnason')
    expect(nameKeys('Gylfi Þór Sigurðsson')).toEqual(['gylfi thor sigurdsson', 'gylfi sigurdsson'])
    expect(initials('Eiður Smári Guðjohnsen')).toBe('E. S. G.')
  })
  it('suggests names by the start of any word, without Icelandic letters', () => {
    expect(suggest(names, 'gyl')).toEqual(['Gylfi Einarsson', 'Gylfi Þór Sigurðsson'])
    expect(suggest(names, 'eidur gud')).toEqual(['Eiður Smári Guðjohnsen'])
    expect(suggest(names, 'einar')).toEqual(['Aron Einar Gunnarsson', 'Gylfi Einarsson'])
    expect(suggest(names, 'g')).toEqual([])
  })
})

describe('guessing', () => {
  it('accepts the full name or first and last name, spelt without Icelandic letters', () => {
    expect(guess(gylfi, newState(), 'Gylfi Sigurdsson', index).outcome).toBe('right')
    const won = guess(gylfi, newState(), 'gylfi þór sigurðsson', index).state
    expect(won).toEqual({ v: 1, guesses: ['Gylfi Þór Sigurðsson'], status: 'won' })
  })
  it('spends a guess only on a known, new, wrong name', () => {
    let s = newState()
    expect(guess(gylfi, s, 'Gylfi', index).outcome).toBe('unknown')
    expect(guess(gylfi, s, '   ', index).outcome).toBe('empty')
    s = guess(gylfi, s, 'Birkir Bjarnason', index).state
    expect(guess(gylfi, s, 'birkir bjarnason', index)).toMatchObject({ outcome: 'repeat', state: s })
    expect(s.guesses).toEqual(['Birkir Bjarnason'])
  })
  it('shows the first club, then one more club per wrong guess, then the clues', () => {
    let s = newState()
    expect([clubsShown(gylfi, s), hintsOpen(gylfi, s)]).toEqual([1, 0])
    const wrong = ['Birkir Bjarnason', 'Gylfi Einarsson', 'Aron Einar Gunnarsson', 'Eiður Smári Guðjohnsen', 'Rúnar Kristinsson', 'Hannes Þór Halldórsson']
    const seen = [] as number[][]
    for (const n of wrong) { s = guess(gylfi, s, n, index).state; seen.push([clubsShown(gylfi, s), hintsOpen(gylfi, s)]) }
    // three clubs, then four clues
    expect(seen).toEqual([[2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]])
    // the labels promise exactly when each clue opens
    HINTS.forEach((_, i) => expect(seen[hintOpensAfter(gylfi, i + 1) - 1][1]).toBe(i + 1))
    expect(s.status).toBe('playing')
    expect(triesFor(gylfi)).toBe(gylfi.career.length + HINTS.length)
  })
  it('ends after the last wrong guess, or on giving up, and then shows everything', () => {
    let lost = newState()
    for (const n of names.filter((x) => x !== gylfi.name)) lost = guess(gylfi, lost, n, index).state
    expect(lost.guesses).toHaveLength(triesFor(gylfi))
    expect(lost.status).toBe('lost')
    expect(guess(gylfi, lost, 'Gylfi Sigurðsson', index).outcome).toBe('over')
    const gaveUp = giveUp(newState())
    expect([clubsShown(gylfi, gaveUp), hintsOpen(gylfi, gaveUp)]).toEqual([3, HINTS.length])
    expect(hintValue({ ...gylfi, hints: { ...gylfi.hints, national: null } }, 'national')).toBe('Enginn A-landsleikur')
  })
  it('restores a saved game only if it is consistent', () => {
    const won = guess(gylfi, newState(), 'Gylfi Sigurðsson', index).state
    expect(restore(JSON.stringify(won), gylfi)).toEqual(won)
    expect(restore(JSON.stringify({ ...won, status: 'playing' }), gylfi)).toBeNull()
    expect(restore(JSON.stringify(giveUp(newState())), gylfi)).toEqual(giveUp(newState()))
    expect(restore('{', gylfi)).toBeNull()
  })
  it('shares squares, never names', () => {
    const s = guess(gylfi, guess(gylfi, newState(), 'Birkir Bjarnason', index).state, 'Gylfi Sigurðsson', index).state
    const text = shareText(gylfi, s, LAUNCH_DAY + 2, 'Létt', 'https://x/hver')
    expect(text).toBe('Hver er maðurinn? #3 · Létt\n🟥🟩 Rétt eftir 2 af 3 félögum\nhttps://x/hver')
    expect(text).not.toContain('Gylfi')
  })
})

describe('the verified players', () => {
  it('has daily players at every level, mostly Icelanders', () => {
    for (const l of LEVELS) expect(playersAt(PLAYERS, l.id).length, l.id).toBeGreaterThan(10)
    expect(PLAYERS.filter((p) => p.region === 'island').length / PLAYERS.length).toBeGreaterThan(0.7)
    const day = LAUNCH_DAY + 40
    expect(dailyPlayer(PLAYERS, day, 'easy')).toBe(dailyPlayer(PLAYERS, day, 'easy'))
  })
  it('gives each player a readable career of three clubs or more and four clues', () => {
    const known = new Set(NAMES)
    for (const p of PLAYERS) {
      expect(new Set(p.career.map((r) => normalise(r.club))).size, p.name).toBeGreaterThanOrEqual(3)
      for (const r of p.career) {
        expect(r.club, p.name).toMatch(/\S/)
        expect(r.to === null || r.to >= r.from, `${p.name} ${r.club}`).toBe(true)
        expect(r.club, p.name).not.toMatch(/[[\]{}|<>]/)
      }
      expect(p.accept, p.name).toContain(normalise(p.name))
      expect(known.has(p.name), p.name).toBe(true)
      expect(p.hints.born, p.name).toBeGreaterThan(1900)
      expect(p.hints.initials, p.name).toBe(initials(p.name))
      expect(p.sources, p.name).toHaveLength(2)
      // a career must not give the name away
      const surname = normalise(p.name).split(' ').pop()!
      for (const r of p.career) expect(normalise(r.club).split(' '), `${p.name} ${r.club}`).not.toContain(surname)
    }
  })
})

describe('the daily schedule', () => {
  it('names an existing player of the right level for every day from launch to a year ahead', () => {
    const today = Math.floor(Date.now() / 86_400_000)
    const ids = new Map(PLAYERS.map((p) => [p.id, p]))
    expect(SCHEDULE.start).toBe(LAUNCH_DAY)
    for (const l of LEVELS) {
      const plan = SCHEDULE.days[l.id]!
      expect(plan.length, l.id).toBeGreaterThan(today - LAUNCH_DAY + 300)
      // days up to tomorrow are frozen and keep their player even if he has since changed level
      plan.forEach((id, i) => {
        expect(ids.has(id), `${l.id} dagur ${i}`).toBe(true)
        if (LAUNCH_DAY + i > today + 1) expect(ids.get(id)?.level, `${l.id} dagur ${i}`).toBe(l.id)
      })
      expect(dailyPlayer(PLAYERS, today, l.id, SCHEDULE).id).toBe(plan[today - LAUNCH_DAY])
    }
  })
  it('uses every player before repeating one', () => {
    for (const l of LEVELS) {
      const count = PLAYERS.filter((p) => p.level === l.id).length
      expect(count, l.id).toBeGreaterThan(20)
      const future = SCHEDULE.days[l.id]!.slice(SCHEDULE.days[l.id]!.length - 300)
      const window = future.slice(0, Math.min(count, future.length))
      expect(new Set(window).size, l.id).toBe(window.length)
    }
  })
  it('counts down to midnight in Iceland', () => {
    expect(untilMidnight(new Date('2026-09-17T23:59:00Z'))).toBe(60_000)
    expect(untilMidnight(new Date('2026-09-18T00:00:00Z'))).toBe(86_400_000)
  })
})

