import { describe, expect, it } from 'vitest'
import { BANDS, FORMATIONS, ROUNDS, draftDone, drawOpponents, eligible, expectedGoals, newDraft, nextSide, offer, openSlots, outcome, pick, playMatch, rng, shareText, teamRating, type MatchResult } from '../src/lib/bikar/game'
import { SIDES, europeLine, honoursLine } from '../src/lib/bikar/data'
import type { CupPlayer, CupSide, Line } from '../src/lib/bikar/types'

const player = (id: number, line: Line, rating = 80): CupPlayer => ({ id, name: `Leikmaður ${id}`, line, position: line, rating, starts: 18, goals: line === 'FWD' ? 10 : 1 })
const side = (id: string, rank: number, players: CupPlayer[], strength = 80): CupSide => ({
  id, club: id, label: id, year: 2000, rank, score: 0, champion: true, position: 1, cupDouble: false,
  record: { w: 16, d: 1, l: 1, gf: 50, ga: 12, games: 18, points: 49 }, basis: '', europe: { tiesWon: 0, mainPhase: false, knockout: false },
  europeTies: [], strength, players,
})
const squad = (base: number) => [player(base, 'GK'), ...[1, 2, 3, 4, 5].map((i) => player(base + i, 'DEF')), ...[6, 7, 8, 9, 10].map((i) => player(base + i, 'MID')), ...[11, 12, 13].map((i) => player(base + i, 'FWD'))]

describe('the draft', () => {
  it('fills exactly the lines of the formation and never the same player twice', () => {
    const a = side('a', 1, squad(100)), b = side('b', 2, [player(100, 'GK'), ...squad(200)])
    let d = newDraft('4-3-3')
    for (const p of a.players) d = pick(d, a, p)
    expect(openSlots(d)).toEqual({ GK: 0, DEF: 0, MID: 0, FWD: 0 })
    expect(draftDone(d)).toBe(true)
    expect(d.picks).toHaveLength(11)
    // the same KSÍ player from another season cannot come in, and a full line offers nobody
    expect(eligible(d, b)).toEqual([])
    const e = pick(newDraft('4-4-2'), a, a.players[0])
    expect(eligible(e, b).map((p) => p.id)).not.toContain(100)
  })
  it('offers a side with someone left to pick, a new one while there are any', () => {
    const r = rng(1)
    const a = side('a', 1, squad(100)), b = side('b', 2, squad(200))
    let d = offer(newDraft('4-3-3'), a)
    expect(nextSide(d, [a, b], r).id).toBe('b')
    d = offer(d, b)
    expect(['a', 'b']).toContain(nextSide(d, [a, b], r).id)
    expect(teamRating(pick(d, a, a.players[0]))).toBe(80)
  })
  it('has formations of eleven', () => {
    for (const f of FORMATIONS) expect(Object.values(f.lines).reduce((x, y) => x + y, 0), f.id).toBe(11)
  })
})

describe('the cup', () => {
  it('meets stronger sides round by round and a top-two side in the final', () => {
    const sides = Array.from({ length: 41 }, (_, i) => side(`s${i + 1}`, i + 1, squad(1000 * (i + 1)), 90 - i / 2))
    const opp = drawOpponents(sides, rng(7))
    expect(opp).toHaveLength(ROUNDS.length)
    opp.forEach((o, i) => { expect(o.rank).toBeGreaterThanOrEqual(BANDS[i][0]); expect(o.rank).toBeLessThanOrEqual(BANDS[i][1]) })
    expect(opp[4].rank).toBeLessThanOrEqual(2)
  })
  it('gives the stronger side more goals, and every cup tie a winner', () => {
    expect(expectedGoals(85, 75)).toBeGreaterThan(expectedGoals(75, 85))
    expect(expectedGoals(80, 80)).toBeCloseTo(1.35)
    const ours = squad(1)
    let wins = 0
    for (let s = 1; s <= 400; s++) {
      const r = playMatch('Úrslitaleikur', ours.slice(0, 11).map((p) => ({ ...p, rating: 90 })), side('x', 1, squad(500), 70), rng(s))
      if (r.penalties) expect(r.penalties[0]).not.toBe(r.penalties[1])
      else expect(r.ours).not.toBe(r.theirs)
      expect(r.goals.filter((g) => g.ours)).toHaveLength(r.ours)
      if (r.won) wins++
    }
    expect(wins / 400).toBeGreaterThan(0.75)
  })
  it('replays the same run from the same seed', () => {
    const run = (seed: number) => playMatch('8-liða úrslit', squad(1).slice(0, 11), side('x', 1, squad(500)), rng(seed))
    expect(run(42)).toEqual(run(42))
  })
  it('says how far a run went and shares it without names', () => {
    const r = (won: boolean, round: string): MatchResult => ({ round, opponent: 'x', ours: won ? 2 : 0, theirs: won ? 0 : 1, extraTime: false, penalties: null, won, goals: [] })
    expect(outcome([r(true, ROUNDS[0]), r(false, ROUNDS[1])])).toBe('Úr leik í 16-liða úrslitum')
    expect(outcome([r(true, ROUNDS[0]), r(true, ROUNDS[1]), r(true, ROUNDS[2]), r(false, ROUNDS[3])])).toBe('Úr leik í undanúrslitum')
    expect(outcome(ROUNDS.map((x) => r(true, x)))).toBe('Bikarmeistari!')
    expect(shareText([r(true, ROUNDS[0]), r(false, ROUNDS[1])], '4-3-3', 82, 'https://x/bikar')).toBe('Reyndu að verða bikarmeistari 🏆\nÚr leik í 16-liða úrslitum\n🟩🟥 · 4-3-3 · styrkur 82\nhttps://x/bikar')
  })
})

describe('the words on a side', () => {
  it('describes titles, record and Europe in Icelandic', () => {
    const s = { ...side('ia', 1, []), label: 'ÍA', cupDouble: true, record: { w: 16, d: 1, l: 1, gf: 62, ga: 16, games: 18, points: 49 } }
    expect(honoursLine(s)).toBe('Íslands- og bikarmeistari · 16 sigrar, 1 jafntefli, 1 tap · 62:16')
    expect(europeLine([{ season: '2023–24', club: 'breidablik', round: 'UEFA Conference League: Group stage', opponent: 'Gent', aggregate: '', through: false }])).toBe('Evrópa: komst í riðlakeppni Sambandsdeildarinnar')
    expect(europeLine([{ season: '2014–15', club: 'stjarnan', round: 'UEFA Europa League: Play-off round', opponent: 'Inter Milan', aggregate: '0–9', through: false }])).toBe('Evrópa: komst í umspil Evrópudeildarinnar')
    expect(europeLine([])).toBeNull()
  })
})

describe('the verified sides', () => {
  it('has enough sides with players for every round and every pick', () => {
    expect(SIDES.length).toBeGreaterThanOrEqual(30)
    SIDES.forEach((s, i) => expect(s.rank, s.id).toBe(i + 1))
    for (const s of SIDES) {
      expect(s.strength, s.id).not.toBeNull()
      for (const p of s.players) {
        expect(p.rating, `${s.id} ${p.name}`).toBeGreaterThanOrEqual(55)
        expect(p.rating, `${s.id} ${p.name}`).toBeLessThanOrEqual(94)
      }
    }
    for (const line of ['GK', 'DEF', 'MID', 'FWD'] as Line[]) expect(SIDES.filter((s) => s.players.some((p) => p.line === line)).length, line).toBeGreaterThan(20)
    for (const [from, to] of BANDS) expect(SIDES.filter((s) => s.rank >= from && s.rank <= to).length).toBeGreaterThan(0)
  })
})
