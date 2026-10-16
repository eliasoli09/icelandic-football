import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ageOn, draftLabel, leaders, parsePlayerWeeks, parsePlayers, seasonTotals, statGroups } from '../src/lib/nfl/players'
import { parseCsv } from '../src/lib/nfl/csv'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const { weeks, seen } = parsePlayerWeeks(fx('nfl-player-weeks-2025.csv'))
const players = parsePlayers(fx('nfl-players.csv'), seen)

describe('parsePlayerWeeks', () => {
  it('allar raðir, bæði deildarkeppni og úrslitakeppni', () => {
    expect(weeks).toHaveLength(722)
    expect(new Set(weeks.map((w) => w.season_type))).toEqual(new Set(['REG', 'POST']))
    expect(weeks.every((w) => /^\d{4}_\d{2}_[A-Z]+_[A-Z]+$/.test(w.game_id))).toBe(true)
  })
  it('hafnar skrá ef dálk vantar', () => {
    expect(() => parsePlayerWeeks('player_id,season\n00-1,2025\n')).toThrow(/dálk/)
  })
})

describe('samtölur okkar = samtölur nflverse (2025, deildarkeppni)', () => {
  const [head, ...rows] = parseCsv(fx('nfl-player-reg-2025.csv'))
  const col = (r: string[], k: string) => Number(r[head.indexOf(k)] || 0) || 0
  const ours = seasonTotals(weeks.filter((w) => w.season_type === 'REG'))
  const pairs: [string, string][] = [
    ['passing_yards', 'passing_yards'], ['passing_tds', 'passing_tds'], ['interceptions', 'passing_interceptions'],
    ['rushing_yards', 'rushing_yards'], ['receptions', 'receptions'], ['receiving_yards', 'receiving_yards'],
    ['def_sacks', 'def_sacks'], ['def_interceptions', 'def_interceptions'], ['tackles_solo', 'def_tackles_solo'],
  ]
  for (const r of rows.filter((x) => x.length === head.length)) {
    const id = r[head.indexOf('player_id')]
    it(`${r[head.indexOf('player_display_name')]}`, () => {
      const t = ours.get(id)!
      for (const [mine, theirs] of pairs) expect([mine, t[mine as keyof typeof t]]).toEqual([mine, col(r, theirs)])
      expect(t.games).toBe(col(r, 'games'))
    })
  }
})

describe('parsePlayers', () => {
  it('aðeins leikmenn sem komu fyrir, með nýliðaári og vali', () => {
    expect(players).toHaveLength(42)
    const ward = players.find((p) => p.name === 'Cam Ward')!
    expect(ward).toMatchObject({ rookie_season: 2025, draft_round: 1, draft_pick: 1, position: 'QB' })
  })
})

describe('leaders', () => {
  const totals = [...seasonTotals(weeks.filter((w) => w.season_type === 'REG')).values()]
  const byId = new Map(players.map((p) => [p.player_id, p]))
  it('raðað niður, tíu efstu', () => {
    const top = leaders(totals, 'passing_yards', 3)
    expect(top).toHaveLength(3)
    expect(top[0].passing_yards).toBeGreaterThanOrEqual(top[1].passing_yards)
  })
  it('nýliðasía', () => {
    const rookies = leaders(totals, 'passing_yards', 10, (t) => byId.get(t.player_id)?.rookie_season === 2025)
    expect(rookies.every((t) => byId.get(t.player_id)!.rookie_season === 2025)).toBe(true)
    expect(rookies.length).toBeGreaterThan(0)
  })
})

describe('smáföll', () => {
  it('aldur á dagsetningu', () => {
    expect(ageOn('2000-10-15', new Date('2026-10-14'))).toBe(25)
    expect(ageOn('2000-10-14', new Date('2026-10-14'))).toBe(26)
    expect(ageOn(null, new Date())).toBeNull()
  })
  it('valréttur á íslensku', () => {
    expect(draftLabel({ draft_year: 2024, draft_round: 1, draft_pick: 3 })).toBe('1. umferð, 3. val 2024')
    expect(draftLabel({ draft_year: null, draft_round: null, draft_pick: null })).toBe('Ekki valinn')
  })
  it('flokkar eftir stöðu', () => {
    expect(statGroups('QB')).toEqual(['sendingar', 'hlaup'])
    expect(statGroups('WR')).toEqual(['gripir', 'hlaup'])
    expect(statGroups('LB')).toEqual(['vorn'])
  })
})

import { headshotUrl } from '../src/lib/nfl/players'

describe('headshotUrl', () => {
  it('biður um ferning með andliti í tvöfaldri stærð', () => {
    expect(headshotUrl('https://static.www.nfl.com/image/upload/f_auto,q_auto/league/abc', 44))
      .toBe('https://static.www.nfl.com/image/upload/f_auto,q_auto,w_88,h_88,c_fill,g_face/league/abc')
    expect(headshotUrl('https://static.www.nfl.com/image/private/f_auto,q_auto/league/xyz', 26))
      .toBe('https://static.www.nfl.com/image/private/f_auto,q_auto,w_52,h_52,c_fill,g_face/league/xyz')
  })
  it('lætur aðrar slóðir og null í friði', () => {
    expect(headshotUrl('https://a.espncdn.com/x.png', 40)).toBe('https://a.espncdn.com/x.png')
    expect(headshotUrl(null, 40)).toBeNull()
  })
})
