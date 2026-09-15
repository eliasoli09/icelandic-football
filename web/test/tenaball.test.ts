import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../src/lib/tenaball/data'
import { newRound, submitAnswer, restoreRound, nextQuestion, type Round } from '../src/lib/tenaball/game'
const q = QUESTIONS[0]
const play = (s: Round, value: string, id: string) => submitAnswer(q, s, value, id)

describe('Tenaball', () => {
  it('starts with three lives and accepts aliases, accents and whitespace', () => {
    const s = newRound(q)
    expect(s.lives).toBe(3)
    const a = play(s, '  MAN   UNITED ', '1')
    expect(a.feedback.kind).toBe('correct')
    expect(a.state.found).toEqual(['manchester-united'])
    expect(play(a.state, 'Manchester United', '2').feedback.kind).toBe('duplicate')
    expect(play(a.state, 'Manchester United', '2').state.lives).toBe(3)
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
      expect(play(s, name, name).state.lives).toBe(2)
    }
  })
  it('loses on the third wrong answer and blocks further answers', () => {
    let s = newRound(q)
    for (let i = 0; i < 3; i++) s = play(s, 'Arsenal', String(i)).state
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
    expect(play(s, 'Real Madrid', '4').state).toEqual(s)
  })
  it('wins with any ten distinct valid answers in entry order', () => {
    let s = newRound(q)
    for (const id of q.clubIds.slice(-10)) s = play(s, id.replaceAll('-', ' '), id).state
    expect(s.found).toEqual(q.clubIds.slice(-10))
    expect(s.status).toBe('won')
    expect(play(s, 'Real Madrid', 'extra').state).toEqual(s)
  })
  it('deduplicates a submission token including incorrect answers', () => {
    const first = play(newRound(q), 'Arsenal', 'same')
    expect(play(first.state, 'Arsenal', 'same').state).toEqual(first.state)
    expect(play(first.state, 'Arsenal', 'new').state.lives).toBe(1)
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
    for (let i = 0; i < 3; i++) lost = play(lost, 'Arsenal', String(i)).state
    expect(restoreRound(JSON.stringify(lost))).toEqual(lost)
  })
  it('moves to a genuinely different question and resets the round', () => {
    const next = nextQuestion(q.id)
    expect(next.id).not.toBe(q.id)
    expect(newRound(next)).toMatchObject({ found: [], lives: 3, status: 'playing', questionId: next.id })
    expect(nextQuestion(QUESTIONS.at(-1)!.id).id).toBe(q.id)
  })
})

it('persists a win without storing any visual celebration state', () => {
  let s = newRound(q)
  for (const id of q.clubIds.slice(-10)) s = play(s, id.replaceAll('-', ' '), id).state
  expect(restoreRound(JSON.stringify(s))).toEqual(s)
  expect(s.status).toBe('won')
  expect(s).not.toHaveProperty('celebrate')
})

it('enforces different eligibility sets for each question', () => {
  expect(submitAnswer(QUESTIONS[1], newRound(QUESTIONS[1]), 'Celtic', '1').feedback.kind).toBe('incorrect')
  expect(submitAnswer(QUESTIONS[2], newRound(QUESTIONS[2]), 'Chelsea', '1').feedback.kind).toBe('incorrect')
  expect(submitAnswer(QUESTIONS[2], newRound(QUESTIONS[2]), 'Porto', '1').feedback.kind).toBe('correct')
  for (const question of QUESTIONS) {
    expect(new Set(question.clubIds).size).toBe(question.clubIds.length)
    expect(question.clubIds.length).toBeGreaterThanOrEqual(10)
  }
})
