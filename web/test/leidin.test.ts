import { describe, expect, it } from 'vitest'
import { dayNumber } from '../src/lib/topp10/daily'
import {
  LAUNCH_DAY, QUESTIONS, QUESTION_BY_ID, ROUND, answer, dailyRoad, distance, judge, newRun, openQuestion,
  restore, shareText, showcase, suggest, timeout, total,
} from '../src/lib/leidin/game'
import { PERFECT, STADIUMS, nextStadium, reached, roadX, stadiumX } from '../src/lib/leidin/road'
import { TIERS } from '../src/lib/leidin/types'

const q = (id: string) => QUESTION_BY_ID[id]
const points = (id: string, guess: string) => judge(q(id), guess)?.points ?? 0

describe('Leiðin: the question bank', () => {
  it('has every kind of question, and every question has an obvious answer and room for a rare one', () => {
    const slots = new Set(QUESTIONS.map((x) => x.slot))
    expect([...slots].sort()).toEqual(['ar', 'felog', 'landslid', 'lidid', 'markaskorarar', 'serstakt', 'utlond'])
    for (const x of QUESTIONS) {
      expect(x.answers.length, x.id).toBeGreaterThanOrEqual(3)
      expect(x.answers.some((a) => a.points === 10), x.id).toBe(true)
      expect(x.answers.every((a) => TIERS.includes(a.points)), x.id).toBe(true)
      expect(x.sources.length, x.id).toBeGreaterThan(0)
    }
  })
  it('never lets one spelling open two answers', () => {
    for (const x of QUESTIONS) {
      const seen = new Map<string, string>()
      for (const a of x.answers) for (const k of a.accept) {
        expect(seen.get(k) ?? a.id, `${x.id}: "${k}"`).toBe(a.id)
        seen.set(k, a.id)
      }
    }
  })
  it('writes "-" and never "—" in anything shown', () => {
    for (const x of QUESTIONS) {
      for (const text of [x.prompt, x.context, x.rarity, ...x.answers.flatMap((a) => [a.label, a.detail])]) {
        expect(text, x.id).not.toContain('—')
      }
    }
  })
  it('makes the most decorated club the obvious answer and the rarest champions worth most', () => {
    expect(points('meistarar', 'KR')).toBe(10)
    expect(points('meistarar', 'Stjarnan')).toBe(100)
    expect(points('meistarar', 'KA')).toBe(100)
    expect(points('meistarar', 'Fylkir')).toBe(0)
  })
  it('knows the 2025 scorers, goal for goal with Wikipedia at the top', () => {
    const top = q('markaskorarar-2025').answers.find((a) => a.label === 'Patrick Pedersen')!
    expect(top.detail).toMatch(/^18 mörk/)
    expect(top.points).toBe(10)
    // the goal KSÍ's timeline missed, read off fotbolti.net's report
    expect(judge(q('lid-afturelding-2025'), 'Aron Jóhannsson')).not.toBeNull()
  })
  it('scores the most recent title as the obvious year and the oldest as rare', () => {
    expect(points('ar-fh', '2016')).toBe(10)
    expect(points('ar-fh', '2004')).toBe(100)
    expect(points('ar-fh', '2007')).toBe(0)
  })
})

describe('Leiðin: judging a guess', () => {
  it('takes accents, case, spacing and the usual short forms', () => {
    expect(judge(q('meistarar'), '  vikingur  ')?.id).toBe('vikingur')
    expect(judge(q('meistarar'), 'Skaginn')?.id).toBe('ia')
    expect(judge(q('em2016-hopur'), 'Gylfi Sigurdsson')?.label).toBe('Gylfi Þór Sigurðsson')
    expect(judge(q('em2016-hopur'), 'Hannes Thor Halldorsson')?.label).toBe('Hannes Þór Halldórsson')
    expect(judge(q('em2016-hopur'), 'eidur smari')?.label).toBe('Eiður Smári Guðjohnsen')
  })
  it('forgives one slip in a name, but never in a year', () => {
    expect(judge(q('em2016-hopur'), 'Kolbeinn Sigthorson')?.label).toBe('Kolbeinn Sigþórsson')
    expect(judge(q('meistarar'), 'Breidablk')?.id).toBe('breidablik')
    expect(judge(q('ar-fh'), '2017')).toBeNull()
  })
  it('does not turn a patronymic alone into a player', () => {
    expect(judge(q('em2016-hopur'), 'Sigurðsson')).toBeNull()
    expect(judge(q('em2016-hopur'), 'Bjarnason')).toBeNull()
  })
  it('the distance counts a swapped pair as one slip', () => {
    expect(distance('vikingur', 'vikinugr')).toBe(1)
    expect(distance('kr', 'kr')).toBe(0)
    expect(distance('fram', 'fh')).toBe(3)
  })
  it('suggests from a wide pool once two letters are typed', () => {
    expect(suggest('player', 'g')).toEqual([])
    expect(suggest('player', 'gylf').some((n) => n.startsWith('Gylfi'))).toBe(true)
    expect(suggest('year', '20')).toEqual([])
    expect(suggest('club', 'vik').length).toBeGreaterThan(1)
  })
})

describe('Leiðin: the daily road', () => {
  it('starts on 6 October 2026', () => {
    expect(dayNumber(new Date('2026-10-06T12:00:00Z'))).toBe(LAUNCH_DAY)
  })
  it('gives seven different questions of seven kinds-or-so, the same for everyone', () => {
    for (let d = LAUNCH_DAY; d < LAUNCH_DAY + 60; d++) {
      const road = dailyRoad(d)
      expect(road).toHaveLength(ROUND)
      expect(new Set(road.map((x) => x.id)).size).toBe(ROUND)
      expect(dailyRoad(d).map((x) => x.id)).toEqual(road.map((x) => x.id))
      expect(road.filter((x) => x.slot === 'utlond').length).toBeLessThanOrEqual(1)
    }
  })
  it('never asks the same question two days running', () => {
    for (let d = LAUNCH_DAY; d < LAUNCH_DAY + 60; d++) {
      const today = new Set(dailyRoad(d).map((x) => x.id))
      expect(dailyRoad(d + 1).filter((x) => today.has(x.id))).toEqual([])
    }
  })
})

describe('Leiðin: a run', () => {
  const day = LAUNCH_DAY
  const road = dailyRoad(day)
  it('adds up the points of right answers only', () => {
    let run = newRun(day)
    const best = road[0].answers[road[0].answers.length - 1]
    run = answer(run, road[0], best.label).run
    run = answer(run, road[1], 'xyzzy ekki til').run
    run = timeout(run, road[2]).run
    expect(run.picks.map((p) => p.outcome)).toEqual(['right', 'wrong', 'timeout'])
    expect(total(run)).toBe(best.points)
  })
  it('counts a question left open on reload as run out, so a reload is no second look', () => {
    let run = answer(newRun(day), road[0], road[0].answers[0].label).run
    run = openQuestion(run)
    const back = restore(JSON.stringify(run), day)!
    expect(back.picks).toHaveLength(2)
    expect(back.picks[1].outcome).toBe('timeout')
    expect(back.open).toBeNull()
  })
  it('refuses a save from another day or with forged points', () => {
    const run = answer(newRun(day), road[0], road[0].answers[0].label).run
    expect(restore(JSON.stringify(run), day + 1)).toBeNull()
    const forged = { ...run, picks: [{ ...run.picks[0], points: 100 }] }
    if (run.picks[0].points !== 100) expect(restore(JSON.stringify(forged), day)).toBeNull()
    expect(restore('{nonsense', day)).toBeNull()
  })
  it('shares points and the ground reached, never an answer', () => {
    let run = newRun(day)
    for (const x of road) run = answer(run, x, x.answers[0].label).run
    const text = shareText(run, 'https://x.is/leidin')
    expect(text).toContain('#1')
    for (const x of road) expect(text).not.toContain(x.answers[0].label)
  })
  it('shows an obvious and a rare answer besides the one given', () => {
    const s = showcase(q('meistarar'), 'kr')
    expect(s.common).toBeNull()
    expect(s.rare?.points).toBe(100)
    expect(showcase(q('meistarar'), null).common?.id).toBe('kr')
  })
})

describe('Leiðin: the road', () => {
  it('runs from the school pitch to Laugardalsvöllur at 600', () => {
    expect(STADIUMS[0].id).toBe('battavollur')
    expect(STADIUMS.at(-1)!.id).toBe('laugardalur')
    expect(reached(0).stadium.id).toBe('battavollur')
    expect(reached(599).stadium.id).toBe('kaplakriki')
    expect(reached(600).stadium.id).toBe('laugardalur')
    expect(nextStadium(600)).toBeNull()
  })
  it('puts each ground at its own score and moves forward with every point', () => {
    STADIUMS.forEach((s, i) => expect(roadX(s.at)).toBe(stadiumX(i)))
    for (let p = 1; p <= PERFECT; p++) expect(roadX(p)).toBeGreaterThan(roadX(p - 1))
  })
})
