import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { qbChange } from '../src/lib/nfl/qb'
import { parseGames } from '../src/lib/nfl/csv'

const games = parseGames(readFileSync(join(__dirname, 'fixtures', 'nfl-2025.csv'), 'utf-8'))
const byId = (id: string) => games.find((g) => g.game_id === id)!

describe('qbChange á raunverulegum skiptum 2025', () => {
  it('Cooper Rush í stað Lamar Jackson (BAL, vika 5)', () => {
    expect(qbChange(byId('2025_05_HOU_BAL'), 'home', games)).toEqual({ qb: 'Cooper Rush', usual: 'Lamar Jackson' })
  })
  it('Jacoby Brissett í stað Kyler Murray (ARI, vika 6, útileikur)', () => {
    expect(qbChange(byId('2025_06_ARI_IND'), 'away', games)).toEqual({ qb: 'Jacoby Brissett', usual: 'Kyler Murray' })
  })
  it('engin merki þegar sá venjulegi byrjar', () => {
    expect(qbChange(byId('2025_05_HOU_BAL'), 'away', games)).toBeNull()
  })
  it('engin merki fyrr en tveir leikir eru að baki', () => {
    const week2 = games.find((g) => g.week === 2 && g.game_type === 'REG')!
    expect(qbChange(week2, 'home', games)).toBeNull()
  })
  it('engin merki ef nafn vantar', () => {
    expect(qbChange({ ...byId('2025_05_HOU_BAL'), home_qb: null }, 'home', games)).toBeNull()
  })
})
