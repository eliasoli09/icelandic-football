import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCsv, parseGames, parseTeams } from '../src/lib/nfl/csv'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')

describe('parseCsv', () => {
  it('les gæsalappir, tóma reiti og CRLF', () => {
    expect(parseCsv('a,b,c\r\n1,"",3\n"x,y","he said ""hi""",\n')).toEqual([
      ['a', 'b', 'c'], ['1', '', '3'], ['x,y', 'he said "hi"', ''],
    ])
  })
})

describe('parseGames á tímabilinu 2025', () => {
  const games = parseGames(fx('nfl-2025.csv'))
  it('öll 285 leikirnir, 272 í deildarkeppni', () => {
    expect(games).toHaveLength(285)
    expect(games.filter((g) => g.game_type === 'REG')).toHaveLength(272)
    expect(new Set(games.flatMap((g) => [g.home, g.away])).size).toBe(32)
  })
  it('allir leikir spilaðir og með UTC-tíma', () => {
    expect(games.every((g) => g.home_score !== null && g.away_score !== null)).toBe(true)
    expect(games.every((g) => g.kickoff.endsWith('Z'))).toBe(true)
  })
  it('úrslitakeppnin er merkt eftir tegund', () => {
    const types = new Set(games.map((g) => g.game_type))
    expect([...types].sort()).toEqual(['CON', 'DIV', 'REG', 'SB', 'WC'])
    expect(games.filter((g) => g.game_type === 'SB')).toHaveLength(1)
  })
  it('byrjunarleikstjórnendur með auðkenni', () => {
    const g = games.find((x) => x.game_id === '2025_01_DAL_PHI')!
    expect(g.away_qb_id).toBe('00-0033077')
    expect(g.home_qb_id).toBe('00-0036389')
    const [head, row] = fx('nfl-2025.csv').split('\n')
    const blank = parseGames(`${head}\n${row.replace('00-0033077', '')}\n`)
    expect(blank[0].away_qb_id).toBeNull()
  })
  it('hafnar skrá ef dálk vantar', () => {
    expect(() => parseGames('game_id,season\n2025_01_A_B,2025\n')).toThrow(/dálk/)
  })
  it('hafnar óþekktri leikjategund', () => {
    const [head, row] = fx('nfl-2025.csv').split('\n')
    const bad = row.replace(',REG,', ',PRE,')
    expect(() => parseGames(`${head}\n${bad}\n`)).toThrow(/PRE/)
  })
})

describe('parseTeams', () => {
  const teams = parseTeams(fx('nfl-teams.csv'))
  it('klýfur riðil og tengir söguleg heiti við félagið', () => {
    const kc = teams.find((t) => t.abbr === 'KC')!
    expect(kc).toMatchObject({ conference: 'AFC', division: 'West', franchise: 'KC', logo: '/nfl/KC.png' })
    expect(teams.find((t) => t.abbr === 'OAK')!.franchise).toBe('LV')
    expect(teams.find((t) => t.abbr === 'OAK')!.logo).toBe('/nfl/LV.png')
  })
  it('hvert núverandi lið er í réttum riðli, fjögur í hverjum', () => {
    const current = teams.filter((t) => t.franchise === t.abbr)
    expect(current).toHaveLength(32)
    for (const conf of ['AFC', 'NFC'])
      for (const div of ['East', 'North', 'South', 'West'])
        expect(current.filter((t) => t.conference === conf && t.division === div)).toHaveLength(4)
  })
})
