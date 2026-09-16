import { describe, expect, it } from 'vitest'
import { QUESTIONS, QUESTION_BY_ID } from '../src/lib/tenaball/data'
import { hintDetails, requestHint } from '../src/lib/tenaball/hints'
import { newRound, restoreRound, submitAnswer } from '../src/lib/tenaball/game'

const q = QUESTION_BY_ID['enska-lokastada-2023']
const id = q.answers[0].id

describe('progressive Tenaball hints', () => {
  it('reveals three hints in order without spending lives and stops at three', () => {
    let round = newRound(q)
    for (let stage = 1; stage <= 3; stage++) {
      round = requestHint(q, round, id)
      expect(round.hints[id]).toBe(stage)
      expect(round.lives).toBe(newRound(q).lives)
      expect(round.found).toEqual([])
    }
    expect(requestHint(q, round, id)).toBe(round)
  })
  it('tracks answers separately and ignores found, foreign and finished answers', () => {
    const start = requestHint(q, newRound(q), id)
    const second = requestHint(q, start, q.answers[1].id)
    expect(second.hints[id]).toBe(1)
    expect(second.hints[q.answers[1].id]).toBe(1)
    const found = submitAnswer(q, start, q.answers[0].label, '1').state
    expect(requestHint(q, found, id)).toBe(found)
    expect(requestHint(q, start, 'not-an-answer')).toBe(start)
    const lost = { ...start, status: 'lost' as const, lives: 0 }
    expect(requestHint(q, lost, id)).toBe(lost)
  })
  it('persists hints and rejects corrupt hint data', () => {
    const round = requestHint(q, newRound(q), id)
    expect(restoreRound(JSON.stringify(round))).toEqual(round)
    for (const hints of [{ [id]: 4 }, { [id]: -1 }, { [id]: 1.5 }, { bogus: 1 }, [], null]) {
      expect(restoreRound(JSON.stringify({ ...round, hints }))).toBeNull()
    }
  })
  it('has three complete hints for every answer', () => {
    for (const question of QUESTIONS) for (const answer of question.answers) {
      const hints = hintDetails(question, answer)
      expect(hints, `${question.id}/${answer.id}`).toHaveLength(3)
      expect(hints[0].value).toBe(Array.from(answer.label)[0])
      expect(hints[1].label).toBe(question.kind === 'club' ? 'Land' : 'Þjóðerni')
      expect(hints[2].label).toBe(question.kind === 'club' ? 'Borg / bær' : 'Félag á tímabilinu')
      for (const hint of hints) expect(hint.value, `${question.id}/${answer.id}`).toBeTruthy()
    }
  })
  it('uses the question season team, including multi-club seasons', () => {
    const scorers = QUESTION_BY_ID['enska-markahaestir-2025']
    expect(hintDetails(scorers, scorers.answers.find(a => a.id === 'semenyo')!)[2].value)
      .toBe('Bournemouth / Manchester City')
    const old = QUESTION_BY_ID['enska-markahaestir-2020']
    expect(hintDetails(old, old.answers.find(a => a.id === 'kane')!)[2].value).toBe('Tottenham Hotspur')
  })
})
