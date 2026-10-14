/**
 * NFL Elo against the market.
 *  1. Parameters chosen on 2002-2014, tested on 2015-2025 against Vegas.
 *  2. Policy test: is tuning on the latest ten seasons better than on old ones?
 *     Both tuned before 2020 and scored on the same 2020-2025 games.
 *  3. Production parameters: the policy that won, applied up to 2025.
 * Usage: cd web && npx tsx scripts/nfl-backtest.mts
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseGames } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { GAMES_URL } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
const { tune, modelPreds, score, pairedDiff, ll } = await import(join(webDir, 'src/lib/nfl/backtest.ts'))
const { devig } = await import(join(webDir, 'src/lib/nfl/odds.ts'))

const games = parseGames(await (await fetch(GAMES_URL)).text()).filter((g: any) => g.season <= 2025)
const byId = new Map(games.map((g: any) => [g.game_id, g]))
const priced = (x: any) => { const g: any = byId.get(x.game_id); return g.spread_line !== null && devig(g.home_ml, g.away_ml) !== null }
const asMarket = (x: any) => { const g: any = byId.get(x.game_id); return { ...x, p: devig(g.home_ml, g.away_ml)!.home, spread: g.spread_line } }
const fmt = (s: any) => `log loss ${s.logLoss.toFixed(5)}  Brier ${s.brier.toFixed(5)}  hittni ${(100 * s.acc).toFixed(1)}%  forgjafarskekkja ${s.spreadMae.toFixed(2)} stig`
const ci = (d: any) => `${d.mean.toFixed(5)} [${d.lo.toFixed(5)}, ${d.hi.toFixed(5)}]`
const lls = (xs: any[]) => xs.map((x) => ll(x.p, x.s))

// 1. main test
const old = tune(games, 2002, 2014, 2015)
console.log('1) valið á 2002-2014:', old.params)
const test = modelPreds(games, old.params, 2015, 2025).filter(priced)
const market = test.map(asMarket)
console.log(`   prófun 2015-2025, ${test.length} leikir`)
console.log('   líkanið', fmt(score(test)))
console.log('   Vegas  ', fmt(score(market)))
console.log('   líkan − Vegas, log loss:', ci(pairedDiff(lls(test), lls(market))))

// 2. policy test on 2020-2025
const oldWin = tune(games, 2002, 2014, 2020)
const recent = tune(games, 2010, 2019, 2020)
console.log('\n2) stefnupróf á 2020-2025')
console.log('   gamalt val (2002-2014):', oldWin.params)
console.log('   nýlegt val (2010-2019):', recent.params)
const a = modelPreds(games, oldWin.params, 2020, 2025).filter(priced)
const b = modelPreds(games, recent.params, 2020, 2025).filter(priced)
const mk = b.map(asMarket)
console.log(`   ${b.length} leikir`)
console.log('   gamalt ', fmt(score(a)))
console.log('   nýlegt ', fmt(score(b)))
console.log('   Vegas  ', fmt(score(mk)))
console.log('   nýlegt − gamalt, log loss:', ci(pairedDiff(lls(b), lls(a))))

// 3. production candidate: latest ten complete seasons
const prod = tune(games, 2016, 2025, 2026)
console.log('\n3) valið á 2016-2025 (fyrir 2026):', prod.params, 'log loss í vali', prod.logLoss.toFixed(5))
