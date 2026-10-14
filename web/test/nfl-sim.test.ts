import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pairUp, seasonFormat, simulateSeason } from '../src/lib/nfl/sim'
import { clinchMarks } from '../src/lib/nfl/clinch'
import { runElo, NFL_ELO } from '../src/lib/nfl/elo'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import type { NflGame } from '../src/lib/nfl/types'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const season = parseGames(fx('nfl-2025.csv'))
const teams = parseTeams(fx('nfl-teams.csv')).filter((t) => t.franchise === t.abbr)
// as of a week: later regular-season games and the whole postseason not yet played
const asOf = (week: number): NflGame[] =>
  season.map((g) => (g.game_type !== 'REG' || g.week > week ? { ...g, home_score: null, away_score: null } : g))

describe('snið og pörun', () => {
  it('7 lið og eitt frí frá 2020, 6 og tvö áður', () => {
    expect(seasonFormat(2020)).toEqual({ seeds: 7, byes: 1 })
    expect(seasonFormat(2019)).toEqual({ seeds: 6, byes: 2 })
  })
  it('besta gegn versta', () => {
    expect(pairUp([2, 3, 4, 5, 6, 7])).toEqual([[2, 7], [3, 6], [4, 5]])
    expect(pairUp([1, 2, 4, 6])).toEqual([[1, 6], [2, 4]])
  })
})

describe('simulateSeason á 2025 eftir viku 14', () => {
  const games = asOf(14)
  const state = runElo(games, NFL_ELO).state
  const t0 = Date.now()
  const sim = simulateSeason(games, teams, state, { sims: 2000, hot: true, seed: 7 })
  const ms = Date.now() - t0
  const rows = Object.values(sim)

  it('líkurnar ganga upp', () => {
    expect(rows.reduce((t, x) => t + x.p_title, 0)).toBeCloseTo(1, 9)
    expect(rows.reduce((t, x) => t + x.p_sb, 0)).toBeCloseTo(2, 9)
    expect(rows.reduce((t, x) => t + x.p_playoffs, 0)).toBeCloseTo(14, 9)
    expect(rows.reduce((t, x) => t + x.p_div, 0)).toBeCloseTo(8, 9)
    for (const x of rows) expect(x.p_seed.reduce((t, v) => t + v, 0)).toBeCloseTo(x.p_playoffs, 9)
  })
  it('sannað merki og hermun eru sammála', () => {
    const marks = clinchMarks(games, teams)
    for (const [abbr, m] of Object.entries(marks)) {
      if (m === 'eliminated') expect([abbr, sim[abbr].p_playoffs]).toEqual([abbr, 0])
      if (m === 'playoffs' || m === 'division') expect([abbr, sim[abbr].p_playoffs]).toEqual([abbr, 1])
    }
  })
  it('sama fræ gefur sömu niðurstöðu', () => {
    const again = simulateSeason(games, teams, state, { sims: 200, hot: true, seed: 3 })
    const twice = simulateSeason(games, teams, state, { sims: 200, hot: true, seed: 3 })
    expect(again).toEqual(twice)
  })
  it(`hraði: 2000 hermanir (${ms} ms)`, () => {
    expect(ms).toBeLessThan(20_000)
  })
})

describe('spilaðir leikir eru virtir', () => {
  it('heilt 2025 gefur SEA titilinn með vissu', () => {
    const state = runElo(season, NFL_ELO).state
    const sim = simulateSeason(season, teams, state, { sims: 50, hot: true })
    expect(sim.SEA.p_title).toBe(1)
    expect(sim.NE.p_sb).toBe(1)
  })
})
