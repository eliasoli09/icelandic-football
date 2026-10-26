# Markaðurinn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page `/leikmenn/markadur` on Snertimark that prices every fantasy offence player (QB/RB/WR/TE) week by week from our own stats: rank-over-time chart, board, risers/fallers and a trade calculator.

**Architecture:** Pure functions in `nfl-web/src/lib/nfl/market.ts` turn player lines, last season's totals, the schedule and the injury list into one ranked snapshot per completed round. The NFL cron writes snapshots to a new table `nfl_market` (migration 019) through a secret-guarded RPC. The page reads all of the season's snapshots, and `marketView.ts` shapes them into board, chart series and movers for client components (recharts). The projection's parameters are measured forward first (`scripts/nfl-market-backtest.mts`) and only replace the naive average if they pass.

**Tech Stack:** Next 16 / React 19 (nfl-web), TypeScript, vitest, recharts 3, Supabase (Postgres RPC), nflverse CSVs (CC BY 4.0).

Spec: `docs/superpowers/specs/2026-10-26-nfl-markadur-design.md`. Read the vault first: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Besta spáin/START HÉR.md`, then `NFL/Yfirlit.md` and `Lærdómur/Gildrur.md` (1: Supabase returns 1,000 rows silently, 30: number formatting, 33: tuning leaks, 34: Vercel). All user-facing text is Icelandic, with hyphens, never em dashes.

**Deviations from the spec, decided while planning:**
- `nfl_market` also stores `position`, `team` and `games` (the "biggest movers since week 1" list needs games played, and the board needs position and team without a join).
- `Doubtful` takes one game off, like `Out` (same as `isUnavailable` in `injuries.ts`). `Cut` means 0 games left.
- The backtest's 95% interval is clustered: per player-season mean differences first, then the interval over those (the same player over 12 weeks is not 12 independent samples).

## File structure

| File | Responsibility |
|---|---|
| `nfl-web/src/lib/nfl/stars.ts` (modify) | export `FantasyLine`, widen `offenceScore` to it |
| `nfl-web/src/lib/nfl/backtest.ts` (modify) | add `tuneBy` (generic grid search with the test-window guard) |
| `nfl-web/src/lib/nfl/market.ts` (create) | projection, games left, replacement, snapshot ranking, trade verdict, movers |
| `nfl-web/test/nfl-market.test.ts` (create) | unit tests for `market.ts` |
| `nfl-web/scripts/nfl-market-backtest.mts` (create) | forward measurement, prints `NFL_MARKET` |
| `supabase/migrations/019_nfl_market.sql` (create) | table, policy, `rpc_replace_nfl_market` |
| `nfl-web/src/lib/nfl/queries.ts` (modify) | `nflMarketInputs`, `nflMarketWeeks`, `nflMarket` |
| `nfl-web/src/lib/nfl/marketIngest.ts` (create) | compute missing completed rounds and write them |
| `nfl-web/src/lib/nfl/ingest.ts` (modify) | call `ingestMarket` in the cron, `market` in the result |
| `nfl-web/scripts/ingest-nfl-market.mts` (create) | backfill a season by hand |
| `nfl-web/src/lib/nfl/marketView.ts` (create) | board, series, movers from stored rows (pure) |
| `nfl-web/test/nfl-market-view.test.ts` (create) | unit tests for `marketView.ts` |
| `nfl-web/src/components/Nfl/MarketChart.tsx` (create) | rank-over-time chart |
| `nfl-web/src/components/Nfl/MarketBoard.tsx` (create) | the board with filters and + |
| `nfl-web/src/components/Nfl/MarketMovers.tsx` (create) | Kaupa núna / Selja núna, movers since week 1 |
| `nfl-web/src/components/Nfl/TradeCalculator.tsx` (create) | Skiptireiknir |
| `nfl-web/src/components/Nfl/MarketView.tsx` (create) | client shell: selection, URL `?p=`, range |
| `nfl-web/src/components/Nfl/PlayersSwitch.tsx` (modify) | fifth tab |
| `nfl-web/src/app/leikmenn/markadur/page.tsx` (create) | server page |
| vault `NFL/Orðasafn.md`, `NFL/Markaðurinn.md`, `NFL/Yfirlit.md` | words, measurement result, page list |

All commands run from `/Users/elias/FH leikmenn/nfl-markadur-wt/nfl-web` unless stated. The worktree is on branch `nfl-markadur` (made from `origin/main` a9bc303, the spec is commit d6a466e).

---

### Task 0: Worktree setup

**Files:** none tracked.

- [ ] **Step 1: Copy the untracked env and Vercel link (pitfall 34)**

```bash
cp "/Users/elias/FH leikmenn/nfl-live-wt/nfl-web/.env.local" .env.local
mkdir -p .vercel && cp "/Users/elias/FH leikmenn/nfl-live-wt/nfl-web/.vercel/project.json" .vercel/project.json
```

- [ ] **Step 2: Install and run the existing tests**

```bash
npm ci
npx vitest run 2>&1 | tail -5
```
Expected: all test files pass (no new ones yet).

---

### Task 1: `FantasyLine` and `tuneBy`

**Files:**
- Modify: `nfl-web/src/lib/nfl/stars.ts:38-43`
- Modify: `nfl-web/src/lib/nfl/backtest.ts` (append)
- Test: `nfl-web/test/nfl-backtest.test.ts` (append)

- [ ] **Step 1: Write the failing test for `tuneBy`** (append to `test/nfl-backtest.test.ts`, and add `tuneBy` to its import from `'../src/lib/nfl/backtest'`)

```ts
describe('tuneBy', () => {
  it('velur lægsta', () => {
    expect(tuneBy([3, 1, 2], (x) => x, 2014, 2015)).toEqual({ best: 1, logLoss: 1 })
  })
  it('neitar að velja á prófunarárum', () => {
    expect(() => tuneBy([1], (x) => x, 2015, 2015)).toThrow()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/nfl-backtest.test.ts`
Expected: FAIL, `tuneBy` is not exported.

- [ ] **Step 3: Add `tuneBy` to the end of `src/lib/nfl/backtest.ts`**

```ts
/** Pick the candidate with the lowest score. Same guard as `tune`: the window must end before the test seasons. */
export function tuneBy<T>(candidates: T[], run: (c: T) => number, to: number, testFrom = TEST_FROM): { best: T; logLoss: number } {
  if (to >= testFrom) throw new Error(`Stillingar má aðeins velja á tímabilum fyrir ${testFrom}, ekki til ${to}`)
  let best = { best: candidates[0], logLoss: Infinity }
  for (const c of candidates) { const l = run(c); if (l < best.logLoss) best = { best: c, logLoss: l } }
  return best
}
```

- [ ] **Step 4: Widen `offenceScore` in `src/lib/nfl/stars.ts`** (replace the comment line and signature at lines 38-39; the body stays)

```ts
/** The fields fantasy points are made of. */
export type FantasyLine = Pick<StarLine, 'passing_yards' | 'passing_tds' | 'interceptions' | 'rushing_yards' | 'rushing_tds' | 'receptions' | 'receiving_yards' | 'receiving_tds' | 'fumbles_lost'>

/** Fantasy-style points (half a point a catch): yards, touchdowns, minus turnovers. */
export function offenceScore(l: FantasyLine): number {
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx vitest run test/nfl-backtest.test.ts test/nfl-stars.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nfl/stars.ts src/lib/nfl/backtest.ts test/nfl-backtest.test.ts
git commit -m "nfl: tuneBy í backtest og FantasyLine fyrir stigin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `market.ts`, the pure core

**Files:**
- Create: `nfl-web/src/lib/nfl/market.ts`
- Test: `nfl-web/test/nfl-market.test.ts`

- [ ] **Step 1: Write the failing tests** (`test/nfl-market.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { gamesLeft, MARKET_NAIVE, marketWeek, movers, projection, tradeVerdict, type MarketLine, type MarketPlayer } from '../src/lib/nfl/market'

const Z = { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 0, rushing_tds: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0, fumbles_lost: 0 }
// receiving yards / 10 = points, so 200 yards is 20 points
const line = (player_id: string, week: number, team: string, yards: number): MarketLine => ({ ...Z, player_id, week, team, game_id: `g${week}${team}`, receiving_yards: yards })
const G = (week: number, home: string, away: string, game_type: 'REG' | 'WC' = 'REG') => ({ season: 2026, game_type, week, home, away })

describe('spá í leik', () => {
  it('blandar tímabilunum og dregur að forgildi', () => {
    expect(projection({ games: 2, total: 30 }, { games: 10, total: 100 }, { prev: 0.5, k: 2, prior: 6 })).toBeCloseTo(92 / 9)
  })
  it('einfalda meðaltalið', () => {
    expect(projection({ games: 2, total: 30 }, { games: 10, total: 100 }, MARKET_NAIVE.WR)).toBe(15)
    expect(projection({ games: 0, total: 0 }, { games: 0, total: 0 }, MARKET_NAIVE.WR)).toBe(0)
  })
})

describe('leikir eftir', () => {
  // KC: weeks 1, 2, 4, 5 and a play-off game; week 3 is the bye
  const games = [G(1, 'KC', 'LV'), G(2, 'DEN', 'KC'), G(4, 'KC', 'LAC'), G(5, 'BUF', 'KC'), G(19, 'KC', 'HOU', 'WC')]
  it('frí og úrslitakeppni teljast ekki', () => expect(gamesLeft('KC', 2026, 1, games)).toBe(3))
  it('meiðsli draga frá', () => {
    expect(gamesLeft('KC', 2026, 1, games, 'Out')).toBe(2)
    expect(gamesLeft('KC', 2026, 1, games, 'Doubtful')).toBe(2)
    expect(gamesLeft('KC', 2026, 1, games, 'Questionable')).toBe(3)
    expect(gamesLeft('KC', 2026, 1, games, 'IR')).toBe(0)
    expect(gamesLeft('KC', 2026, 1, games, 'Cut')).toBe(0)
  })
})

describe('markaðurinn í einni umferð', () => {
  const games = [G(1, 'T1', 'T2'), G(1, 'T3', 'T4'), G(2, 'T1', 'T3'), G(2, 'T2', 'T4'), G(3, 'T1', 'T4'), G(3, 'T2', 'T3')]
  const players: MarketPlayer[] = [
    { player_id: 'A', position: 'WR', team: 'T1' }, { player_id: 'B', position: 'WR', team: 'T2' },
    { player_id: 'C', position: 'WR', team: 'T3' }, { player_id: 'D', position: 'RB', team: 'T4' },
    { player_id: 'E', position: 'WR', team: null }, { player_id: 'F', position: 'K', team: 'T1' },
  ]
  const lines = [line('A', 1, 'T1', 200), line('B', 1, 'T2', 150), line('C', 1, 'T3', 100), line('D', 1, 'T4', 120),
    line('E', 1, 'T1', 300), line('F', 1, 'T1', 90), line('A', 2, 'T1', 0)]
  const base = { season: 2026, week: 1, lines, prev: new Map(), players, games, injuries: new Map(), params: MARKET_NAIVE }

  it('verðmæti = (spá − varamannsstig) × leikir eftir, raðað', () => {
    const rows = marketWeek(base)
    // fewer than 36 WRs: the last one listed is the replacement (C, 10); the only RB is its own replacement
    expect(rows.map((r) => [r.player_id, r.value, r.rank, r.pos_rank])).toEqual([
      ['A', 20, 1, 1], ['B', 10, 2, 2], ['D', 0, 3, 1], ['C', 0, 4, 3],
    ])
    expect(rows[0]).toMatchObject({ position: 'WR', team: 'T1', games: 1, proj: 20, games_left: 2 })
  })
  it('meiddur leikmaður á færri leiki eftir', () => {
    const rows = marketWeek({ ...base, injuries: new Map([['A', 'Out' as const]]) })
    expect(rows.find((r) => r.player_id === 'A')).toMatchObject({ games_left: 1, value: 10 })
  })
  it('leikmaður með leik í fyrra en ekki í ár er með', () => {
    const rows = marketWeek({ ...base, players: [...players, { player_id: 'G', position: 'TE', team: 'T2' }], prev: new Map([['G', { games: 10, total: 80 }]]), params: { ...MARKET_NAIVE, TE: { prev: 1, k: 0, prior: 0 } } })
    expect(rows.find((r) => r.player_id === 'G')).toMatchObject({ games: 0, proj: 8, games_left: 2 })
  })
})

describe('skiptireiknir', () => {
  it('sanngjarnt innan 10%', () => expect(tradeVerdict([50], [46])).toEqual({ a: 50, b: 46, fair: true, winner: null, margin: 4 }))
  it('neikvætt verðmæti telst 0', () => expect(tradeVerdict([50], [30, -5])).toEqual({ a: 50, b: 30, fair: false, winner: 'a', margin: 20 }))
  it('tómt er sanngjarnt', () => expect(tradeVerdict([], []).fair).toBe(true))
})

describe('hreyfingar', () => {
  const now = [{ player_id: 'p1', rank: 1, games: 3 }, { player_id: 'p2', rank: 2, games: 3 }, { player_id: 'p3', rank: 3, games: 1 }, { player_id: 'p4', rank: 4, games: 3 }]
  const before = [{ player_id: 'p1', rank: 3 }, { player_id: 'p2', rank: 1 }, { player_id: 'p3', rank: 2 }]
  it('upp og niður, nýir leikmenn ekki með', () => {
    const m = movers(now, before)
    expect(m.up).toEqual([{ player_id: 'p1', rank: 1, from: 3, change: 2 }])
    expect(m.down.map((x) => x.player_id)).toEqual(['p2', 'p3'])
  })
  it('lágmarksfjöldi leikja', () => expect(movers(now, before, 5, 300, 3).down.map((x) => x.player_id)).toEqual(['p2']))
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/nfl-market.test.ts`
Expected: FAIL, cannot find module `../src/lib/nfl/market`.

- [ ] **Step 3: Write `src/lib/nfl/market.ts`**

```ts
import { offenceScore, type FantasyLine } from './stars'
import type { InjuryStatus } from './injuries'
import type { NflGame } from './types'

/**
 * Markaðurinn: what every fantasy offence player is worth, from our own stats.
 * Value = (expected points a game − the position's replacement) × games left,
 * in half-PPR points. See the vault, NFL/Markaðurinn.
 */

export type MarketPos = 'QB' | 'RB' | 'WR' | 'TE'
export const MARKET_POSITIONS: MarketPos[] = ['QB', 'RB', 'WR', 'TE']
export const isMarketPos = (p: string | null): p is MarketPos => p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE'

/** The last starter in a 12-team league. */
export const REPLACEMENT: Record<MarketPos, number> = { QB: 12, RB: 30, WR: 36, TE: 12 }

export interface PosParams {
  /** Weight of a game last season against one this season. */
  prev: number
  /** Games' worth of `prior` in every projection. */
  k: number
  /** Points a game for a player we know nothing about. */
  prior: number
}
export type MarketParams = Record<MarketPos, PosParams>
const NAIVE: PosParams = { prev: 0, k: 0, prior: 0 }
/** Points a game so far this season, nothing else. */
export const MARKET_NAIVE: MarketParams = { QB: NAIVE, RB: NAIVE, WR: NAIVE, TE: NAIVE }
/** Chosen by scripts/nfl-market-backtest.mts (Task 3 replaces this line with its output). */
export const NFL_MARKET: MarketParams = MARKET_NAIVE

export interface Tally { games: number; total: number }

/** Expected points a game: this season and last (weighted `prev`), pulled towards `prior` by `k` games. */
export function projection(cur: Tally, prev: Tally, p: PosParams): number {
  const w = cur.games + p.prev * prev.games + p.k
  return w > 0 ? (cur.total + p.prev * prev.total + p.k * p.prior) / w : 0
}

type Sched = Pick<NflGame, 'season' | 'game_type' | 'week' | 'home' | 'away'>
/** Games an injury status takes off; Questionable takes none, Cut takes all. */
const OUT_GAMES: Partial<Record<InjuryStatus, number>> = { Out: 1, Doubtful: 1, IR: 4, PUP: 4, Reserve: 4 }

/** The club's regular-season games after `afterWeek`, less what the player's status keeps him out of. */
export function gamesLeft(team: string, season: number, afterWeek: number, games: Sched[], status: InjuryStatus | null = null): number {
  if (status === 'Cut') return 0
  const left = games.filter((g) => g.season === season && g.game_type === 'REG' && g.week > afterWeek && (g.home === team || g.away === team)).length
  return Math.max(0, left - (status ? OUT_GAMES[status] ?? 0 : 0))
}

export type MarketLine = FantasyLine & { player_id: string; week: number; team: string; game_id: string }
export interface MarketPlayer { player_id: string; position: string | null; team: string | null }
export interface MarketRow {
  player_id: string
  position: MarketPos
  team: string
  /** Games played this season up to the round. */
  games: number
  proj: number
  games_left: number
  value: number
  rank: number
  pos_rank: number
}
export interface MarketInput {
  season: number
  /** The completed round the snapshot is taken after. */
  week: number
  /** This season's regular-season lines (later rounds are ignored). */
  lines: MarketLine[]
  /** Last season's regular season, in fantasy points. */
  prev: Map<string, Tally>
  players: MarketPlayer[]
  games: Sched[]
  injuries: Map<string, InjuryStatus>
  params: MarketParams
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

/**
 * One snapshot. A player counts if the register has him on a club and he
 * played this season or last; his schedule is the club he last played for
 * this season, else the register's.
 */
export function marketWeek(x: MarketInput): MarketRow[] {
  const cur = new Map<string, Tally & { team: string; week: number }>()
  for (const l of x.lines) {
    if (l.week > x.week) continue
    const t = cur.get(l.player_id) ?? { games: 0, total: 0, team: l.team, week: 0 }
    t.games++
    t.total += offenceScore(l)
    if (l.week >= t.week) { t.team = l.team; t.week = l.week }
    cur.set(l.player_id, t)
  }
  const cands: Omit<MarketRow, 'value' | 'rank' | 'pos_rank'>[] = []
  for (const p of x.players) {
    if (!isMarketPos(p.position) || !p.team) continue
    const c = cur.get(p.player_id)
    const pv = x.prev.get(p.player_id) ?? { games: 0, total: 0 }
    if (!c && pv.games === 0) continue
    const team = c?.team ?? p.team
    cands.push({
      player_id: p.player_id, position: p.position, team, games: c?.games ?? 0,
      proj: round(projection(c ?? { games: 0, total: 0 }, pv, x.params[p.position]), 2),
      games_left: gamesLeft(team, x.season, x.week, x.games, x.injuries.get(p.player_id) ?? null),
    })
  }
  const repl = {} as Record<MarketPos, number>
  for (const pos of MARKET_POSITIONS) {
    const ps = cands.filter((c) => c.position === pos).map((c) => c.proj).sort((a, b) => b - a)
    repl[pos] = ps.length ? ps[Math.min(REPLACEMENT[pos], ps.length) - 1] : 0
  }
  const rows: MarketRow[] = cands
    .map((c) => ({ ...c, value: round((c.proj - repl[c.position]) * c.games_left, 1), rank: 0, pos_rank: 0 }))
    .sort((a, b) => b.value - a.value || b.proj - a.proj || a.player_id.localeCompare(b.player_id))
  const n: Partial<Record<MarketPos, number>> = {}
  rows.forEach((r, i) => { r.rank = i + 1; r.pos_rank = n[r.position] = (n[r.position] ?? 0) + 1 })
  return rows
}

export interface TradeVerdict { a: number; b: number; fair: boolean; winner: 'a' | 'b' | null; margin: number }

/** Sum each side (a player below replacement adds nothing); fair within 10% of the bigger side. */
export function tradeVerdict(a: number[], b: number[]): TradeVerdict {
  const sum = (xs: number[]) => round(xs.reduce((t, v) => t + Math.max(v, 0), 0), 1)
  const [sa, sb] = [sum(a), sum(b)]
  const margin = round(Math.abs(sa - sb), 1)
  const fair = margin <= 0.1 * Math.max(sa, sb)
  return { a: sa, b: sb, fair, winner: fair ? null : sa > sb ? 'a' : 'b', margin }
}

export interface Move { player_id: string; rank: number; from: number; change: number }

/** Biggest climbs and drops between two snapshots, among the top `top` now, with at least `minGames` played. */
export function movers(now: Pick<MarketRow, 'player_id' | 'rank' | 'games'>[], before: Pick<MarketRow, 'player_id' | 'rank'>[], n = 5, top = 300, minGames = 0): { up: Move[]; down: Move[] } {
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const moves = now
    .filter((r) => r.rank <= top && r.games >= minGames && was.has(r.player_id))
    .map((r) => ({ player_id: r.player_id, rank: r.rank, from: was.get(r.player_id)!, change: was.get(r.player_id)! - r.rank }))
  return {
    up: moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change || a.rank - b.rank).slice(0, n),
    down: moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change || a.rank - b.rank).slice(0, n),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/nfl-market.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nfl/market.ts test/nfl-market.test.ts
git commit -m "nfl: Markaðurinn - verðmæti, varamannsstig, skiptireiknir og hreyfingar (hrein föll)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Forward measurement of the projection

**Files:**
- Create: `nfl-web/scripts/nfl-market-backtest.mts`
- Modify: `nfl-web/src/lib/nfl/market.ts` (the `NFL_MARKET` line only)

The measurement was fixed in the spec before any run. Do not widen the grid or change the sample after seeing the 2022-2025 result (pitfall 33). An edge flag on the tuning years may be fixed by widening the grid **once, before step 3's test is read**. The script prints the tuning result first, so check it before scrolling.

- [ ] **Step 1: Write the script**

```ts
/**
 * Markaðurinn: does the projection beat "points a game so far"? (spec 2026-10-26-nfl-markadur-design.md)
 *  - Samples: after rounds 3-14 of seasons 2016-2025, offence players with at least 1 game so far
 *    and at least 3 games after the round. Target: points a game over the rest of the regular season.
 *  - prev/k/prior chosen per position on 2016-2021, tested once on 2022-2025 against the naive
 *    average. 95% interval over player-seasons (each one's mean difference), not over rows.
 *  - Passes only if the whole interval of (|proj − target| − |naive − target|) is below 0.
 * Usage: cd nfl-web && npx tsx scripts/nfl-market-backtest.mts
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parsePlayerWeeks, weeksUrlFor } = await (async () => {
  const p = await import(join(webDir, 'src/lib/nfl/players.ts'))
  const i = await import(join(webDir, 'src/lib/nfl/playerIngest.ts'))
  return { parsePlayerWeeks: p.parsePlayerWeeks, weeksUrlFor: i.weeksUrl }
})()
const { offenceScore } = await import(join(webDir, 'src/lib/nfl/stars.ts'))
const { MARKET_NAIVE, MARKET_POSITIONS, isMarketPos, projection } = await import(join(webDir, 'src/lib/nfl/market.ts'))
const { pairedDiff, tuneBy } = await import(join(webDir, 'src/lib/nfl/backtest.ts'))

type Tally = { games: number; total: number }
type Sample = { season: number; id: string; pos: string; cur: Tally; prev: Tally; target: number }

const pts = new Map<number, Map<string, Map<number, number>>>() // season → player → week → points
const pos = new Map<string, string>()
for (let s = 2015; s <= 2025; s++) {
  const res = await fetch(weeksUrlFor(s))
  if (!res.ok) throw new Error(`nflverse ${res.status} ${s}`)
  const { weeks, seen } = parsePlayerWeeks(await res.text())
  for (const [id, p] of seen) if (p.position) pos.set(id, p.position)
  const m = new Map<string, Map<number, number>>()
  for (const w of weeks) if (w.season_type === 'REG') {
    if (!m.has(w.player_id)) m.set(w.player_id, new Map())
    m.get(w.player_id)!.set(w.week, offenceScore(w))
  }
  pts.set(s, m)
  console.log(`${s}: ${weeks.length} raðir`)
}

const samples: Sample[] = []
for (let s = 2016; s <= 2025; s++) {
  const prevSeason = pts.get(s - 1)!
  for (const [id, byWeek] of pts.get(s)!) {
    const p = pos.get(id) ?? null
    if (!isMarketPos(p)) continue
    const pw = [...(prevSeason.get(id)?.values() ?? [])]
    const prev = { games: pw.length, total: pw.reduce((t, x) => t + x, 0) }
    for (let w = 3; w <= 14; w++) {
      const before = [...byWeek].filter(([wk]) => wk <= w).map(([, x]) => x)
      const after = [...byWeek].filter(([wk]) => wk > w).map(([, x]) => x)
      if (before.length < 1 || after.length < 3) continue
      samples.push({ season: s, id, pos: p, cur: { games: before.length, total: before.reduce((t, x) => t + x, 0) }, prev, target: after.reduce((t, x) => t + x, 0) / after.length })
    }
  }
}
console.log(`úrtak: ${samples.length}`)

const GRID = {
  prev: [0, 0.25, 0.5, 0.75, 1],
  k: [0, 1, 2, 3, 4, 6, 8],
  prior: { QB: [6, 9, 12, 15, 18], RB: [2, 4, 6, 8, 10], WR: [2, 4, 6, 8, 10], TE: [2, 4, 6, 8, 10] } as Record<string, number[]>,
}
const err = (x: Sample, p: any) => Math.abs(projection(x.cur, x.prev, p) - x.target)
const mae = (xs: Sample[], p: any) => xs.reduce((t, x) => t + err(x, p), 0) / xs.length

// 1. tuning, 2016-2021
const best: Record<string, any> = {}
console.log('\n1) val á 2016-2021')
for (const P of MARKET_POSITIONS) {
  const tr = samples.filter((x) => x.pos === P && x.season <= 2021)
  const cands = GRID.prev.flatMap((prev) => GRID.k.flatMap((k) => GRID.prior[P].map((prior) => ({ prev, k, prior }))))
  const r = tuneBy(cands, (c: any) => mae(tr, c), 2021, 2022)
  best[P] = r.best
  const edge = (['prev', 'k', 'prior'] as const).filter((key) => {
    const g = key === 'prior' ? GRID.prior[P] : GRID[key]
    const v = r.best[key]
    return (v === g[0] && v !== 0) || v === g[g.length - 1]
  })
  console.log(`   ${P}: ${JSON.stringify(r.best)} MAE ${r.logLoss.toFixed(3)} (einfalt ${mae(tr, MARKET_NAIVE[P]).toFixed(3)})${edge.length ? `  JAÐAR: ${edge.join(', ')}` : ''}`)
}

// 2. test, 2022-2025, clustered by player-season
const te = samples.filter((x) => x.season >= 2022)
const groups = new Map<string, { m: number[]; n: number[] }>()
for (const x of te) {
  const g = groups.get(`${x.season}:${x.id}`) ?? { m: [], n: [] }
  g.m.push(err(x, best[x.pos])); g.n.push(err(x, MARKET_NAIVE[x.pos as 'QB']))
  groups.set(`${x.season}:${x.id}`, g)
}
const mean = (xs: number[]) => xs.reduce((t, v) => t + v, 0) / xs.length
const gm = [...groups.values()]
const d = pairedDiff(gm.map((g) => mean(g.m)), gm.map((g) => mean(g.n)))
console.log(`\n2) prófun 2022-2025: ${te.length} raðir, ${gm.length} leikmannatímabil`)
console.log(`   MAE spá ${(te.reduce((t, x) => t + err(x, best[x.pos]), 0) / te.length).toFixed(3)}, einfalt ${(te.reduce((t, x) => t + err(x, MARKET_NAIVE[x.pos as 'QB']), 0) / te.length).toFixed(3)}`)
console.log(`   spá − einfalt: ${d.mean.toFixed(4)} [${d.lo.toFixed(4)}, ${d.hi.toFixed(4)}]`)
for (const P of MARKET_POSITIONS) {
  const g = [...groups.entries()].filter(([k]) => pos.get(k.split(':')[1]) === P).map(([, v]) => v)
  const dp = pairedDiff(g.map((x) => mean(x.m)), g.map((x) => mean(x.n)))
  console.log(`   ${P} (${g.length}): ${dp.mean.toFixed(4)} [${dp.lo.toFixed(4)}, ${dp.hi.toFixed(4)}]`)
}

// 3. verdict and the line for market.ts
const pass = d.hi < 0
console.log(`\n3) úrskurður: ${pass ? 'spáin stenst' : 'spáin stenst ekki, einfalda meðaltalið fer á síðuna'}`)
const final = pass ? best : { QB: MARKET_NAIVE.QB, RB: MARKET_NAIVE.RB, WR: MARKET_NAIVE.WR, TE: MARKET_NAIVE.TE }
console.log(`\nexport const NFL_MARKET: MarketParams = ${JSON.stringify(final).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}`)
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/nfl-market-backtest.mts 2>&1 | tee /tmp/nfl-market-backtest.txt`
Expected: 11 lines `<season>: <n> raðir` (about 19,000 each), `úrtak:` in the tens of thousands, then sections 1-3 and an `export const NFL_MARKET` line.

- [ ] **Step 3: Read section 1 only.** If a position shows `JAÐAR`, widen that one grid list on the edge side (e.g. `k` add 12, 16) once, then re-run. Do this only before reading section 2. If section 1 has no edge, go on.

- [ ] **Step 4: Paste the printed line into `src/lib/nfl/market.ts`**, replacing `export const NFL_MARKET: MarketParams = MARKET_NAIVE`. Keep the comment above it and change it to say what passed, e.g.:

```ts
/**
 * Chosen by scripts/nfl-market-backtest.mts on 2016-2021, tested on 2022-2025:
 * MAE <spá> against <einfalt>, difference <mean> [<lo>, <hi>] over player-seasons.
 */
```
Fill the four numbers from section 2 of the output. If the verdict was "stenst ekki", the printed line is the naive one. Write that in the comment instead.

- [ ] **Step 5: Tests still pass**

Run: `npx vitest run test/nfl-market.test.ts && npx tsc --noEmit -p .`
Expected: PASS (the tests use `MARKET_NAIVE`, not `NFL_MARKET`).

- [ ] **Step 6: Commit**

```bash
git add scripts/nfl-market-backtest.mts src/lib/nfl/market.ts
git commit -m "nfl: Markaðurinn mældur framvirkt - stillingar spárinnar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Table and RPC

**Files:**
- Create: `supabase/migrations/019_nfl_market.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Markaðurinn: one ranked snapshot of every fantasy offence player after each
-- completed regular-season round. Written whole per round by the NFL cron.

create table public.nfl_market (
  season int not null,
  week int not null,
  player_id text not null references public.nfl_players (player_id),
  position text not null check (position in ('QB', 'RB', 'WR', 'TE')),
  team text not null,
  games int not null,
  proj real not null,
  games_left int not null,
  value real not null,
  rank int not null,
  pos_rank int not null,
  primary key (season, week, player_id)
);
create index nfl_market_rank_idx on public.nfl_market (season, week, rank);
alter table public.nfl_market enable row level security;
create policy "market is public" on public.nfl_market for select using (true);
-- writes only through the function below

create or replace function public.rpc_replace_nfl_market(p_secret text, p_season int, p_week int, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.nfl_market where season = p_season and week = p_week;
  insert into public.nfl_market (season, week, player_id, position, team, games, proj, games_left, value, rank, pos_rank)
  select p_season, p_week, r->>'player_id', r->>'position', r->>'team', (r->>'games')::int, (r->>'proj')::real,
         (r->>'games_left')::int, (r->>'value')::real, (r->>'rank')::int, (r->>'pos_rank')::int
  from jsonb_array_elements(p_rows) r
  where exists (select 1 from public.nfl_players p where p.player_id = r->>'player_id');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rpc_replace_nfl_market(text, int, int, jsonb) from public;
grant execute on function public.rpc_replace_nfl_market(text, int, int, jsonb) to anon, authenticated;
```

- [ ] **Step 2: Check the grant lines match the existing pattern**

Run: `grep -n "grant execute\|revoke" ../supabase/migrations/015_nfl_injury.sql`
Expected: the same `revoke`/`grant` shape. If 015 has no revoke/grant lines, delete the two lines from 019 so it matches.

- [ ] **Step 3: Apply to the production database.** Use the Supabase MCP tool `apply_migration` with project `imzqngcwykvqxzylhujf`, name `nfl_market`, and the file's SQL. Then confirm with `execute_sql`:

```sql
select count(*) from public.nfl_market;
```
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add ../supabase/migrations/019_nfl_market.sql
git commit -m "nfl: taflan nfl_market og rpc_replace_nfl_market (ÞEGAR í framleiðslugrunni)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Reading the inputs and writing snapshots

**Files:**
- Modify: `nfl-web/src/lib/nfl/queries.ts` (append)
- Create: `nfl-web/src/lib/nfl/marketIngest.ts`
- Modify: `nfl-web/src/lib/nfl/ingest.ts:16-27, 89-91, 103-111`
- Create: `nfl-web/scripts/ingest-nfl-market.mts`

- [ ] **Step 1: Append the queries to `src/lib/nfl/queries.ts`** (paged: pitfall 1)

```ts
const FANTASY_COLS = 'passing_yards, passing_tds, interceptions, rushing_yards, rushing_tds, receptions, receiving_yards, receiving_tds, fumbles_lost'

export interface MarketInputs {
  lines: import('./market').MarketLine[]
  prev: Map<string, import('./market').Tally>
  players: (import('./market').MarketPlayer & { name: string; headshot: string | null })[]
}

/** This season's regular-season lines, last season's totals in fantasy points, and every QB/RB/WR/TE on the register, for Markaðurinn. */
export async function nflMarketInputs(season: number): Promise<MarketInputs> {
  const { offenceScore } = await import('./stars')
  const lines: import('./market').MarketLine[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_weeks').select(`player_id, week, team, game_id, ${FANTASY_COLS}`)
      .eq('season', season).eq('season_type', 'REG').order('player_id').order('week').range(from, from + 999)
    if (error) throw error
    lines.push(...((data ?? []) as unknown as import('./market').MarketLine[]))
    if (!data || data.length < 1000) break
  }
  const prev = new Map<string, import('./market').Tally>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_season').select(`player_id, games, ${FANTASY_COLS}`)
      .eq('season', season - 1).eq('season_type', 'REG').in('position', ['QB', 'RB', 'WR', 'TE']).order('player_id').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as unknown as (import('./stars').FantasyLine & { player_id: string; games: number })[]) {
      const n = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'player_id' ? v : Number(v)])) as typeof r
      prev.set(r.player_id, { games: Number(r.games), total: offenceScore(n) })
    }
    if (!data || data.length < 1000) break
  }
  const players: MarketInputs['players'] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_players').select('player_id, name, position, team, headshot')
      .in('position', ['QB', 'RB', 'WR', 'TE']).order('player_id').range(from, from + 999)
    if (error) throw error
    players.push(...((data ?? []) as MarketInputs['players']))
    if (!data || data.length < 1000) break
  }
  return { lines, prev, players }
}

/** Rounds of `season` already in nfl_market. */
export async function nflMarketWeeks(season: number): Promise<number[]> {
  const { data, error } = await db().from('nfl_market').select('week').eq('season', season).eq('rank', 1).order('week').range(0, 99)
  if (error) throw error
  return (data ?? []).map((r) => r.week as number)
}

export interface StoredMarketRow extends import('./market').MarketRow { week: number; name: string; headshot: string | null }

/** Every snapshot of the season, oldest round first, with names. */
export async function nflMarket(season: number): Promise<StoredMarketRow[]> {
  const out: StoredMarketRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_market')
      .select('week, player_id, position, team, games, proj, games_left, value, rank, pos_rank, nfl_players(name, headshot)')
      .eq('season', season).order('week').order('rank').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as unknown as (Omit<StoredMarketRow, 'name' | 'headshot'> & { nfl_players: { name: string; headshot: string | null } | null })[]) {
      const { nfl_players: p, ...rest } = r
      out.push({ ...rest, proj: Number(rest.proj), value: Number(rest.value), name: p?.name ?? 'Óþekktur', headshot: p?.headshot ?? null })
    }
    if (!data || data.length < 1000) break
  }
  return out
}
```

- [ ] **Step 2: Write `src/lib/nfl/marketIngest.ts`**

```ts
import { db } from '../db'
import { availability } from './injuries'
import { marketWeek, NFL_MARKET } from './market'
import { nflInjuries, nflMarketInputs, nflMarketWeeks, nflSeasonGames } from './queries'
import { enoughForWeek } from './stars'
import { isPlayed } from './types'

const SECRET = () => process.env.CRON_SECRET!

/**
 * Write a snapshot for every completed regular-season round that has none yet
 * (or every completed round with `all`). A round is complete when all its games
 * are played and most of them have player lines (nflverse can lag a day).
 */
export async function ingestMarket(season: number, opts: { all?: boolean } = {}): Promise<{ weeks: number[]; rows: number }> {
  const games = await nflSeasonGames(season)
  const reg = games.filter((g) => g.game_type === 'REG')
  const inputs = await nflMarketInputs(season)
  const lineGames = (w: number) => new Set(inputs.lines.filter((l) => l.week === w).map((l) => l.game_id)).size
  const complete = [...new Set(reg.map((g) => g.week))].sort((a, b) => a - b).filter((w) => {
    const wk = reg.filter((g) => g.week === w)
    return wk.every(isPlayed) && enoughForWeek(lineGames(w), wk.length)
  })
  const have = new Set(opts.all ? [] : await nflMarketWeeks(season))
  const todo = complete.filter((w) => !have.has(w))
  let rows = 0
  for (const week of todo) {
    // the next round's report is what keeps a player out of the games still to come
    const inj = await nflInjuries(season, week + 1)
    const rowsOut = marketWeek({
      season, week, lines: inputs.lines, prev: inputs.prev, players: inputs.players, games,
      injuries: availability(inj.rows, inj.week, week + 1), params: NFL_MARKET,
    })
    const { data, error } = await db().rpc('rpc_replace_nfl_market', { p_secret: SECRET(), p_season: season, p_week: week, p_rows: rowsOut })
    if (error) throw new Error(`rpc_replace_nfl_market ${week}: ${error.message}`)
    rows += Number(data)
  }
  return { weeks: todo, rows }
}
```

- [ ] **Step 3: Wire it into the cron in `src/lib/nfl/ingest.ts`**

Add the import next to the others:
```ts
import { ingestMarket } from './marketIngest'
```
In `interface NflIngestResult`, after the `injuries` line:
```ts
  market: { weeks: number[]; rows: number } | { error: string }
```
After the line `const injuries = await ingestInjuries(season).catch(...)`:
```ts
  // Markaðurinn reads the player lines and injuries written just above; a failure leaves the rest untouched
  const market = await ingestMarket(season).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
```
In the returned object, after `injuries,`:
```ts
    market,
```

- [ ] **Step 4: Write `scripts/ingest-nfl-market.mts`**

```ts
/**
 * Fill Markaðurinn for a season - the same code the NFL cron runs.
 * Usage: cd nfl-web && npx tsx scripts/ingest-nfl-market.mts [season] [--all]
 *   --all  rewrite every completed round, not only the missing ones
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { ingestMarket } = await import(join(webDir, 'src/lib/nfl/marketIngest.ts'))
const args = process.argv.slice(2)
const season = Number(args.find((a) => /^\d{4}$/.test(a)) ?? (new Date().getUTCMonth() >= 2 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1))
const t0 = Date.now()
console.log(season, await ingestMarket(season, { all: args.includes('--all') }))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
```

- [ ] **Step 5: Type check, then backfill 2026**

Run: `npx tsc --noEmit -p . && npx tsx scripts/ingest-nfl-market.mts 2026`
Expected: `2026 { weeks: [ 1, 2, ..., 7 ], rows: <about 7 × 400> }` (one entry per completed round; the newest round may be missing if nflverse has not posted its lines yet).

- [ ] **Step 6: Check the stored rows with the Supabase MCP `execute_sql`**

```sql
select week, count(*), max(rank) = count(*) as ranks_dense,
       count(*) filter (where pos_rank = 1) as pos_leaders
from public.nfl_market where season = 2026 group by week order by week;
```
Expected: one row per round, `ranks_dense` true, `pos_leaders` 4. Also check the top of the newest round:
```sql
select m.rank, p.name, m.position, m.team, m.proj, m.games_left, m.value
from public.nfl_market m join public.nfl_players p using (player_id)
where season = 2026 and week = (select max(week) from public.nfl_market where season = 2026)
order by rank limit 15;
```
Expected: recognisable top fantasy players, `games_left` between 8 and 11, no kickers or defenders.

- [ ] **Step 7: Run the rest of the tests (the cron result type changed)**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/nfl/queries.ts src/lib/nfl/marketIngest.ts src/lib/nfl/ingest.ts scripts/ingest-nfl-market.mts
git commit -m "nfl: Markaðurinn skrifaður eftir hverja lokna umferð í cron-inum; 2026 fyllt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `marketView.ts`, shaping stored rows for the page

**Files:**
- Create: `nfl-web/src/lib/nfl/marketView.ts`
- Test: `nfl-web/test/nfl-market-view.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMarketView } from '../src/lib/nfl/marketView'
import type { StoredMarketRow } from '../src/lib/nfl/queries'

const R = (week: number, player_id: string, rank: number, games = week): StoredMarketRow => ({
  week, player_id, rank, games, position: 'WR', team: 'KC', proj: 10, games_left: 10, value: 100 - rank, pos_rank: rank, name: player_id.toUpperCase(), headshot: null,
})

describe('útlit markaðarins', () => {
  const rows = [R(1, 'a', 1), R(1, 'b', 2), R(1, 'c', 3), R(2, 'a', 2), R(2, 'b', 3), R(2, 'c', 1), R(3, 'a', 3), R(3, 'b', 1), R(3, 'c', 2), R(3, 'd', 4, 1)]
  const v = buildMarketView(rows)
  it('umferðir og tafla nýjustu umferðar með breytingu', () => {
    expect(v.weeks).toEqual([1, 2, 3])
    expect(v.board.map((r) => [r.player_id, r.change])).toEqual([['b', 2], ['c', -1], ['a', -1], ['d', null]])
  })
  it('ferill hvers leikmanns', () => {
    expect(v.series.a).toEqual([[1, 1], [2, 2], [3, 3]])
    expect(v.series.d).toEqual([[3, 4]])
  })
  it('hreyfingar vikunnar og frá umferð 1 (minnst 3 leikir)', () => {
    expect(v.week.up.map((m) => m.player_id)).toEqual(['b'])
    // since round 1: b 2 → 1 and c 3 → 2 (both +1, b ranks higher); d has only 1 game
    expect(v.season.up.map((m) => m.player_id)).toEqual(['b', 'c'])
    expect(v.season.down.map((m) => m.player_id)).toEqual(['a'])
  })
  it('tómt', () => expect(buildMarketView([]).board).toEqual([]))
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/nfl-market-view.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write `src/lib/nfl/marketView.ts`**

```ts
import { movers, type Move } from './market'
import type { StoredMarketRow } from './queries'

export type BoardRow = StoredMarketRow & { change: number | null }
export interface MarketView {
  weeks: number[]
  /** The newest round, by rank, with places gained since the round before (null if new). */
  board: BoardRow[]
  /** Rank after each round, for every player who has been in the top 300. */
  series: Record<string, [number, number][]>
  week: { up: Move[]; down: Move[] }
  season: { up: Move[]; down: Move[] }
}

const TOP = 300

export function buildMarketView(rows: StoredMarketRow[]): MarketView {
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b)
  const at = (w: number | undefined) => rows.filter((r) => r.week === w)
  const last = at(weeks[weeks.length - 1])
  const before = at(weeks[weeks.length - 2])
  const first = at(weeks[0])
  const was = new Map(before.map((r) => [r.player_id, r.rank]))
  const board = last.sort((a, b) => a.rank - b.rank).map((r) => ({ ...r, change: was.has(r.player_id) ? was.get(r.player_id)! - r.rank : null }))
  const ever = new Set(rows.filter((r) => r.rank <= TOP).map((r) => r.player_id))
  const series: Record<string, [number, number][]> = {}
  for (const r of [...rows].sort((a, b) => a.week - b.week)) if (ever.has(r.player_id)) (series[r.player_id] ??= []).push([r.week, r.rank])
  return {
    weeks, board, series,
    week: weeks.length > 1 ? movers(last, before, 5, TOP) : { up: [], down: [] },
    season: weeks.length > 1 ? movers(last, first, 10, TOP, 3) : { up: [], down: [] },
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/nfl-market-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nfl/marketView.ts test/nfl-market-view.test.ts
git commit -m "nfl: marketView - tafla, ferlar og hreyfingar úr vistuðum röðum

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Words in the glossary

**Files:**
- Modify (vault): `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Besta spáin/NFL/Orðasafn.md`

- [ ] **Step 1: Read the glossary's table format**

Run: `sed -n 1,30p "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Besta spáin/NFL/Orðasafn.md"`

- [ ] **Step 2: Append these rows to the table that holds fantasy/player terms** (same `| enska | íslenska |` shape):

```markdown
| trade market | Markaðurinn |
| value (fantasy) | verðmæti (í fantasy-stigum) |
| replacement level | varamannsstig |
| buy now / sell now | Kaupa núna / Selja núna |
| trade calculator | Skiptireiknir |
| fair trade | sanngjörn skipti |
| projection (points a game) | spá í leik |
```

Nothing to commit (the vault is not in the repo).

---

### Task 8: The page

**Files:**
- Modify: `nfl-web/src/components/Nfl/PlayersSwitch.tsx`
- Create: `nfl-web/src/components/Nfl/MarketChart.tsx`, `MarketBoard.tsx`, `MarketMovers.tsx`, `TradeCalculator.tsx`, `MarketView.tsx`
- Create: `nfl-web/src/app/leikmenn/markadur/page.tsx`

Numbers on the page are formatted by hand (`toFixed(1).replace('.', ',')`), never `toLocaleString` (pitfall 30).

- [ ] **Step 1: Fifth tab in `PlayersSwitch.tsx`** (replace the comment, the `active` type and `tabs`)

```tsx
/** Tölfræði | Verðlaun | Stjörnulið | Meiðsli | Markaðurinn under the "Leikmenn" tab. */
export function PlayersSwitch({ active }: { active: 'tolfraedi' | 'verdlaun' | 'stjornulid' | 'meidsli' | 'markadur' }) {
  const tabs = [['tolfraedi', '/leikmenn', 'Tölfræði'], ['verdlaun', '/verdlaun', 'Verðlaun'], ['stjornulid', '/leikmenn/stjornulid', 'Stjörnulið'], ['meidsli', '/leikmenn/meidsli', 'Meiðsli'], ['markadur', '/leikmenn/markadur', 'Markaðurinn']] as const
```

- [ ] **Step 2: `MarketChart.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { barColor } from '@/lib/nfl/format'
import type { NflTeam } from '@/lib/nfl/types'

export type Range = '1V' | '1M' | 'ALLT'
const SPAN: Record<Range, number> = { '1V': 2, '1M': 5, ALLT: Infinity }

/** Rank after each round, #1 at the top, one line per chosen player in his club's colour. */
export function MarketChart({ weeks, series, players, teams, range }: {
  weeks: number[]
  series: Record<string, [number, number][]>
  players: { player_id: string; name: string; team: string }[]
  teams: Map<string, NflTeam>
  range: Range
}) {
  const shown = weeks.slice(-Math.min(SPAN[range], weeks.length))
  const data = useMemo(() => shown.map((w) => {
    const p: Record<string, number> = { week: w }
    for (const pl of players) { const hit = series[pl.player_id]?.find(([wk]) => wk === w); if (hit) p[pl.player_id] = hit[1] }
    return p
  }), [shown, players, series])
  if (!players.length) return <p className="muted text-sm">Bættu leikmanni við línuritið með + í töflunni.</p>
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" tickFormatter={(w) => `V${w}`} />
          <YAxis reversed domain={[1, 'dataMax']} tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" allowDecimals={false} tickFormatter={(r) => `#${r}`} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
            labelFormatter={(w) => `Eftir umferð ${w}`}
            formatter={(v, id) => [`#${v}`, players.find((p) => p.player_id === id)?.name ?? String(id)]} />
          {players.map((p) => (
            <Line key={p.player_id} dataKey={p.player_id} stroke={barColor(teams.get(p.team))} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Check `barColor`'s signature**

Run: `grep -n "export const barColor\|export function barColor" -A3 src/lib/nfl/format.ts`
Expected: it takes `NflTeam | undefined` and returns a colour string. If it takes something else, adapt the two `barColor(...)` calls in this task to match (PowerView calls it as `barColor(byAbbr.get(abbr))`).

- [ ] **Step 4: `MarketBoard.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { PlayerHead } from './PlayerHead'
import { barColor } from '@/lib/nfl/format'
import { headshotUrl } from '@/lib/nfl/players'
import type { BoardRow } from '@/lib/nfl/marketView'
import type { NflTeam } from '@/lib/nfl/types'

const FILTERS = ['Allir', 'QB', 'RB', 'WR', 'TE'] as const
const pts = (x: number) => x.toFixed(1).replace('.', ',')

export function Change({ n }: { n: number | null }) {
  if (n === null) return <span className="text-xs muted">nýr</span>
  if (n === 0) return <span className="text-xs muted">-</span>
  return <span className="text-xs font-semibold" style={{ color: n > 0 ? 'var(--good, #3fb950)' : 'var(--bad, #f85149)' }}>{n > 0 ? '▲' : '▼'} {Math.abs(n)}</span>
}

/** The newest round, 300 at most, filtered by position; + puts a player on the chart. */
export function MarketBoard({ board, chosen, onToggle, teams }: { board: BoardRow[]; chosen: string[]; onToggle: (id: string) => void; teams: Map<string, NflTeam> }) {
  const [f, setF] = useState<(typeof FILTERS)[number]>('Allir')
  const [all, setAll] = useState(false)
  const rows = board.filter((r) => r.rank <= 300 && (f === 'Allir' || r.position === f))
  return (
    <section className="card p-4 grid gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="display text-lg font-extrabold">Taflan</h2>
        <div className="inline-flex rounded-full border p-1 text-xs" style={{ borderColor: 'var(--border)' }}>
          {FILTERS.map((x) => (
            <button key={x} onClick={() => setF(x)} aria-pressed={f === x} className="rounded-full px-3 min-h-[32px] font-semibold"
              style={{ background: f === x ? 'var(--accent)' : 'transparent', color: f === x ? 'var(--accent-ink)' : 'var(--text-2)' }}>{x}</button>
          ))}
        </div>
      </div>
      <ol className="grid gap-1">
        {(all ? rows : rows.slice(0, 25)).map((r) => {
          const on = chosen.includes(r.player_id)
          return (
            <li key={r.player_id} className="trow flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
              <span className="w-8 text-right tabular-nums font-bold">{r.rank}</span>
              <PlayerHead name={r.name} src={headshotUrl(r.headshot, 32)} color={barColor(teams.get(r.team))} size={32} />
              <Link href={`/leikmadur/${r.player_id}`} className="min-w-0 flex-1">
                <span className="font-semibold truncate block">{r.name}</span>
                <span className="text-xs muted">{r.position}{r.pos_rank} · {r.team} · {pts(r.value)} stig</span>
              </Link>
              <Change n={r.change} />
              <button onClick={() => onToggle(r.player_id)} aria-pressed={on} aria-label={on ? `Taka ${r.name} af línuritinu` : `Setja ${r.name} á línuritið`}
                className="w-9 h-9 rounded-full border inline-flex items-center justify-center" style={{ borderColor: on ? 'var(--accent)' : 'var(--border)' }}>
                {on ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
              </button>
            </li>
          )
        })}
      </ol>
      {!all && rows.length > 25 && <button onClick={() => setAll(true)} className="text-sm font-semibold underline">Sýna alla {rows.length}</button>}
    </section>
  )
}
```

- [ ] **Step 5: Check that `PlayerHead` accepts these props and `trow` exists**

Run: `grep -n "export function PlayerHead" src/components/Nfl/PlayerHead.tsx && grep -rn "\.trow" src/app/globals.css | head -2`
Expected: `PlayerHead({ name, src, color, size })` and a `.trow` rule. (Both are used the same way in `LeadersView.tsx`.)

- [ ] **Step 6: `MarketMovers.tsx`**

```tsx
import type { Move } from '@/lib/nfl/market'
import type { BoardRow } from '@/lib/nfl/marketView'

function List({ title, sub, moves, names, onPick }: { title: string; sub: string; moves: Move[]; names: Map<string, BoardRow>; onPick: (id: string) => void }) {
  return (
    <div className="card p-4">
      <h3 className="display font-extrabold">{title}</h3>
      <p className="text-xs muted mb-2">{sub}</p>
      {moves.length ? (
        <ol className="grid gap-1">
          {moves.map((m) => {
            const r = names.get(m.player_id)
            return (
              <li key={m.player_id}>
                <button onClick={() => onPick(m.player_id)} className="trow w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-left">
                  <span className="min-w-0 truncate"><span className="font-semibold">{r?.name ?? m.player_id}</span> <span className="muted text-xs">{r?.position} · #{m.from} → #{m.rank}</span></span>
                  <span className="font-bold tabular-nums" style={{ color: m.change > 0 ? 'var(--good, #3fb950)' : 'var(--bad, #f85149)' }}>{m.change > 0 ? '▲' : '▼'} {Math.abs(m.change)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : <p className="text-sm muted">Engar hreyfingar enn.</p>}
    </div>
  )
}

/** Kaupa núna / Selja núna this round, and the biggest moves since round 1. Clicking a name puts him on the chart. */
export function MarketMovers({ week, season, board, onPick }: { week: { up: Move[]; down: Move[] }; season: { up: Move[]; down: Move[] }; board: BoardRow[]; onPick: (id: string) => void }) {
  const names = new Map(board.map((r) => [r.player_id, r]))
  return (
    <section className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Kaupa núna" sub="Hækkuðu mest í umferðinni: náðu í hann áður en hann verður dýrari" moves={week.up} names={names} onPick={onPick} />
        <List title="Selja núna" sub="Lækkuðu mest í umferðinni: losaðu þig við hann áður en hann fellur meira" moves={week.down} names={names} onPick={onPick} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Upp frá umferð 1" sub="Minnst 3 leikir á tímabilinu" moves={season.up} names={names} onPick={onPick} />
        <List title="Niður frá umferð 1" sub="Minnst 3 leikir á tímabilinu" moves={season.down} names={names} onPick={onPick} />
      </div>
    </section>
  )
}
```

- [ ] **Step 7: `TradeCalculator.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { tradeVerdict } from '@/lib/nfl/market'
import type { BoardRow } from '@/lib/nfl/marketView'

const pts = (x: number) => x.toFixed(1).replace('.', ',')

function Side({ label, ids, setIds, board }: { label: string; ids: string[]; setIds: (x: string[]) => void; board: BoardRow[] }) {
  const [q, setQ] = useState('')
  const hits = q.length < 2 ? [] : board.filter((r) => !ids.includes(r.player_id) && r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
  const byId = new Map(board.map((r) => [r.player_id, r]))
  return (
    <div className="grid gap-2 content-start">
      <h3 className="font-bold">{label}</h3>
      {ids.map((id) => (
        <div key={id} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}>
          <span className="truncate">{byId.get(id)?.name} <span className="muted text-xs">{pts(byId.get(id)?.value ?? 0)}</span></span>
          <button onClick={() => setIds(ids.filter((x) => x !== id))} aria-label="Taka út" className="w-8 h-8 inline-flex items-center justify-center"><X size={14} aria-hidden /></button>
        </div>
      ))}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að leikmanni" className="rounded-lg border px-3 min-h-[40px] text-sm bg-transparent" style={{ borderColor: 'var(--border)' }} />
      {hits.map((r) => (
        <button key={r.player_id} onClick={() => { setIds([...ids, r.player_id]); setQ('') }} className="trow text-left rounded-lg px-2 py-1.5 text-sm">
          {r.name} <span className="muted text-xs">{r.position} · {r.team}</span>
        </button>
      ))}
    </div>
  )
}

/** Skiptireiknir: our value on each side, from the newest round. */
export function TradeCalculator({ board }: { board: BoardRow[] }) {
  const [give, setGive] = useState<string[]>([])
  const [get, setGet] = useState<string[]>([])
  const val = new Map(board.map((r) => [r.player_id, r.value]))
  const v = tradeVerdict(give.map((id) => val.get(id) ?? 0), get.map((id) => val.get(id) ?? 0))
  const ready = give.length > 0 && get.length > 0
  return (
    <section className="card p-4 grid gap-3">
      <h2 className="display text-lg font-extrabold">Skiptireiknir</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Side label={`Þú lætur (${pts(v.a)})`} ids={give} setIds={setGive} board={board} />
        <Side label={`Þú færð (${pts(v.b)})`} ids={get} setIds={setGet} board={board} />
      </div>
      {ready && (
        <p className="font-bold">
          {v.fair ? 'Sanngjörn skipti' : v.winner === 'b' ? `Þú vinnur skiptin um ${pts(v.margin)} stig` : `Hinn vinnur skiptin um ${pts(v.margin)} stig`}
        </p>
      )}
      <p className="text-xs muted">Verðmæti er spáð fantasy-stig umfram varamann það sem eftir er tímabilsins. Leikmaður undir varamannsstigum telst 0. Sanngjarnt er innan 10%.</p>
    </section>
  )
}
```

- [ ] **Step 8: `MarketView.tsx`, the client shell**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { MarketChart, type Range } from './MarketChart'
import { MarketBoard } from './MarketBoard'
import { MarketMovers } from './MarketMovers'
import { TradeCalculator } from './TradeCalculator'
import type { MarketView as View } from '@/lib/nfl/marketView'
import type { NflTeam } from '@/lib/nfl/types'

const MAX = 6

export function MarketView({ view, teams, initial }: { view: View; teams: NflTeam[]; initial: string[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const known = (id: string) => view.board.some((r) => r.player_id === id)
  const fallback = [...view.week.up.slice(0, 2), ...view.week.down.slice(0, 2)].map((m) => m.player_id)
  const [chosen, setChosen] = useState<string[]>(() => {
    const ok = initial.filter(known).slice(0, MAX)
    return ok.length ? ok : fallback.length ? fallback : view.board.slice(0, 3).map((r) => r.player_id)
  })
  const [range, setRange] = useState<Range>('ALLT')
  // the choice lives in the address, so a link shows the same chart
  useEffect(() => { window.history.replaceState(null, '', chosen.length ? `?p=${chosen.join(',')}` : window.location.pathname) }, [chosen])
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX ? c : [...c, id]))
  const pick = (id: string) => setChosen((c) => (c.includes(id) || c.length >= MAX ? c : [...c, id]))
  const players = chosen.map((id) => view.board.find((r) => r.player_id === id)!).filter(Boolean)

  return (
    <div className="grid gap-6">
      <section className="card p-4 grid gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="display text-lg font-extrabold">Verðið, umferð eftir umferð</h2>
          <div className="inline-flex rounded-full border p-1 text-xs" style={{ borderColor: 'var(--border)' }}>
            {(['1V', '1M', 'ALLT'] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className="rounded-full px-3 min-h-[32px] font-semibold"
                style={{ background: range === r ? 'var(--accent)' : 'transparent', color: range === r ? 'var(--accent-ink)' : 'var(--text-2)' }}>{r}</button>
            ))}
          </div>
        </div>
        <MarketChart weeks={view.weeks} series={view.series} players={players} teams={byAbbr} range={range} />
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => (
            <button key={p.player_id} onClick={() => toggle(p.player_id)} className="rounded-full border px-2.5 min-h-[32px] text-xs font-semibold inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}>
              {p.name} #{p.rank} <X size={12} aria-label="Taka af línuritinu" />
            </button>
          ))}
        </div>
      </section>
      <MarketMovers week={view.week} season={view.season} board={view.board} onPick={pick} />
      <MarketBoard board={view.board} chosen={chosen} onToggle={toggle} teams={byAbbr} />
      <TradeCalculator board={view.board} />
    </div>
  )
}
```

- [ ] **Step 9: `src/app/leikmenn/markadur/page.tsx`**

```tsx
import { PlayersSwitch } from '@/components/Nfl/PlayersSwitch'
import { MarketView } from '@/components/Nfl/MarketView'
import { buildMarketView } from '@/lib/nfl/marketView'
import { nflCurrentSeason, nflMarket, nflTeams } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = {
  title: 'Markaðurinn',
  description: 'Hvað er hver fantasy-leikmaður í NFL virði? Verðmæti umferð eftir umferð, hverjir hækka og lækka, og skiptireiknir.',
}

type Props = { searchParams: Promise<{ p?: string }> }

export default async function MarketPage({ searchParams }: Props) {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const [rows, teams] = await Promise.all([nflMarket(season).catch(() => []), nflTeams().catch(() => [])])
  const view = buildMarketView(rows)
  const initial = ((await searchParams).p ?? '').split(',').filter(Boolean)
  return (
    <div className="grid gap-6">
      <PlayersSwitch active="markadur" />
      <header className="grid gap-1">
        <h1 className="display text-2xl font-extrabold">Markaðurinn</h1>
        <p className="muted text-sm">Hvað hver sóknarmaður er virði í fantasy (hálft stig fyrir grip, 12 liða deild), eftir hverja umferð {season}.</p>
      </header>
      {view.board.length ? <MarketView view={view} teams={teams} initial={initial} /> : <p className="muted">Markaðurinn opnar eftir fyrstu umferð.</p>}
      <section className="card p-4 text-sm grid gap-2">
        <h2 className="display font-extrabold">Hvernig verðið er reiknað</h2>
        <p>Við spáum hve mörg stig hver leikmaður fær í leik: meðaltal þessa tímabils og þess síðasta, dregið að meðalleikmanni stöðunnar þegar fáir leikir eru að baki. Þar frá dregst varamaðurinn í stöðunni (QB nr. 12, RB nr. 30, WR nr. 36, TE nr. 12), og munurinn er margfaldaður með leikjunum sem eru eftir. Frí og meiðsli fækka þeim.</p>
        <p>Þetta er mat síðunnar úr tölfræði, ekki verð sem fólk borgar í skiptum. Sæti #1 er verðmætasti leikmaðurinn.</p>
        <p className="muted text-xs">Gögn: nflverse.</p>
      </section>
    </div>
  )
}
```

After Task 3 ran, add one sentence to the second `<p>` with the measured result, e.g. "Spáin var prófuð á 2022-2025 og skeikaði að meðaltali um X stig í leik, á móti Y með einföldu meðaltali." Take X and Y from the backtest output (comma decimals). If the naive average was kept, write instead: "Einfalt meðaltal tímabilsins er notað, því flóknari spá stóðst ekki prófun á 2022-2025."

- [ ] **Step 10: Type check, lint, tests**

Run: `npx tsc --noEmit -p . && npx eslint src/components/Nfl/Market*.tsx src/components/Nfl/TradeCalculator.tsx src/app/leikmenn/markadur && npx vitest run 2>&1 | tail -3`
Expected: no errors, all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/Nfl/PlayersSwitch.tsx src/components/Nfl/Market*.tsx src/components/Nfl/TradeCalculator.tsx src/app/leikmenn/markadur
git commit -m "nfl: síðan Markaðurinn - línurit, tafla, Kaupa núna / Selja núna og skiptireiknir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Check it in the browser

**Files:** none unless something breaks.

`preview_start` always starts "web" (pitfall 29), so run nfl-web's dev server yourself, in the background.

- [ ] **Step 1: Start the dev server** (Bash with `run_in_background: true`)

```bash
cd "/Users/elias/FH leikmenn/nfl-markadur-wt/nfl-web" && npx next dev -p 3021
```

- [ ] **Step 2: Open it and read the page.** Browser pane: `navigate` to `http://localhost:3021/leikmenn/markadur`, then `get_page_text`.
Expected: the tab row with "Markaðurinn" active, the chart heading, Kaupa núna / Selja núna with names, the board starting at #1, the calculator and the explanation. `read_console_messages` with `onlyErrors: true` returns nothing.

- [ ] **Step 3: Interactions**
  - Click + on board row #5. The chart gets a fifth line, and the address bar gains its id in `?p=`.
  - Reload. The same players are on the chart.
  - In the calculator, type 2+ letters on both sides, add a player to each, and check that the verdict line appears.
  - Click "1V" and see the chart narrow to 2 rounds.

- [ ] **Step 4: Phone width.** `resize_window` preset `mobile`, then reload.
  - The page does not scroll sideways: `javascript_tool` → `document.documentElement.scrollWidth <= window.innerWidth` must be `true`.
  - All five tabs can be reached: scroll the tab row, or if "Markaðurinn" is cut off with no visible way to reach it, shorten its label to "Markaður" in `PlayersSwitch.tsx`.
  - Freeze animations and take the screenshot as the proof (vault NFL note: in a hidden pane CSS animations finish and screenshots go stale). Then `resize_window` preset `desktop`.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A src && git commit -m "nfl: Markaðurinn á síma

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Skip if nothing changed.)

---

### Task 10: The vault

**Files (vault):** create `NFL/Markaðurinn.md`, modify `NFL/Yfirlit.md`

- [ ] **Step 1: Write `NFL/Markaðurinn.md`** with:
  - what the page is, where it lives, and branch/commit
  - the formula with the final `NFL_MARKET` values
  - the backtest output (sections 1-3, numbers copied from `/tmp/nfl-market-backtest.txt`)
  - the table and RPC, marked "ÞEGAR í framleiðslugrunni"
  - how to backfill (`scripts/ingest-nfl-market.mts 2026 --all`)
  - that Sleeper trade prices wait for a commercial license (Elias sends the email; the API is non-commercial only)
  - anything surprising found in Tasks 5 and 9

- [ ] **Step 2: In `NFL/Yfirlit.md`**, add `/leikmenn/markadur` to the page list and `nfl_market` (migration 019) to "Töflur og skrif", with a `[[NFL/Markaðurinn]]` link.

- [ ] **Step 3: Do not publish.** Elias looks at localhost first ("full send" = publish). Tell him the branch, that the table is already in production, and that `main` is untouched.
