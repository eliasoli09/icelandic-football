import { describe, expect, it } from 'vitest'
import { QUESTIONS, QUESTION_BY_ID } from '../src/lib/tenaball/data'
import { dailyQuestion, livesFor, newRound, questionsAt, submitAnswer, restoreRound, nextQuestion, shareText, type Round } from '../src/lib/tenaball/game'
import { LEVELS } from '../src/lib/level'
import { dayNumber } from '../src/lib/topp10/daily'
const q = QUESTION_BY_ID['evropa-meistarar']
const play = (s: Round, value: string, id: string) => submitAnswer(q, s, value, id)
const winning = (question = q) => question.answers.slice(-10)

describe('Tenaball', () => {
  it('starts with the lives of its level and accepts aliases, accents and whitespace', () => {
    const s = newRound(q)
    expect(s.lives).toBe(livesFor(q))
    const a = play(s, '  MAN   UNITED ', '1')
    expect(a.feedback.kind).toBe('correct')
    expect(a.state.found).toEqual(['manutd'])
    expect(play(a.state, 'Manchester United', '2').feedback.kind).toBe('duplicate')
    expect(play(a.state, 'Manchester United', '2').state.lives).toBe(livesFor(q))
    expect(play(s, 'Bayern Munchen', '3').feedback.kind).toBe('correct')
  })
  it('accepts champions beyond the old top ten including Chelsea', () => {
    for (const answer of ['Chelsea', 'Celtic', 'PSV', 'Aston Villa', 'Hamburg', 'Steaua Bucuresti', 'Red Star Belgrade', 'PSG']) {
      expect(play(newRound(q), answer, answer).feedback.kind).toBe('correct')
    }
  })
  it('does not spend a life for empty input or accept ambiguous/fuzzy names', () => {
    const s = newRound(q)
    expect(play(s, '  ', '1').state).toEqual(s)
    for (const name of ['Manchester', 'Real Madridd', 'United']) {
      expect(play(s, name, name).state.lives).toBe(livesFor(q) - 1)
    }
  })
  it('loses on the last wrong answer and blocks further answers', () => {
    let s = newRound(q)
    for (let i = 0; i < livesFor(q); i++) s = play(s, 'Arsenal', String(i)).state
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
    expect(play(s, 'Real Madrid', '4').state).toEqual(s)
  })
  it('wins with any ten distinct valid answers in entry order', () => {
    let s = newRound(q)
    for (const a of winning()) s = play(s, a.label, a.id).state
    expect(s.found).toEqual(winning().map((a) => a.id))
    expect(s.status).toBe('won')
    expect(play(s, 'Real Madrid', 'extra').state).toEqual(s)
  })
  it('deduplicates a submission token including incorrect answers', () => {
    const first = play(newRound(q), 'Arsenal', 'same')
    expect(play(first.state, 'Arsenal', 'same').state).toEqual(first.state)
    expect(play(first.state, 'Arsenal', 'new').state.lives).toBe(livesFor(q) - 2)
  })
  it('restores attempts, found IDs and final states and rejects corrupt saves', () => {
    const s = play(play(newRound(q), 'Chelsea', '1').state, 'Arsenal', '2').state
    expect(restoreRound(JSON.stringify(s))).toEqual(s)
    expect(restoreRound(JSON.stringify({ ...s, lives: 9 }))).toBeNull()
    expect(restoreRound(JSON.stringify({ ...s, status: 'won' }))).toBeNull()
    expect(restoreRound(JSON.stringify({ ...s, found: ['chelsea', 'chelsea'] }))).toBeNull()
    expect(restoreRound(JSON.stringify({ ...s, found: ['arsenal'] }))).toBeNull()
    expect(restoreRound('broken')).toBeNull()
    let lost = newRound(q)
    for (let i = 0; i < livesFor(q); i++) lost = play(lost, 'Arsenal', String(i)).state
    expect(restoreRound(JSON.stringify(lost))).toEqual(lost)
  })
  it('will not restore a round saved for another question than the one expected', () => {
    const s = play(newRound(q), 'Chelsea', '1').state
    expect(restoreRound(JSON.stringify(s), q.id)).toEqual(s)
    expect(restoreRound(JSON.stringify(s), 'island-meistarar')).toBeNull()
  })
  it('moves to a different question at the same level and reaches every one', () => {
    const next = nextQuestion(q.id)
    expect(next.id).not.toBe(q.id)
    expect(next.level).toBe(q.level)
    expect(newRound(next)).toMatchObject({ found: [], lives: livesFor(next), status: 'playing', questionId: next.id })
    const pool = questionsAt(q.level)
    const seen = new Set<string>()
    let id = q.id
    for (let i = 0; i < pool.length; i++) { seen.add(id); id = nextQuestion(id).id }
    expect(seen.size).toBe(pool.length)
    expect(id).toBe(q.id)
  })

  it('gives more lives on easy questions and fewer on hard', () => {
    const at = (level: 'easy' | 'medium' | 'hard') => livesFor(questionsAt(level)[0])
    expect(at('easy')).toBeGreaterThan(at('medium'))
    expect(at('medium')).toBeGreaterThan(at('hard'))
  })
})

describe('daily question', () => {
  for (const { id: level } of LEVELS) {
    it(`is the same all day at ${level} level and changes the next day`, () => {
      const morning = dayNumber(new Date('2026-09-16T00:05:00Z'))
      const night = dayNumber(new Date('2026-09-16T23:55:00Z'))
      expect(dailyQuestion(morning, level).id).toBe(dailyQuestion(night, level).id)
      expect(dailyQuestion(morning, level).level).toBe(level)
      expect(dailyQuestion(morning + 1, level).id).not.toBe(dailyQuestion(morning, level).id)
    })

    it(`has enough ${level} questions for a week without repeats`, () => {
      expect(questionsAt(level).length).toBeGreaterThanOrEqual(7)
    })
  }

  it('free play after the daily question goes to yesterday, not tomorrow', () => {
    const day = dayNumber(new Date('2026-09-16T12:00:00Z'))
    expect(nextQuestion(dailyQuestion(day, 'hard').id).id).toBe(dailyQuestion(day - 1, 'hard').id)
  })
})

it('persists a win without storing any visual celebration state', () => {
  let s = newRound(q)
  for (const a of winning()) s = play(s, a.label, a.id).state
  expect(restoreRound(JSON.stringify(s))).toEqual(s)
  expect(s.status).toBe('won')
  expect(s).not.toHaveProperty('celebrate')
})

it('enforces different eligibility sets for each question', () => {
  const era = QUESTION_BY_ID['evropa-meistaradeildin'], both = QUESTION_BY_ID['evropa-baedi-timabil']
  expect(submitAnswer(era, newRound(era), 'Celtic', '1').feedback.kind).toBe('incorrect')
  expect(submitAnswer(both, newRound(both), 'Chelsea', '1').feedback.kind).toBe('incorrect')
  expect(submitAnswer(both, newRound(both), 'Porto', '1').feedback.kind).toBe('correct')
  for (const question of QUESTIONS) {
    expect(new Set(question.answers.map((a) => a.id)).size).toBe(question.answers.length)
    expect(question.answers.length).toBeGreaterThanOrEqual(10)
  }
})

it('asks for players as well as clubs, by surname too', () => {
  const scorers = QUESTION_BY_ID['enska-markahaestir-2023']
  expect(scorers.kind).toBe('player')
  expect(submitAnswer(scorers, newRound(scorers), 'Haaland', '1').feedback.kind).toBe('correct')
  expect(submitAnswer(scorers, newRound(scorers), 'Erling', '1').feedback.kind).toBe('incorrect')
  const iceland = QUESTION_BY_ID['island-meistarar']
  expect(submitAnswer(iceland, newRound(iceland), 'Vikingur R', '1').feedback.kind).toBe('correct')
})

it('shares how many were found without naming them', () => {
  let s = newRound(q)
  s = play(s, 'Chelsea', '1').state
  const text = shareText(q, s, '16. september', 'https://islensk-fotbolti.vercel.app/topp10')
  expect(text).toContain('1/10 🟩⬛')
  expect(text).not.toMatch(/Chelsea/)
})
