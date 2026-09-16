import { describe, it, expect } from 'vitest'
import { letters, markGuess, surname, targetWord } from '../src/lib/xi/word'
import { rows, tmLine, wikiLine } from '../src/lib/xi/layout'
import { MAX_TRIES, dailyMatch, giveUp, guessPlayer, guessResult, newState, puzzleNumber, restore, resultPoints, shareText, slot, solvedCount, teamOver, LAUNCH_DAY } from '../src/lib/xi/game'
import { MATCHES } from '../src/lib/xi/matches'
import type { XiMatch } from '../src/lib/xi/types'

describe('word', () => {
  it('takes the name a crowd would use', () => {
    expect(surname('R. Óskarsson')).toBe('Óskarsson')
    expect(surname('Edwin van der Sar')).toBe('van der Sar')
    expect(surname('Kaká')).toBe('Kaká')
    expect(surname('Jonathan Kevin C. Hendrickx')).toBe('Hendrickx')
  })

  it('keeps Icelandic letters for Icelandic teams and drops accents', () => {
    expect(targetWord('R. Óskarsson', true)).toBe('OSKARSSON')
    expect(targetWord('G. Þórðarson', true)).toBe('ÞORÐARSON')
    expect(letters('Böðvarsson', true)).toBe('BÖÐVARSSON')
  })

  it('writes everyone else in plain A to Z', () => {
    expect(targetWord('Kaká', false)).toBe('KAKA')
    expect(targetWord('Edwin van der Sar', false)).toBe('VANDERSAR')
    expect(targetWord("Trent Alexander-Arnold", false)).toBe('ALEXANDERARNOLD')
    expect(letters('Ødegaard', false)).toBe('ODEGAARD')
    expect(letters('Guðmundsson', false)).toBe('GUDMUNDSSON')
  })
})

describe('markGuess', () => {
  it('marks right place, wrong place and absent letters', () => {
    expect(markGuess('KAKA', 'KAKA')).toEqual(['hit', 'hit', 'hit', 'hit'])
    expect(markGuess('AKAK', 'KAKA')).toEqual(['near', 'near', 'near', 'near'])
    expect(markGuess('DIDA', 'KAKA')).toEqual(['miss', 'miss', 'miss', 'hit'])
  })

  it('does not mark a repeated letter more often than the word holds it', () => {
    // one S in NESTA: the first S is near, the second not marked
    expect(markGuess('SSXXX', 'NESTA')).toEqual(['near', 'miss', 'miss', 'miss', 'miss'])
    // a hit takes precedence over an earlier near for the same letter
    expect(markGuess('AABBB', 'XAXXX')).toEqual(['miss', 'hit', 'miss', 'miss', 'miss'])
  })
})

describe('layout', () => {
  it('places Wikipedia positions in lines, left and right', () => {
    expect(wikiLine('GK')).toEqual({ line: 0, lateral: 0 })
    expect(wikiLine('LB')).toEqual({ line: 1, lateral: -1 })
    expect(wikiLine('DM').line).toBe(2)
    expect(wikiLine('RW')).toEqual({ line: 4, lateral: 1 })
    expect(wikiLine('CF').line).toBe(5)
    expect(() => wikiLine('XX')).toThrow()
  })

  it("refines Transfermarkt's lines by the player's position", () => {
    expect(tmLine('Midfielders', 'Defensive Midfield').line).toBe(2)
    expect(tmLine('Midfielders', 'Left Winger')).toEqual({ line: 4, lateral: -1 })
    expect(tmLine('Defenders', 'Right-Back')).toEqual({ line: 1, lateral: 1 })
  })

  it('orders rows from attack to goal, each left to right', () => {
    const r = rows([{ line: 0, x: 0, n: 1 }, { line: 5, x: 1, n: 9 }, { line: 5, x: 0, n: 10 }, { line: 1, x: 0, n: 3 }])
    expect(r.map((row) => row.map((p) => p.n))).toEqual([[10, 9], [3], [1]])
  })
})

const match = MATCHES.find((m) => m.id === 'liverpool-milan-2005')!

describe('game', () => {
  const kaka = match.home.players.find((p) => p.word === 'KAKA')!

  it('opens a player on the right word and records the tries', () => {
    let s = newState()
    s = guessPlayer(match, s, 'home', kaka.number, 'dida').state
    expect(slot(s, 'home', kaka.number)).toEqual({ guesses: ['DIDA'], done: null })
    s = guessPlayer(match, s, 'home', kaka.number, 'Kaká').state
    expect(slot(s, 'home', kaka.number).done).toBe('solved')
    expect(solvedCount(match, s, 'home')).toBe(1)
  })

  it('refuses a guess of the wrong length or one already tried, without spending a try', () => {
    const s = guessPlayer(match, newState(), 'home', kaka.number, 'DIDA').state
    expect(guessPlayer(match, s, 'home', kaka.number, 'KAK').error).toBe('length')
    expect(guessPlayer(match, s, 'home', kaka.number, 'dida').error).toBe('repeat')
  })

  it(`fails a player after ${MAX_TRIES} wrong tries and then accepts nothing`, () => {
    let s = newState()
    for (const w of ['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE', 'FFFF']) s = guessPlayer(match, s, 'home', kaka.number, w).state
    expect(slot(s, 'home', kaka.number).done).toBe('failed')
    expect(guessPlayer(match, s, 'home', kaka.number, 'KAKA').error).toBe('done')
  })

  it('ends a team when every player is done or the player gives up', () => {
    let s = newState()
    expect(teamOver(match, s, 'away')).toBe(false)
    s = giveUp(s, 'away')
    expect(teamOver(match, s, 'away')).toBe(true)
    for (const p of match.home.players) s = guessPlayer(match, s, 'home', p.number, p.word).state
    expect(solvedCount(match, s, 'home')).toBe(11)
    expect(teamOver(match, s, 'home')).toBe(true)
  })

  it('scores the result guess once: 3 exact, 1 right outcome', () => {
    expect(resultPoints({ home: 3, away: 3 }, match.score)).toBe(3)
    expect(resultPoints({ home: 1, away: 1 }, match.score)).toBe(1)
    expect(resultPoints({ home: 2, away: 1 }, match.score)).toBe(0)
    const s = guessResult(newState(), 1, 1)
    expect(guessResult(s, 3, 3)).toEqual(s)
    expect(guessResult(newState(), -1, 2).result).toBeNull()
  })

  it('restores a saved game and rejects one that does not fit', () => {
    const s = guessPlayer(match, newState(), 'home', kaka.number, 'DIDA').state
    expect(restore(JSON.stringify(s), match)).toEqual(s)
    expect(restore(JSON.stringify({ ...s, teams: { home: { 99: { guesses: [], done: null } }, away: {} } }), match)).toBeNull()
    expect(restore(JSON.stringify({ ...s, teams: { home: { [kaka.number]: { guesses: ['DIDA'], done: 'solved' } }, away: {} } }), match)).toBeNull()
    expect(restore('rubbish', match)).toBeNull()
  })

  it('shares squares without names', () => {
    const s = guessPlayer(match, newState(), 'home', kaka.number, 'KAKA').state
    const text = shareText(match, s, 'home', 3, 'https://islensk-fotbolti.vercel.app/byrjunarlid')
    expect(text).toContain('#3')
    expect(text).toContain('1/11')
    expect(text).not.toMatch(/KAKA|Kak/i)
  })

  it('numbers the daily puzzles from launch and gives everyone the same one', () => {
    expect(puzzleNumber(LAUNCH_DAY)).toBe(1)
    expect(dailyMatch(MATCHES, LAUNCH_DAY + 5).id).toBe(dailyMatch([...MATCHES].reverse(), LAUNCH_DAY + 5).id)
  })
})

describe('verified matches', () => {
  it('has matches from Iceland, England and Europe', () => {
    for (const region of ['island', 'enska', 'evropa']) expect(MATCHES.some((m) => m.region === region)).toBe(true)
  })

  for (const m of MATCHES as XiMatch[]) {
    it(`${m.id} is a playable pair of elevens`, () => {
      expect(m.sources.length).toBeGreaterThanOrEqual(2)
      expect(new Set(m.sources.map((s) => new URL(s.url).host)).size).toBe(2)
      for (const side of ['home', 'away'] as const) {
        const t = m[side]
        expect(t.players).toHaveLength(11)
        expect(new Set(t.players.map((p) => p.number)).size).toBe(11)
        expect(t.players.filter((p) => p.line === 0)).toHaveLength(1)
        expect(t.players.filter((p) => p.captain).length).toBeLessThanOrEqual(1)
        expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
        for (const p of t.players) expect(p.word).toMatch(t.icelandic ? /^[A-ZÞÐÆÖ]{2,}$/ : /^[A-Z]{2,}$/)
        const goals = t.players.reduce((n, p) => n + (p.goals ?? 0), 0)
        expect(goals).toBeLessThanOrEqual(m.score[side])
      }
      for (const text of [m.competition, m.stage, m.blurb, m.score.note ?? '', m.layout, ...m.sources.map((s) => s.name)]) {
        expect(text).not.toMatch(/[–—]/)
      }
      // the blurb must not give away anyone in either eleven
      for (const p of [...m.home.players, ...m.away.players]) {
        expect(m.blurb.toUpperCase()).not.toContain(p.word)
      }
    })
  }
})
