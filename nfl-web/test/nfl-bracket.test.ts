import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { likelyBracket, probCell, todayBracket } from '../src/lib/nfl/bracket'
import { simulateSeason } from '../src/lib/nfl/sim'
import { computeStandings } from '../src/lib/nfl/standings'
import { runElo, NFL_ELO } from '../src/lib/nfl/elo'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const season = parseGames(fx('nfl-2025.csv'))
const teams = parseTeams(fx('nfl-teams.csv')).filter((t) => t.franchise === t.abbr)
const games = season.map((g) => (g.game_type !== 'REG' || g.week > 12 ? { ...g, home_score: null, away_score: null } : g))
const state = runElo(games, NFL_ELO).state
const sim = simulateSeason(games, teams, state, { sims: 1000, hot: true, seed: 5 })
const standings = computeStandings(games, teams)

describe('todayBracket', () => {
  const b = todayBracket(standings, sim, 2025)
  it('sæti 1-7, frí fyrir sæti 1 og pörunin 2-7, 3-6, 4-5', () => {
    expect(b.AFC.seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(b.AFC.byes.map((s) => s.seed)).toEqual([1])
    expect(b.AFC.wc.map(([a, c]) => [a.seed, c.seed])).toEqual([[2, 7], [3, 6], [4, 5]])
    expect(b.AFC.seeds[0].abbr).toBe(standings.seeds.AFC[0].abbr)
  })
  it('í baráttunni eru næstu lið fyrir utan', () => {
    expect(b.AFC.hunt.map((s) => s.abbr)).toEqual(standings.seeds.AFC.slice(7, 11).map((r) => r.abbr))
  })
})

describe('likelyBracket', () => {
  const b = likelyBracket(sim, teams, state, 2025)
  it('ekkert lið tvisvar og sjö sæti í hvorri deild', () => {
    for (const c of ['AFC', 'NFC'] as const) {
      const abbrs = b[c].seeds.map((s) => s.abbr)
      expect(new Set(abbrs).size).toBe(7)
      for (const s of b[c].seeds) expect(teams.find((t) => t.abbr === s.abbr)!.conference).toBe(c)
    }
  })
  it('líklegasta par lið-sæti er valið fyrst', () => {
    let best = { p: -1, abbr: '', seed: 0 }
    for (const t of teams.filter((x) => x.conference === 'AFC')) sim[t.abbr].p_seed.forEach((p, i) => { if (p > best.p) best = { p, abbr: t.abbr, seed: i + 1 } })
    expect(b.AFC.seeds.find((s) => s.seed === best.seed)!.abbr).toBe(best.abbr)
  })
  it('heil braut alla leið að meistara, og meistarinn er annað liðanna í Super Bowl', () => {
    expect(b.AFC.div).toHaveLength(2)
    expect(b.NFC.con).toBeDefined()
    expect([b.sb![0].abbr, b.sb![1].abbr]).toContain(b.winner!.abbr)
    expect(b.winner!.p).toBe(sim[b.winner!.abbr].p_title)
  })
})

describe('probCell', () => {
  it('lítil og stór gildi, og úr leik', () => {
    expect(probCell(0.004, false)).toBe('<1%')
    expect(probCell(0, true)).toBe('úr leik')
    expect(probCell(0.996, false)).toBe('>99%')
    expect(probCell(1, false)).toBe('100%')
    expect(probCell(0.427, false)).toBe('43%')
  })
})
