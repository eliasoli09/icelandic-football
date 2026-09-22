import { describe, expect, it } from 'vitest'
import { QUESTIONS, QUESTION_BY_ID } from '../src/lib/tenaball/data'
import { dailyQuestion, questionsAt } from '../src/lib/tenaball/game'
import { namePool, suggest } from '../src/lib/tenaball/suggest'
import hverNames from '../src/lib/hver/names.json'

describe('the names Tenaball offers while you type', () => {
  it('gathers one pool for each kind, so the list says nothing about this question', () => {
    const players = namePool(QUESTIONS, 'player', hverNames)
    const clubs = namePool(QUESTIONS, 'club', hverNames)
    expect(new Set(players).size).toBe(players.length)
    expect(players).toContain('Gylfi Sigurðsson')
    expect(clubs).toContain('Liverpool')
    // a name is in the pool because some question uses it, not because this one does
    const caps = QUESTION_BY_ID['island-landsleikir']
    const inCaps = new Set(caps.answers.map((a) => a.label))
    expect(players.filter((n) => !inCaps.has(n)).length).toBeGreaterThan(500)
    // the wider list reaches the question's own answers too
    expect(players).toContain('Birkir Már Sævarsson')
    expect(players.some((n) => clubs.includes(n))).toBe(false)
  })

  it('waits for two letters and then matches the start of any word', () => {
    const pool = namePool(QUESTIONS, 'player', hverNames)
    expect(suggest(pool, 'G')).toEqual([])
    expect(suggest(pool, '   ')).toEqual([])
    const gy = suggest(pool, 'gy')
    expect(gy).toContain('Gylfi Sigurðsson')
    expect(gy.length).toBeLessThanOrEqual(8)
    // a surname alone finds him, and the first name narrows it
    expect(suggest(pool, 'sigurdsson')).toContain('Gylfi Sigurðsson')
    // the other game spells him Gylfi Þór Sigurðsson: he is offered once
    expect(suggest(pool, 'gylfi sig')).toEqual(['Gylfi Sigurðsson'])
    // whoever starts with the letters comes before whoever merely contains them
    const b = suggest(namePool(QUESTIONS, 'club', hverNames), 'liver')
    expect(b[0]).toBe('Liverpool')
  })

  it('offers nothing for letters no name has', () => {
    expect(suggest(namePool(QUESTIONS, 'player', hverNames), 'xyz')).toEqual([])
  })
})

describe('the daily question moves about', () => {
  it('does not ask about the same competition two days running', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const order = questionsAt(level)
      let repeats = 0
      order.forEach((q, i) => { if (i > 0 && q.competition === order[i - 1].competition) repeats++ })
      // nine easy questions, five of them English: one meeting is unavoidable
      expect(repeats, level).toBeLessThanOrEqual(level === 'easy' ? 1 : 0)
    }
  })

  it('leaves the day it was re-spread on with the question it had', () => {
    // people were in the middle of these when the order changed
    expect(dailyQuestion(20718, 'easy').id).toBe('enska-lid-2026')
    expect(dailyQuestion(20718, 'medium').id).toBe('enska-markahaestir-2023')
    expect(dailyQuestion(20718, 'hard').id).toBe('italia-lokastada-2022')
  })

  it('walks through every question before repeating one', () => {
    const order = questionsAt('hard')
    const seen = new Set<string>()
    for (let day = 20718; day < 20718 + order.length; day++) seen.add(dailyQuestion(day, 'hard').id)
    expect(seen.size).toBe(order.length)
    expect(dailyQuestion(20718 + order.length, 'hard').id).toBe(dailyQuestion(20718, 'hard').id)
  })
})
