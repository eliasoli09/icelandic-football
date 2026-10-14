import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { clinchMarks } from '../src/lib/nfl/clinch'
import { computeStandings } from '../src/lib/nfl/standings'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import { CONFERENCES, DIVISIONS, type NflGame } from '../src/lib/nfl/types'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const games = parseGames(fx('nfl-2025.csv'))
const teams = parseTeams(fx('nfl-teams.csv')).filter((t) => t.franchise === t.abbr)
const reg = games.filter((g) => g.game_type === 'REG')
const madePlayoffs = new Set(games.filter((g) => g.game_type !== 'REG').flatMap((g) => [g.home, g.away]))
const final = computeStandings(reg, teams)
const divWinners = new Set(CONFERENCES.flatMap((c) => DIVISIONS.map((d) => final.divisions[c][d][0].abbr)))
const asOf = (week: number): NflGame[] => reg.map((g) => (g.week > week ? { ...g, home_score: null, away_score: null } : g))

describe('clinchMarks er aldrei rangt (2025, eftir hverja viku 8-18)', () => {
  for (let week = 8; week <= 18; week++) {
    it(`vika ${week}`, () => {
      const marks = clinchMarks(asOf(week), teams)
      for (const [abbr, m] of Object.entries(marks)) {
        if (m === 'division') expect([abbr, divWinners.has(abbr)]).toEqual([abbr, true])
        if (m === 'division' || m === 'playoffs') expect([abbr, madePlayoffs.has(abbr)]).toEqual([abbr, true])
        if (m === 'eliminated') expect([abbr, madePlayoffs.has(abbr)]).toEqual([abbr, false])
      }
    })
  }
  it('í lok tímabils hafa flest lið merki', () => {
    const marks = Object.values(clinchMarks(asOf(18), teams))
    expect(marks.filter((m) => m === 'eliminated').length).toBeGreaterThanOrEqual(15)
    expect(marks.filter((m) => m === 'division').length).toBeGreaterThanOrEqual(6)
  })
  it('engin merki eftir fyrstu viku', () => {
    expect(Object.values(clinchMarks(asOf(1), teams)).every((m) => m === null)).toBe(true)
  })
})
