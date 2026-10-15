import { describe, it, expect } from 'vitest'
import { ELO_MEAN, currentRatings, type GameAdjuster, eloSpread, movMultiplier, predictGame, runElo, stateFromRows, winProb, type EloParams } from '../src/lib/nfl/elo'
import type { NflGame } from '../src/lib/nfl/types'

const P: EloParams = { K: 20, HFA: 48, R: 1 / 3, BYE: 25 }
const P4: EloParams = { ...P, R: 0.4 }
let n = 0
const g = (season: number, week: number, home: string, hs: number | null, away: string, as: number | null, extra: Partial<NflGame> = {}) =>
  ({
    game_id: `${season}_${String(week).padStart(2, '0')}_${away}_${home}_${n++}`,
    season, week, game_type: 'REG', kickoff: `${season}-09-${String(week).padStart(2, '0')}T17:00:00.000Z`,
    home, away, home_score: hs, away_score: as, neutral: false, ...extra,
  }) as NflGame

describe('líkur og forgjöf', () => {
  it('samhverfar og summast í 1', () => {
    expect(winProb(0)).toBe(0.5)
    expect(winProb(100) + winProb(-100)).toBeCloseTo(1, 12)
    expect(winProb(100)).toBeCloseTo(0.6401, 4)
  })
  it('25 Elo = 1 stig', () => {
    expect(eloSpread(75)).toBe(3)
  })
  it('margfaldarinn minnkar þegar sterkara liðið vinnur stórt', () => {
    expect(movMultiplier(14, 200)).toBeLessThan(movMultiplier(14, -200))
    expect(movMultiplier(0, 0)).toBe(1)
  })
})

describe('runElo', () => {
  it('heimavallarforskot hverfur á hlutlausum velli', () => {
    const home = runElo([g(2020, 1, 'A', 20, 'B', 10)], P)
    const neutral = runElo([g(2020, 1, 'A', 20, 'B', 10, { neutral: true })], P)
    expect(home.records[0].pHome).toBeCloseTo(winProb(48), 12)
    expect(neutral.records[0].pHome).toBe(0.5)
  })
  it('jafntefli færir einkunnir að líkunum: heimaliðið tapar stigum', () => {
    const r = runElo([g(2020, 1, 'A', 17, 'B', 17)], P)
    expect(r.state.ratings.get('A')!).toBeLessThan(ELO_MEAN)
    expect(r.state.ratings.get('B')!).toBeGreaterThan(ELO_MEAN)
  })
  it('summa einkunna helst óbreytt innan tímabils', () => {
    const games = [g(2020, 1, 'A', 30, 'B', 3), g(2020, 2, 'B', 21, 'C', 20), g(2020, 3, 'C', 10, 'A', 13), g(2020, 4, 'A', 7, 'B', 7)]
    const r = runElo(games, P)
    const sum = [...r.state.ratings.values()].reduce((x, y) => x + y, 0)
    expect(sum).toBeCloseTo(3 * ELO_MEAN, 9)
  })
  it('einkunn dregst að meðaltali einu sinni við nýtt tímabil', () => {
    const r1 = runElo([g(2020, 1, 'A', 40, 'B', 0)], P)
    const a2020 = r1.state.ratings.get('A')!
    const r2 = runElo([g(2020, 1, 'A', 40, 'B', 0), g(2021, 1, 'A', null, 'C', null), g(2021, 2, 'C', null, 'A', null)], P)
    const p = predictGame(g(2021, 1, 'A', null, 'C', null), r2.state, P)
    expect(p.eloHome).toBeCloseTo(a2020 * (2 / 3) + ELO_MEAN / 3, 9)
  })
  it('sögulegt heiti fylgir félaginu: OAK og LV eru sama lið', () => {
    const r = runElo([g(2019, 1, 'OAK', 30, 'B', 0), g(2020, 1, 'LV', 30, 'B', 0)], P)
    expect(r.rows.map((x) => x.team)).toEqual(['LV', 'B', 'LV', 'B'])
    expect(r.rows[2].elo_before).not.toBe(ELO_MEAN)
  })
  it('fríbónus aðeins eftir fríviku í deildarkeppni', () => {
    // A plays weeks 1 and 3 (bye in 2); B plays 1, 2, 3
    const games = [g(2020, 1, 'A', 10, 'C', 10), g(2020, 1, 'B', 10, 'D', 10), g(2020, 2, 'B', 10, 'C', 10), g(2020, 3, 'A', 10, 'B', 10)]
    const r = runElo(games, P)
    const last = r.records[r.records.length - 1]
    const before = r.rows.filter((x) => x.game_id === last.game_id)
    const diffNoBye = before[0].elo_before - before[1].elo_before + 48
    expect(last.diff).toBeCloseTo(diffNoBye + 25, 9)
  })
  it('óspilaðir leikir breyta engu en teljast í dagskrá', () => {
    const r = runElo([g(2020, 1, 'A', 10, 'B', 0), g(2020, 2, 'A', null, 'B', null)], P)
    expect(r.records).toHaveLength(1)
  })
})

describe('stateFromRows', () => {
  it('spáir eins og keyrslan sjálf, úr geymdum röðum', () => {
    const games = [g(2020, 1, 'A', 30, 'B', 3), g(2020, 2, 'B', 21, 'C', 20), g(2020, 3, 'C', null, 'A', null), g(2021, 1, 'A', null, 'B', null)]
    const run = runElo(games, P)
    const fromRows = stateFromRows(run.rows, games, P)
    for (const x of [games[2], games[3]]) expect(predictGame(x, fromRows, P)).toEqual(predictGame(x, run.state, P))
  })
  it('geymir líkurnar sem liðið fékk fyrir leik', () => {
    const run = runElo([g(2020, 1, 'A', 30, 'B', 3)], P)
    expect(run.rows[0].p_win + run.rows[1].p_win).toBeCloseTo(1, 12)
    expect(run.rows[0].p_win).toBeCloseTo(winProb(48), 12)
  })
})

describe('currentRatings', () => {
  it('afturhvarf aðeins fyrir lið sem hefur ekki spilað á tímabilinu', () => {
    const run = runElo([g(2020, 1, 'A', 30, 'B', 3), g(2021, 1, 'A', 20, 'C', 10)], P4)
    const r = currentRatings(run.state, 2021)
    expect(r.get('A')).toBe(run.state.ratings.get('A'))
    expect(r.get('B')).toBeCloseTo(run.state.ratings.get('B')! * 0.6 + ELO_MEAN * 0.4, 9)
  })
})

describe('leiðrétting fyrir leikstjórnanda', () => {
  const season = () => [g(2020, 1, 'A', 30, 'B', 3), g(2020, 2, 'B', 21, 'C', 20), g(2020, 3, 'C', 10, 'A', 13), g(2020, 4, 'A', null, 'B', null)]
  const fixed = (home: number, away = 0): GameAdjuster => ({ before: () => ({ home, away }), after: () => {} })
  it('engin leiðrétting gefur sömu raðir og án hennar', () => {
    const games = season()
    expect(runElo(games, P, fixed(0)).rows).toEqual(runElo(games, P).rows)
  })
  it('leiðréttingin fer í líkurnar og heimaliðið tapar minna á tapi sem búist var við', () => {
    const games = [g(2020, 1, 'A', 10, 'B', 20)]
    const plain = runElo(games, P)
    const adj = runElo(games, P, fixed(-100))
    expect(adj.records[0].pHome).toBeCloseTo(winProb(48 - 100), 12)
    expect(adj.records[0].adjHome).toBe(-100)
    const lost = (r: typeof plain) => ELO_MEAN - r.state.ratings.get('A')!
    expect(lost(adj)).toBeGreaterThan(0)
    expect(lost(adj)).toBeLessThan(lost(plain))
  })
  it('after er kallað einu sinni á hvern spilaðan leik, í tímaröð', () => {
    const seen: string[] = []
    const games = season()
    runElo([...games].reverse(), P, { before: () => ({ home: 0, away: 0 }), after: (x) => { seen.push(x.game_id) } })
    expect(seen).toEqual(games.slice(0, 3).map((x) => x.game_id))
  })
  it('predictGame tekur leiðréttinguna með', () => {
    const run = runElo(season(), P)
    const x = season()[3]
    const base = predictGame(x, run.state, P)
    const adj = predictGame(x, run.state, P, { home: -50, away: 25 })
    expect(adj.diff).toBeCloseTo(base.diff - 75, 9)
    expect(adj.spread).toBeCloseTo(base.spread - 3, 9)
  })
})
