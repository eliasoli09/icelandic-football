import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import { runElo, NFL_ELO } from '../src/lib/nfl/elo'
import { seasonForecasts } from '../src/lib/nfl/forecast'
import { previewFacts, recapFacts, reportFacts, type GameStatLine } from '../src/lib/nfl/articles/facts'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const all = parseGames(fx('nfl-2025.csv'))
const teams = parseTeams(fx('nfl-teams.csv'))
// as of before week 5: weeks 5 on unplayed
const open = all.map((g) => (g.game_type !== 'REG' || g.week >= 5 ? { ...g, home_score: null, away_score: null } : g))

function input(games: typeof all) {
  const run = runElo(games, NFL_ELO)
  return { games, teams, elo: run.rows, forecasts: seasonForecasts(games, run.rows, run.state), sim: { PHI: { p_playoffs: 0.8123, p_div: 0.5 } } }
}

const line = (name: string, team: string, x: Partial<GameStatLine>): GameStatLine => ({
  name, team, passing_yards: 0, passing_tds: 0, interceptions: 0, completions: 0, attempts: 0, rushing_yards: 0, rushing_tds: 0, carries: 0,
  receptions: 0, receiving_yards: 0, receiving_tds: 0, def_sacks: 0, def_interceptions: 0, tackles_solo: 0, tackle_assists: 0, forced_fumbles: 0, ...x,
})

describe('previewFacts', () => {
  const f = previewFacts(input(open), 2025, 5)
  it('allir leikir umferðarinnar með líkum sem summast í 100', () => {
    expect(f.umferd).toBe('Vika 5')
    expect(f.leikir.length).toBe(open.filter((g) => g.week === 5 && g.game_type === 'REG').length)
    for (const g of f.leikir) expect(g.likur_heimalids_pct! + g.likur_utilids_pct!).toBe(100)
  })
  it('met fyrir umferðina og íslenskur tími', () => {
    const g = f.leikir.find((x) => x.lid.heima === 'BAL')!
    expect(g.met.BAL).toMatch(/^\d+-\d+/)
    expect(g.hvenaer).toMatch(/kl\. \d\d:\d\d$/)
  })
})

describe('reportFacts', () => {
  const lines = [
    line('Jalen Hurts', 'PHI', { completions: 19, attempts: 23, passing_yards: 152, passing_tds: 0, carries: 7, rushing_yards: 62, rushing_tds: 2 }),
    line('Dak Prescott', 'DAL', { completions: 23, attempts: 34, passing_yards: 188, passing_tds: 0 }),
    line('Jalen Carter', 'PHI', { def_sacks: 0.5, tackles_solo: 3 }),
  ]
  const f = reportFacts(input(all), '2025_01_DAL_PHI', lines)
  it('úrslit, sigurvegari og líkurnar fyrir leik', () => {
    expect(f.urslit).toBe('DAL 20 - 24 PHI')
    expect(f.sigurvegari).toBe('Philadelphia Eagles')
    expect(f.likur_sem_likanid_gaf_sigurvegaranum_pct).toBeGreaterThan(0)
    expect(f.heima.met_eftir_leik).toBe('1-0')
    expect(f.heima.likur_urslitakeppni_pct).toBe(81)
  })
  it('lykilmenn eftir liðum, með íslenskri kommu', () => {
    expect(f.heima.lykilmenn.sendandi).toBe('Jalen Hurts: 19/23, 152 jardar, 0 snertimörk, 0 hleranir')
    expect(f.heima.lykilmenn.varnarmadur).toContain('0,5 fellur')
    expect(f.uti.lykilmenn.sendandi).toContain('Dak Prescott')
    expect(f.uti.lykilmenn.hlaupari).toBeUndefined()
  })
  it('engir leikmenn ef tölfræðin er ekki komin', () => {
    expect(reportFacts(input(all), '2025_01_DAL_PHI', []).athugasemd).toMatch(/enga leikmenn/)
  })
  it('neitar óspiluðum leik', () => {
    expect(() => reportFacts(input(open), open.find((g) => g.week === 6)!.game_id, [])).toThrow(/ekki spilaður/)
  })
})

describe('recapFacts', () => {
  const f = recapFacts(input(all), 2025, 1)
  it('öll úrslit umferðar, átta riðlar, óvænt undir 40%', () => {
    expect(f.urslit.length).toBe(all.filter((g) => g.week === 1).length)
    expect(f.efst_i_ridlum).toHaveLength(8)
    expect(f.ovaentustu_urslitin.every((r) => r.likur_sigurvegara_pct! < 40)).toBe(true)
    expect(f.mest_haekkun_elo[0].breyting.startsWith('+')).toBe(true)
  })
})
