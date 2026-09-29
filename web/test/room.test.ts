import { describe, expect, it } from 'vitest'
import { finishedToday, roomCards, roomSize, type Saved } from '../src/lib/room/today'
import { dailyKey, dailyQuestion } from '../src/lib/tenaball/game'
import { LAUNCH_DAY } from '../src/lib/hver/game'

const nothing: Saved = () => null
const DAY = LAUNCH_DAY + 3

describe('the games room', () => {
  it('names what every game is asking today without giving anything away', () => {
    const cards = roomCards(DAY, nothing)
    expect(cards.map((c) => c.id)).toEqual(['tenaball', 'hver', 'byrjunarlid', 'bikar'])
    for (const card of cards) {
      expect(card.today.length).toBeGreaterThan(3)
      expect(card.href.startsWith('/')).toBe(true)
    }
    // the puzzle's own answers must not appear in the room
    const question = dailyQuestion(DAY, 'medium')
    const room = cards.map((c) => `${c.title} ${c.today} ${c.blurb}`).join(' ').toLowerCase()
    for (const answer of question.answers) expect(room).not.toContain(answer.label.toLowerCase())
  })

  it('starts everyone at the beginning when the browser has saved nothing', () => {
    const cards = roomCards(DAY, nothing)
    expect(cards.filter((c) => c.progress === 'new')).toHaveLength(3)
    expect(cards.find((c) => c.id === 'bikar')!.progress).toBe('none')
    expect(finishedToday(cards)).toBe(0)
    expect(cards.every((c) => c.mine === null)).toBe(true)
  })

  it('reads a finished round back out of the browser', () => {
    const question = dailyQuestion(DAY, 'medium')
    const round = { questionId: question.id, found: question.answers.slice(0, 10).map((a) => a.id), lives: 3, hints: {}, status: 'won', lastSubmission: null }
    const saved: Saved = (key) => (key === dailyKey(DAY, 'medium') ? JSON.stringify(round) : key === 'bikar:best' ? '86' : null)
    const cards = roomCards(DAY, saved)
    const tenaball = cards.find((c) => c.id === 'tenaball')!
    expect(tenaball.progress).toBe('won')
    expect(tenaball.mine).toBe('10 af 10 fundust')
    expect(cards.find((c) => c.id === 'bikar')!.mine).toContain('86')
    expect(finishedToday(cards)).toBe(1)
  })

  it('survives nonsense in the browser', () => {
    const rubbish: Saved = () => '{not json'
    const cards = roomCards(DAY, rubbish)
    expect(cards).toHaveLength(4)
    expect(cards.filter((c) => c.progress === 'new')).toHaveLength(3)
  })

  it('knows how much there is to play', () => {
    const size = roomSize()
    expect(size.tenaball).toBeGreaterThan(50)
    expect(size.hver).toBeGreaterThan(150)
    expect(size.byrjunarlid).toBeGreaterThan(60)
    expect(size.answers).toBeGreaterThan(500)
  })
})
