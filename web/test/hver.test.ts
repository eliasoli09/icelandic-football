import { describe, expect, it } from 'vitest'
import { HINTS, LAUNCH_DAY, TRIES, dailyPlayer, giveUp, guess, hintValue, hintsOpen, nameIndex, newState, playersAt, restore, shareText, suggest } from '../src/lib/hver/game'
import { cleanName, initials, nameKeys } from '../src/lib/hver/names'
import { NAMES, PLAYERS } from '../src/lib/hver/data'
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
const names = ['Gylfi Þór Sigurðsson', 'Gylfi Einarsson', 'Aron Einar Gunnarsson', 'Eiður Smári Guðjohnsen', 'Birkir Bjarnason', 'Rúnar Kristinsson']
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
  it('spends a guess only on a known, new, wrong name and opens a clue for each', () => {
    let s = newState()
    expect(guess(gylfi, s, 'Gylfi', index).outcome).toBe('unknown')
    expect(guess(gylfi, s, '   ', index).outcome).toBe('empty')
    s = guess(gylfi, s, 'Birkir Bjarnason', index).state
    expect(hintsOpen(s)).toBe(1)
    expect(guess(gylfi, s, 'birkir bjarnason', index)).toMatchObject({ outcome: 'repeat', state: s })
    for (const n of ['Gylfi Einarsson', 'Aron Gunnarsson', 'Eiður Smári Guðjohnsen']) s = guess(gylfi, s, n, index).state
    expect(s.guesses).toEqual(['Birkir Bjarnason', 'Gylfi Einarsson', 'Aron Einar Gunnarsson', 'Eiður Smári Guðjohnsen'])
    expect(hintsOpen(s)).toBe(HINTS.length)
    expect(s.status).toBe('playing')
  })
  it('ends after the last wrong guess, or on giving up, and then shows every clue', () => {
    let lost = newState()
    for (const n of ['Birkir Bjarnason', 'Gylfi Einarsson', 'Aron Einar Gunnarsson', 'Eiður Smári Guðjohnsen', 'Rúnar Kristinsson']) lost = guess(gylfi, lost, n, index).state
    expect(lost.guesses).toHaveLength(TRIES)
    expect(lost.status).toBe('lost')
    expect(guess(gylfi, lost, 'Gylfi Sigurðsson', index).outcome).toBe('over')
    expect(hintsOpen(giveUp(newState()))).toBe(HINTS.length)
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
    expect(text).toBe('Hver er maðurinn? #3 · Létt\n🟥🟩⬛⬛⬛ 2/5\nhttps://x/hver')
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
