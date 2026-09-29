import { describe, expect, it } from 'vitest'
import { QUESTIONS, QUESTION_BY_ID } from '../src/lib/tenaball/data'
import { newRound, restoreRound, submitAnswer } from '../src/lib/tenaball/game'

describe('fixed Tenaball answer order', () => {
  it('gives every question exactly ten fixed slots and explains the order', () => {
    for (const q of QUESTIONS) {
      expect(q.answers, q.id).toHaveLength(10)
      expect(q.ordering, q.id).toBeTruthy()
      expect(q.context, q.id).not.toContain('Allir sem voru jafnir í 10. sæti gilda.')
    }
  })
  it('places guesses in their ranking regardless of entry order', () => {
    const q = QUESTION_BY_ID['enska-lokastada-2023']
    let round = newRound(q)
    for (const i of [8, 2, 0]) round = submitAnswer(q, round, q.answers[i].label, String(i)).state
    expect(round.found).toEqual([q.answers[0].id, q.answers[2].id, q.answers[8].id])
    expect(restoreRound(JSON.stringify({ ...round, found: [...round.found].reverse() }))?.found).toEqual(round.found)
  })
  it('keeps official league positions, sorts scorers by goals and ties by name', () => {
    const table = QUESTION_BY_ID['enska-lokastada-2023']
    table.answers.forEach((a, i) => expect(a.detail).toMatch(new RegExp(`^${i + 1}\\. sæti`)))
    const scorers = QUESTION_BY_ID['enska-markahaestir-2021']
    expect(scorers.answers.slice(0, 2).map(a => a.id)).toEqual(['salah', 'son'])
    expect(scorers.answers.map(a => parseInt(a.detail))).toEqual([23, 23, 18, 17, 16, 15, 15, 15, 14, 13])
  })
  it('orders champions by titles and applies the documented alphabetical tie-break', () => {
    const q = QUESTION_BY_ID['evropa-meistarar']
    expect(q.answers.map(a => a.id)).toEqual(['realmadrid', 'milan', 'bayern', 'liverpool', 'barcelona', 'ajax', 'inter', 'manutd', 'benfica', 'chelsea'])
    expect(q.question).toContain('sigursælustu')
  })
  it('explicitly asks for the first ten alphabetically in unranked roster questions', () => {
    const q = QUESTION_BY_ID['enska-lid-2026']
    expect(q.question).toContain('stafrófsröð')
    expect(q.answers.map(a => a.label)).toEqual([...q.answers].sort((a,b) => a.label.localeCompare(b.label, 'is')).map(a => a.label))
  })
})
