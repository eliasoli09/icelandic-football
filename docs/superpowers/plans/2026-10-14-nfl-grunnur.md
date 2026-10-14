# NFL-hornið, verkefni 1 (grunnur) - smíðaáætlun

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NFL-gögn frá nflverse í Supabase, og síðurnar `/nfl` (vikan) og `/nfl/stada` (staðan) keyrandi á localhost.

**Architecture:** Hrein föll í `web/src/lib/nfl/` (CSV-lestur, tími, vika, röðun, snið) með prófum. Eitt IO-lag (`ingest.ts`, `queries.ts`) sem talar við Supabase gegnum leyndarmálsvarin RPC. Server-síður lesa eitt tímabil og senda í client-sýnir sem skipta um viku og sýn án nýrrar beiðni.

**Tech Stack:** Next.js 16 (app router, `revalidate`-líkanið, ekki Cache Components), Supabase (supabase-js + plpgsql RPC), Vitest, Tailwind 4 + `globals.css` breytur.

Spec: `docs/superpowers/specs/2026-10-14-nfl-grunnur-design.md`. Orðasafn: hvelfingin `Besta spáin/NFL/Orðasafn.md`.

**Útgáfa er EKKI hluti af þessari áætlun fyrr en Elias hefur skoðað localhost** (verk 13 bíður samþykkis).

---

## Skráaskipan

| Skrá | Ábyrgð |
|---|---|
| `supabase/migrations/005_nfl.sql` | töflur, RLS, tvö RPC |
| `web/src/lib/nfl/types.ts` | `NflGame`, `NflTeam`, `FRANCHISE`, `isPlayed` |
| `web/src/lib/nfl/time.ts` | austurtími → UTC, íslensk dag- og klukkumerki |
| `web/src/lib/nfl/csv.ts` | CSV-þáttari, `parseGames`, `parseTeams` |
| `web/src/lib/nfl/week.ts` | `defaultWeek`, `weekLabel`, `weekTypes` |
| `web/src/lib/nfl/standings.ts` | met, röðun riðla og deilda með ástæðum |
| `web/src/lib/nfl/format.ts` | forgjöf, hlutfall, mismunur, ástæðutextar |
| `web/src/lib/nfl/ingest.ts` | sækja, sannreyna, skrifa; `ingestWarnings` |
| `web/src/lib/nfl/queries.ts` | lestur fyrir síðurnar |
| `web/scripts/ingest-nfl.mts` | keyra innlestur héðan (`--all` fyrir söguna) |
| `web/scripts/fetch-nfl-logos.mts` | sækja merkin í `web/public/nfl/` |
| `web/src/app/api/cron/nfl/route.ts` | daglegur cron |
| `web/src/app/nfl/layout.tsx` | `data-league="nfl"`, haus og undirvalmynd |
| `web/src/app/nfl/page.tsx`, `web/src/app/nfl/stada/page.tsx` | síðurnar |
| `web/src/components/Nfl/*.tsx` | `NflSubnav`, `NflLogo`, `WeekView`, `StandingsView` |
| `web/src/app/globals.css`, `web/src/components/Nav.tsx` | rautt þema, NFL í valmynd, deildaskiptir falinn |
| `web/test/nfl-*.test.ts`, `web/test/fixtures/nfl-*.csv` | próf og raungögn |

Allar skipanir eru keyrðar úr `/Users/elias/FH leikmenn/nfl-wt/web` nema annað sé tekið fram.

---

### Verk 1: Gerðir og tími

**Files:**
- Create: `web/src/lib/nfl/types.ts`, `web/src/lib/nfl/time.ts`
- Test: `web/test/nfl-time.test.ts`

- [ ] **Skref 1: Skrifa prófið**

```ts
import { describe, it, expect } from 'vitest'
import { easternToUtcIso, dayLabel, clock, isSmallHours } from '../src/lib/nfl/time'

describe('easternToUtcIso', () => {
  it('EDT er UTC-4', () => {
    expect(easternToUtcIso('2026-10-15', '20:15')).toBe('2026-10-16T00:15:00.000Z')
    expect(easternToUtcIso('2026-10-25', '13:00')).toBe('2026-10-25T17:00:00.000Z')
  })
  it('EST er UTC-5 frá fyrsta sunnudegi nóvember', () => {
    expect(easternToUtcIso('2026-11-01', '13:00')).toBe('2026-11-01T18:00:00.000Z')
    expect(easternToUtcIso('2027-01-10', '16:30')).toBe('2027-01-10T21:30:00.000Z')
  })
  it('sumartími byrjar annan sunnudag í mars', () => {
    expect(easternToUtcIso('2026-03-08', '13:00')).toBe('2026-03-08T17:00:00.000Z')
    expect(easternToUtcIso('2026-03-07', '13:00')).toBe('2026-03-07T18:00:00.000Z')
  })
})

describe('íslensk merki', () => {
  it('dagur, klukka og aðfaranótt', () => {
    expect(dayLabel('2026-10-16T00:15:00.000Z')).toBe('Föstudagur 16. október')
    expect(clock('2026-10-16T00:15:00.000Z')).toBe('00:15')
    expect(isSmallHours('2026-10-16T00:15:00.000Z')).toBe(true)
    expect(isSmallHours('2026-10-18T17:00:00.000Z')).toBe(false)
  })
})
```

- [ ] **Skref 2: Keyra og sjá falla**

Run: `npx vitest run test/nfl-time.test.ts`
Expected: FAIL, `Cannot find module '../src/lib/nfl/time'`

- [ ] **Skref 3: Útfæra**

`web/src/lib/nfl/types.ts`:

```ts
export type GameType = 'REG' | 'WC' | 'DIV' | 'CON' | 'SB'
export type Conference = 'AFC' | 'NFC'
export type Division = 'East' | 'North' | 'South' | 'West'

export const CONFERENCES: Conference[] = ['AFC', 'NFC']
export const DIVISIONS: Division[] = ['East', 'North', 'South', 'West']

export interface NflTeam {
  abbr: string
  franchise: string
  name: string
  conference: Conference
  division: Division
  color: string
  color2: string
  logo: string
}

export interface NflGame {
  game_id: string
  season: number
  game_type: GameType
  week: number
  kickoff: string
  time_tbd: boolean
  away: string
  home: string
  away_score: number | null
  home_score: number | null
  overtime: boolean
  neutral: boolean
  spread_line: number | null
  total_line: number | null
  away_ml: number | null
  home_ml: number | null
  div_game: boolean
  stadium: string | null
  roof: string | null
  away_qb: string | null
  home_qb: string | null
}

/** Old abbreviations point at the club that carries the history today. */
export const FRANCHISE: Record<string, string> = { OAK: 'LV', SD: 'LAC', STL: 'LA', LAR: 'LA' }

export const isPlayed = (g: Pick<NflGame, 'home_score' | 'away_score'>) =>
  g.home_score !== null && g.away_score !== null
```

`web/src/lib/nfl/time.ts`:

```ts
const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']
const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']

/** Day of month of the nth Sunday; month is 0-based. */
function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
  return 1 + ((7 - first) % 7) + 7 * (n - 1)
}

/**
 * Hours US Eastern is behind UTC. Daylight time runs from 02:00 local on the
 * second Sunday of March to 02:00 local on the first Sunday of November. Done
 * by rule rather than Intl because Node and browsers ship different ICU data.
 */
export function easternOffsetHours(y: number, m: number, d: number, hh: number): number {
  let dst: boolean
  if (m < 3 || m > 11) dst = false
  else if (m > 3 && m < 11) dst = true
  else if (m === 3) {
    const start = nthSunday(y, 2, 2)
    dst = d > start || (d === start && hh >= 2)
  } else {
    const end = nthSunday(y, 10, 1)
    dst = d < end || (d === end && hh < 2)
  }
  return dst ? 4 : 5
}

/** nflverse gives gameday + gametime in US Eastern; store UTC. */
export function easternToUtcIso(gameday: string, gametime: string): string {
  const [y, m, d] = gameday.split('-').map(Number)
  const [hh, mm] = gametime.split(':').map(Number)
  const off = easternOffsetHours(y, m, d, hh)
  return new Date(Date.UTC(y, m - 1, d, hh + off, mm)).toISOString()
}

// Iceland is UTC all year, so the UTC fields are the local ones.
export const dayKey = (iso: string) => iso.slice(0, 10)

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`
}

export function clock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** A kickoff between midnight and six is easy to misread as the evening before. */
export const isSmallHours = (iso: string) => new Date(iso).getUTCHours() < 6
```

- [ ] **Skref 4: Keyra og sjá standast**

Run: `npx vitest run test/nfl-time.test.ts`
Expected: PASS (4 próf)

- [ ] **Skref 5: Commit**

```bash
git add web/src/lib/nfl/types.ts web/src/lib/nfl/time.ts web/test/nfl-time.test.ts
git commit -m "NFL: types and Eastern-to-UTC kickoff times"
```

---

### Verk 2: CSV-lestur á raungögnum

**Files:**
- Create: `web/src/lib/nfl/csv.ts`, `web/test/fixtures/nfl-2025.csv`, `web/test/fixtures/nfl-teams.csv`
- Test: `web/test/nfl-csv.test.ts`

- [ ] **Skref 1: Vista raungögn sem fixtures**

```bash
curl -sL https://github.com/nflverse/nfldata/raw/master/data/games.csv -o /tmp/nfl-games.csv
(head -1 /tmp/nfl-games.csv; grep '^2025_' /tmp/nfl-games.csv) > test/fixtures/nfl-2025.csv
curl -sL https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv -o test/fixtures/nfl-teams.csv
wc -l test/fixtures/nfl-2025.csv test/fixtures/nfl-teams.csv
```
Expected: `nfl-2025.csv` 286 línur (285 leikir + haus), `nfl-teams.csv` 37.


- [ ] **Skref 2: Skrifa prófið**

```ts
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
```

- [ ] **Skref 3: Keyra og sjá falla**

Run: `npx vitest run test/nfl-csv.test.ts`
Expected: FAIL, `Cannot find module '../src/lib/nfl/csv'`

- [ ] **Skref 4: Útfæra `web/src/lib/nfl/csv.ts`**

```ts
import { easternToUtcIso } from './time'
import { FRANCHISE, type Conference, type Division, type GameType, type NflGame, type NflTeam } from './types'

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Rows as objects. A missing column or a ragged row throws: half a file must never be written. */
function table(text: string, required: readonly string[]): Record<string, string>[] {
  const [head, ...body] = parseCsv(text)
  const missing = required.filter((c) => !head.includes(c))
  if (missing.length) throw new Error(`nflverse: dálk vantar í CSV: ${missing.join(', ')}`)
  return body
    .filter((r) => !(r.length === 1 && r[0] === ''))
    .map((r, i) => {
      if (r.length !== head.length) throw new Error(`nflverse: lína ${i + 2} hefur ${r.length} reiti, ekki ${head.length}`)
      return Object.fromEntries(head.map((h, j) => [h, r[j]]))
    })
}

const GAME_COLUMNS = [
  'game_id', 'season', 'game_type', 'week', 'gameday', 'gametime', 'away_team', 'away_score',
  'home_team', 'home_score', 'location', 'overtime', 'away_moneyline', 'home_moneyline',
  'spread_line', 'total_line', 'div_game', 'roof', 'stadium', 'away_qb_name', 'home_qb_name',
] as const
const TEAM_COLUMNS = ['team_abbr', 'team_name', 'team_conf', 'team_division', 'team_color', 'team_color2'] as const
const GAME_TYPES = new Set<GameType>(['REG', 'WC', 'DIV', 'CON', 'SB'])

const num = (s: string): number | null => {
  if (s === '' || s === 'NA') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const text = (s: string): string | null => (s === '' || s === 'NA' ? null : s)

export function parseGames(csv: string): NflGame[] {
  return table(csv, GAME_COLUMNS).map((r) => {
    if (!GAME_TYPES.has(r.game_type as GameType)) throw new Error(`nflverse: óþekkt leikjategund ${r.game_type} (${r.game_id})`)
    const tbd = r.gametime === ''
    return {
      game_id: r.game_id,
      season: Number(r.season),
      game_type: r.game_type as GameType,
      week: Number(r.week),
      // no time yet (late-season flex): keep the date, flag the time
      kickoff: easternToUtcIso(r.gameday, tbd ? '12:00' : r.gametime),
      time_tbd: tbd,
      away: r.away_team,
      home: r.home_team,
      away_score: num(r.away_score),
      home_score: num(r.home_score),
      overtime: r.overtime === '1',
      neutral: r.location === 'Neutral',
      spread_line: num(r.spread_line),
      total_line: num(r.total_line),
      away_ml: num(r.away_moneyline),
      home_ml: num(r.home_moneyline),
      div_game: r.div_game === '1',
      stadium: text(r.stadium),
      roof: text(r.roof),
      away_qb: text(r.away_qb_name),
      home_qb: text(r.home_qb_name),
    }
  })
}

export function parseTeams(csv: string): NflTeam[] {
  return table(csv, TEAM_COLUMNS).map((r) => {
    const franchise = FRANCHISE[r.team_abbr] ?? r.team_abbr
    const [conference, division] = r.team_division.split(' ') as [Conference, Division]
    return {
      abbr: r.team_abbr,
      franchise,
      name: r.team_name,
      conference: (r.team_conf || conference) as Conference,
      division,
      color: r.team_color,
      color2: r.team_color2,
      logo: `/nfl/${franchise}.png`,
    }
  })
}
```

- [ ] **Skref 5: Keyra og sjá standast**

Run: `npx vitest run test/nfl-csv.test.ts`
Expected: PASS. Ef 2025-fjöldinn er annar en 285 er það raunverulegur fjöldi í skránni sem ræður: athuga með `grep -c '^2025_'` og leiðrétta prófið, ekki kóðann.

- [ ] **Skref 6: Commit**

```bash
git add web/src/lib/nfl/csv.ts web/test/nfl-csv.test.ts web/test/fixtures/nfl-2025.csv web/test/fixtures/nfl-teams.csv
git commit -m "NFL: read the nflverse games and teams files"
```

---

### Verk 3: Val á viku og heiti umferða

**Files:**
- Create: `web/src/lib/nfl/week.ts`
- Test: `web/test/nfl-week.test.ts`

- [ ] **Skref 1: Skrifa prófið**

```ts
import { describe, it, expect } from 'vitest'
import { defaultWeek, weekLabel, weekTypes } from '../src/lib/nfl/week'
import type { NflGame } from '../src/lib/nfl/types'

const g = (week: number, kickoff: string, played: boolean, game_type: NflGame['game_type'] = 'REG') =>
  ({ week, kickoff, game_type, home_score: played ? 20 : null, away_score: played ? 17 : null }) as NflGame

const season = [
  g(1, '2026-09-10T00:20:00.000Z', true),
  g(1, '2026-09-13T17:00:00.000Z', true),
  g(2, '2026-09-17T00:15:00.000Z', true),
  g(2, '2026-09-20T17:00:00.000Z', false),
  g(3, '2026-09-27T17:00:00.000Z', false),
]

describe('defaultWeek', () => {
  it('fyrir tímabil: vika 1', () => {
    expect(defaultWeek(season.map((x) => ({ ...x, home_score: null, away_score: null })), new Date('2026-08-01'))).toBe(1)
  })
  it('í miðri viku: vikan með næsta óspilaða leik', () => {
    expect(defaultWeek(season, new Date('2026-09-18T12:00:00Z'))).toBe(2)
  })
  it('gamall leikur án úrslita festir ekki vikuna', () => {
    expect(defaultWeek(season, new Date('2026-09-25T12:00:00Z'))).toBe(3)
  })
  it('eftir síðasta leik: síðasta spilaða vikan', () => {
    const done = season.map((x) => ({ ...x, home_score: 1, away_score: 0 }))
    expect(defaultWeek(done, new Date('2026-12-01'))).toBe(3)
  })
  it('tómt tímabil: vika 1', () => {
    expect(defaultWeek([], new Date())).toBe(1)
  })
})

describe('weekLabel', () => {
  it('nefnir umferðir úrslitakeppninnar eftir tegund, ekki númeri', () => {
    expect(weekLabel('REG', 6)).toBe('Vika 6')
    expect(weekLabel('WC', 19)).toBe('Umspil')
    expect(weekLabel('DIV', 20)).toBe('8 liða úrslit')
    expect(weekLabel('CON', 21)).toBe('Undanúrslit')
    expect(weekLabel('SB', 22)).toBe('Super Bowl')
  })
  it('weekTypes raðar vikum og les tegundina úr leikjunum', () => {
    expect(weekTypes([g(19, 'x', true, 'WC'), g(1, 'y', true)])).toEqual([[1, 'REG'], [19, 'WC']])
  })
})
```

- [ ] **Skref 2: Keyra og sjá falla**

Run: `npx vitest run test/nfl-week.test.ts`
Expected: FAIL, module not found

- [ ] **Skref 3: Útfæra `web/src/lib/nfl/week.ts`**

```ts
import { isPlayed, type GameType, type NflGame } from './types'

/** A game without a score this long after kickoff is a data hole, not "this week". */
const STALE_MS = 18 * 3600 * 1000

const PLAYOFF_LABEL: Record<Exclude<GameType, 'REG'>, string> = {
  WC: 'Umspil',
  DIV: '8 liða úrslit',
  CON: 'Undanúrslit',
  SB: 'Super Bowl',
}

// Playoff week numbers moved when the season grew to 17 games, so name rounds by type.
export const weekLabel = (type: GameType, week: number) => (type === 'REG' ? `Vika ${week}` : PLAYOFF_LABEL[type])

export function weekTypes(games: Pick<NflGame, 'week' | 'game_type'>[]): [number, GameType][] {
  const m = new Map<number, GameType>()
  for (const g of games) m.set(g.week, g.game_type)
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

export function defaultWeek(games: Pick<NflGame, 'week' | 'kickoff' | 'home_score' | 'away_score'>[], now: Date): number {
  const cutoff = now.getTime() - STALE_MS
  const next = games
    .filter((g) => !isPlayed(g) && new Date(g.kickoff).getTime() >= cutoff)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
  if (next) return next.week
  const played = games.filter(isPlayed).map((g) => g.week)
  return played.length ? Math.max(...played) : 1
}
```

- [ ] **Skref 4: Keyra og sjá standast**

Run: `npx vitest run test/nfl-week.test.ts`
Expected: PASS (7 próf)

- [ ] **Skref 5: Commit**

```bash
git add web/src/lib/nfl/week.ts web/test/nfl-week.test.ts
git commit -m "NFL: pick the week to open on and name playoff rounds"
```

---

### Verk 4: Staðan og röðunarreglur

**Files:**
- Create: `web/src/lib/nfl/standings.ts`
- Test: `web/test/nfl-standings.test.ts`

Einfölduð röð viðmiða: sigurhlutfall → innbyrðis viðureignir (aðeins ef allir í hópnum hafa mæst) → árangur í riðli (aðeins ef allir eru í sama riðli) → árangur í deild → stigamismunur → stafróf. Þegar viðmið skiptir hópnum hefst hver undirhópur aftur á fyrsta viðmiði.

- [ ] **Skref 1: Skrifa prófið (tilbúin dæmi + mæling á 2025)**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeStandings, pct } from '../src/lib/nfl/standings'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import type { NflGame, NflTeam } from '../src/lib/nfl/types'

const team = (abbr: string, division: NflTeam['division'] = 'East', conference: NflTeam['conference'] = 'AFC') =>
  ({ abbr, franchise: abbr, name: abbr, conference, division, color: '', color2: '', logo: '' }) as NflTeam
let n = 0
const game = (home: string, hs: number, away: string, as: number) =>
  ({ game_id: `g${n++}`, game_type: 'REG', week: 1, kickoff: `2026-09-${String(10 + (n % 18)).padStart(2, '0')}T17:00:00.000Z`, home, away, home_score: hs, away_score: as }) as NflGame

describe('pct', () => {
  it('jafntefli er hálfur sigur', () => {
    expect(pct({ w: 1, l: 0, t: 1 })).toBe(0.75)
    expect(pct({ w: 0, l: 0, t: 0 })).toBe(0)
  })
})

describe('tilbúin dæmi', () => {
  const east = ['A', 'B', 'C', 'D'].map((a) => team(a))
  const others = ['E', 'F', 'G', 'H'].map((a) => team(a, 'North'))
  const teams = [...east, ...others]

  it('innbyrðis viðureignir ráða milli tveggja jafnra liða', () => {
    const s = computeStandings([game('A', 10, 'B', 20), game('A', 30, 'E', 0), game('B', 0, 'F', 3)], teams)
    const div = s.divisions.AFC.East.map((r) => [r.abbr, r.reason])
    expect(div.slice(0, 2)).toEqual([['B', 'h2h'], ['A', 'h2h']])
  })

  it('stigamismunur þegar liðin hafa ekki mæst og allt annað er jafnt', () => {
    const s = computeStandings([game('A', 30, 'E', 0), game('B', 10, 'F', 0)], teams)
    expect(s.divisions.AFC.East.slice(0, 2).map((r) => [r.abbr, r.reason])).toEqual([['A', 'diff'], ['B', 'diff']])
  })

  it('stafróf þegar ekkert skilur á milli', () => {
    const s = computeStandings([], teams)
    expect(s.divisions.AFC.East.map((r) => r.abbr)).toEqual(['A', 'B', 'C', 'D'])
    expect(s.divisions.AFC.East[0].reason).toBe('alpha')
  })

  it('þrjú jöfn lið: eitt skilur sig frá, hin tvö byrja aftur á fyrsta viðmiði', () => {
    // A, B, C all 2-1-1. Inside the group A is 2-0, B and C drew each other.
    // B and C restart as a pair: drew head-to-head, same division and conference
    // records, so points difference decides (B +20, C +10).
    const games = [
      game('A', 10, 'B', 0), game('A', 10, 'C', 0), game('B', 10, 'C', 10),
      game('E', 10, 'A', 0), game('A', 3, 'F', 3),
      game('B', 10, 'G', 0), game('B', 20, 'H', 0), game('C', 10, 'G', 0), game('C', 10, 'H', 0),
    ]
    const s = computeStandings(games, teams)
    expect(s.divisions.AFC.East.slice(0, 3).map((r) => [r.abbr, r.reason])).toEqual([['A', 'h2h'], ['B', 'diff'], ['C', 'diff']])
    expect(s.records.A).toMatchObject({ w: 2, l: 1, t: 1, div: { w: 2, l: 0, t: 0 } })
  })

  it('runa les síðustu leiki', () => {
    const s = computeStandings([game('A', 10, 'B', 0), game('A', 10, 'C', 0), game('D', 10, 'A', 0)], teams)
    expect(s.records.A.streak).toBe('T1')
    expect(s.records.B.streak).toBe('T1')
  })
})

describe('mæling: lokastaða 2025 gegn úrslitakeppninni sjálfri', () => {
  const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
  const games = parseGames(fx('nfl-2025.csv'))
  const teams = parseTeams(fx('nfl-teams.csv')).filter((t) => t.franchise === t.abbr)
  const s = computeStandings(games.filter((g) => g.game_type === 'REG'), teams)
  const wc = games.filter((g) => g.game_type === 'WC')
  const div = games.filter((g) => g.game_type === 'DIV')

  for (const conf of ['AFC', 'NFC'] as const) {
    it(`${conf}: sömu sjö lið og í raun komust áfram`, () => {
      const confTeams = new Set(teams.filter((t) => t.conference === conf).map((t) => t.abbr))
      const inWc = wc.flatMap((g) => [g.home, g.away]).filter((a) => confTeams.has(a))
      const bye = div.map((g) => g.home).filter((a) => confTeams.has(a) && !inWc.includes(a))
      expect(bye).toHaveLength(1)
      const actual = new Set([...inWc, ...bye])
      const ours = s.seeds[conf].slice(0, 7).map((r) => r.abbr)
      expect(new Set(ours)).toEqual(actual)
      // seed 1 had the bye; each wild-card game paired seeds summing to 9, the better seed at home
      expect(ours[0]).toBe(bye[0])
      for (const g of wc.filter((x) => confTeams.has(x.home))) {
        const h = ours.indexOf(g.home) + 1
        const a = ours.indexOf(g.away) + 1
        expect([g.home, h, g.away, a, h + a]).toEqual([g.home, h, g.away, a, 9])
        expect(h).toBeLessThan(a)
      }
    })
  }
})
```

Ef mælingin fellur vegna einföldunar (t.d. ósigrað jafnteflisviðmið NFL sem við notum ekki) er prófinu breytt í að festa það frávik með `it.fails` og skýringu, og frávikið skráð í hvelfinguna og neðst á stöðusíðunni. Ekki laga kóðann að einu tímabili.

- [ ] **Skref 2: Keyra og sjá falla**

Run: `npx vitest run test/nfl-standings.test.ts`
Expected: FAIL, module not found

- [ ] **Skref 3: Útfæra `web/src/lib/nfl/standings.ts`**

```ts
import { CONFERENCES, DIVISIONS, isPlayed, type Conference, type Division, type NflGame, type NflTeam } from './types'

export type Criterion = 'h2h' | 'division' | 'conference' | 'diff' | 'alpha'

export interface WLT { w: number; l: number; t: number }
export interface TeamRecord extends WLT {
  abbr: string
  pf: number
  pa: number
  div: WLT
  conf: WLT
  /** "S3" = three wins in a row, "T1", "J1"; empty before the first game. */
  streak: string
}
export interface Ranked { abbr: string; reason: Criterion | null }
export interface Standings {
  records: Record<string, TeamRecord>
  divisions: Record<Conference, Record<Division, Ranked[]>>
  /** All 16 per conference; the first seven are the playoff seeds. */
  seeds: Record<Conference, Ranked[]>
}

export const pct = (r: WLT) => {
  const n = r.w + r.l + r.t
  return n ? (r.w + r.t / 2) / n : 0
}
// equal records must compare equal, whatever the float path
const key = (x: number) => Math.round(x * 1e9)

const blank = (): WLT => ({ w: 0, l: 0, t: 0 })
const add = (r: WLT, res: 'S' | 'T' | 'J') => { if (res === 'S') r.w++; else if (res === 'T') r.l++; else r.t++ }

/** Standings from regular-season games. Unplayed games are ignored. */
export function computeStandings(games: NflGame[], teams: NflTeam[]): Standings {
  const info = new Map(teams.map((t) => [t.abbr, t]))
  const records: Record<string, TeamRecord> = {}
  for (const t of teams) records[t.abbr] = { abbr: t.abbr, ...blank(), pf: 0, pa: 0, div: blank(), conf: blank(), streak: '' }

  const played = games.filter((g) => g.game_type === 'REG' && isPlayed(g)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const results = new Map<string, ('S' | 'T' | 'J')[]>()
  for (const g of played) {
    const sides: [string, string, number, number][] = [
      [g.home, g.away, g.home_score!, g.away_score!],
      [g.away, g.home, g.away_score!, g.home_score!],
    ]
    for (const [me, opp, own, other] of sides) {
      const r = records[me]
      const a = info.get(me)
      const b = info.get(opp)
      if (!r || !a || !b) continue
      const res = own > other ? 'S' : own < other ? 'T' : 'J'
      add(r, res)
      r.pf += own
      r.pa += other
      if (a.conference === b.conference) {
        add(r.conf, res)
        if (a.division === b.division) add(r.div, res)
      }
      results.set(me, [...(results.get(me) ?? []), res])
    }
  }
  for (const [abbr, rs] of results) {
    const last = rs[rs.length - 1]
    let k = 0
    for (let i = rs.length - 1; i >= 0 && rs[i] === last; i--) k++
    records[abbr].streak = `${last}${k}`
  }

  const metAll = (group: string[]) =>
    group.every((a) => group.every((b) => a === b || played.some((g) => (g.home === a && g.away === b) || (g.home === b && g.away === a))))
  const h2h = (abbr: string, group: string[]) => {
    const r = blank()
    for (const g of played) {
      if (g.home === abbr && group.includes(g.away)) add(r, g.home_score! > g.away_score! ? 'S' : g.home_score! < g.away_score! ? 'T' : 'J')
      if (g.away === abbr && group.includes(g.home)) add(r, g.away_score! > g.home_score! ? 'S' : g.away_score! < g.home_score! ? 'T' : 'J')
    }
    return pct(r)
  }

  function breakTie(group: string[]): Ranked[] {
    if (group.length === 1) return [{ abbr: group[0], reason: null }]
    const sameDivision = group.every((a) => info.get(a)!.division === info.get(group[0])!.division && info.get(a)!.conference === info.get(group[0])!.conference)
    const criteria: [Criterion, (a: string) => number][] = []
    if (metAll(group)) criteria.push(['h2h', (a) => h2h(a, group)])
    if (sameDivision) criteria.push(['division', (a) => pct(records[a].div)])
    criteria.push(['conference', (a) => pct(records[a].conf)])
    criteria.push(['diff', (a) => records[a].pf - records[a].pa])

    for (const [name, f] of criteria) {
      const vals = new Map(group.map((a) => [a, key(f(a))]))
      const tiers = [...new Set(vals.values())].sort((x, y) => y - x)
      if (tiers.length === 1) continue
      // each tier starts over from the first criterion, as the NFL does once a club drops out
      return tiers.flatMap((v) =>
        breakTie(group.filter((a) => vals.get(a) === v)).map((r) => ({ abbr: r.abbr, reason: r.reason ?? name })),
      )
    }
    return [...group].sort().map((abbr) => ({ abbr, reason: 'alpha' as const }))
  }

  function rank(set: string[]): Ranked[] {
    const tiers = [...new Set(set.map((a) => key(pct(records[a]))))].sort((x, y) => y - x)
    return tiers.flatMap((v) => breakTie(set.filter((a) => key(pct(records[a])) === v)))
  }

  const divisions = {} as Standings['divisions']
  const seeds = {} as Standings['seeds']
  for (const c of CONFERENCES) {
    divisions[c] = {} as Record<Division, Ranked[]>
    for (const d of DIVISIONS) divisions[c][d] = rank(teams.filter((t) => t.conference === c && t.division === d).map((t) => t.abbr))
    const winners = DIVISIONS.map((d) => divisions[c][d][0]?.abbr).filter(Boolean)
    const rest = teams.filter((t) => t.conference === c && !winners.includes(t.abbr)).map((t) => t.abbr)
    seeds[c] = [...rank(winners), ...rank(rest)]
  }
  return { records, divisions, seeds }
}
```

- [ ] **Skref 4: Keyra og sjá standast**

Run: `npx vitest run test/nfl-standings.test.ts`
Expected: PASS. Ef mælingin á 2025 fellur: sjá athugasemdina í skrefi 1.

- [ ] **Skref 5: Commit**

```bash
git add web/src/lib/nfl/standings.ts web/test/nfl-standings.test.ts
git commit -m "NFL: standings with simplified tiebreakers, checked against the 2025 playoff field"
```

---

### Verk 5: Snið

**Files:**
- Create: `web/src/lib/nfl/format.ts`
- Test: `web/test/nfl-format.test.ts`

- [ ] **Skref 1: Skrifa prófið**

```ts
import { describe, it, expect } from 'vitest'
import { spreadLabel, totalLabel, pctLabel, diffLabel, REASON_LABEL } from '../src/lib/nfl/format'

describe('NFL-snið', () => {
  it('forgjöf: jákvætt spread_line þýðir að heimaliðið er sigurstranglegra', () => {
    expect(spreadLabel({ home: 'DEN', away: 'SEA', spread_line: -2.5 })).toBe('SEA −2,5')
    expect(spreadLabel({ home: 'ATL', away: 'CHI', spread_line: 3 })).toBe('ATL −3')
    expect(spreadLabel({ home: 'A', away: 'B', spread_line: 0 })).toBe('Jafnt')
    expect(spreadLabel({ home: 'A', away: 'B', spread_line: null })).toBeNull()
  })
  it('heildarstig, hlutfall og mismunur með íslenskri kommu og alvöru mínus', () => {
    expect(totalLabel(40.5)).toBe('40,5')
    expect(pctLabel(2 / 3)).toBe('0,667')
    expect(diffLabel(12)).toBe('+12')
    expect(diffLabel(-7)).toBe('−7')
    expect(diffLabel(0)).toBe('0')
  })
  it('hvert viðmið hefur texta', () => {
    expect(REASON_LABEL.h2h).toBe('raðað eftir innbyrðis viðureignum')
    expect(Object.keys(REASON_LABEL).sort()).toEqual(['alpha', 'conference', 'diff', 'division', 'h2h'])
  })
})
```

- [ ] **Skref 2: Keyra og sjá falla**

Run: `npx vitest run test/nfl-format.test.ts`
Expected: FAIL, module not found

- [ ] **Skref 3: Útfæra `web/src/lib/nfl/format.ts`**

```ts
import type { Criterion } from './standings'
import type { NflGame } from './types'

// Formatted by hand: Node and the browser disagree on is-IS number output.
const dec = (n: number) => String(n).replace('.', ',')

/** nflverse spread_line is positive when the home side is favoured. */
export function spreadLabel(g: Pick<NflGame, 'home' | 'away' | 'spread_line'>): string | null {
  if (g.spread_line === null) return null
  if (g.spread_line === 0) return 'Jafnt'
  const fav = g.spread_line > 0 ? g.home : g.away
  return `${fav} −${dec(Math.abs(g.spread_line))}`
}

export const totalLabel = (t: number) => dec(t)
export const pctLabel = (p: number) => p.toFixed(3).replace('.', ',')
export const diffLabel = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

export const REASON_LABEL: Record<Criterion, string> = {
  h2h: 'raðað eftir innbyrðis viðureignum',
  division: 'raðað eftir árangri í riðli',
  conference: 'raðað eftir árangri í deild',
  diff: 'raðað eftir stigamismun',
  alpha: 'jafnt á öllu, raðað eftir stafrófi',
}
```

- [ ] **Skref 4: Keyra og sjá standast**

Run: `npx vitest run test/nfl-format.test.ts`
Expected: PASS

- [ ] **Skref 5: Commit**

```bash
git add web/src/lib/nfl/format.ts web/test/nfl-format.test.ts
git commit -m "NFL: Icelandic formatting for lines, percentages and tiebreak reasons"
```

---

### Verk 6: Migration

**Files:**
- Create: `supabase/migrations/005_nfl.sql`

- [ ] **Skref 1: Skrifa SQL**

```sql
-- NFL corner, part 1. Separate tables: the football pipeline (matches, Elo
-- pools, 1X2) does not fit American football and must not be mixed with it.

create table if not exists public.nfl_teams (
  abbr text primary key,
  franchise text not null,
  name text not null,
  conference text not null check (conference in ('AFC', 'NFC')),
  division text not null check (division in ('East', 'North', 'South', 'West')),
  color text,
  color2 text,
  logo text
);

create table if not exists public.nfl_games (
  game_id text primary key,
  season int not null,
  game_type text not null check (game_type in ('REG', 'WC', 'DIV', 'CON', 'SB')),
  week int not null,
  kickoff timestamptz not null,
  time_tbd boolean not null default false,
  away text not null references public.nfl_teams (abbr),
  home text not null references public.nfl_teams (abbr),
  away_score int,
  home_score int,
  overtime boolean not null default false,
  neutral boolean not null default false,
  spread_line numeric,
  total_line numeric,
  away_ml int,
  home_ml int,
  div_game boolean not null default false,
  stadium text,
  roof text,
  away_qb text,
  home_qb text,
  updated_at timestamptz not null default now()
);
create index if not exists nfl_games_season_week on public.nfl_games (season, week);

alter table public.nfl_teams enable row level security;
alter table public.nfl_games enable row level security;
create policy "public read" on public.nfl_teams for select using (true);
create policy "public read" on public.nfl_games for select using (true);

create or replace function public.rpc_upsert_nfl_teams(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_teams (abbr, franchise, name, conference, division, color, color2, logo)
  select r->>'abbr', r->>'franchise', r->>'name', r->>'conference', r->>'division',
         r->>'color', r->>'color2', r->>'logo'
  from jsonb_array_elements(p_rows) r
  on conflict (abbr) do update set
    franchise = excluded.franchise, name = excluded.name, conference = excluded.conference,
    division = excluded.division, color = excluded.color, color2 = excluded.color2, logo = excluded.logo;
  get diagnostics n = row_count;
  return n;
end $$;

-- A score once recorded is never blanked by a later feed row (Gildrur 5);
-- closing lines likewise survive a feed that drops them after kickoff.
create or replace function public.rpc_upsert_nfl_games(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_games as g (
    game_id, season, game_type, week, kickoff, time_tbd, away, home, away_score, home_score,
    overtime, neutral, spread_line, total_line, away_ml, home_ml, div_game, stadium, roof,
    away_qb, home_qb, updated_at)
  select r->>'game_id', (r->>'season')::int, r->>'game_type', (r->>'week')::int,
         (r->>'kickoff')::timestamptz, (r->>'time_tbd')::boolean, r->>'away', r->>'home',
         (r->>'away_score')::int, (r->>'home_score')::int, (r->>'overtime')::boolean,
         (r->>'neutral')::boolean, (r->>'spread_line')::numeric, (r->>'total_line')::numeric,
         (r->>'away_ml')::int, (r->>'home_ml')::int, (r->>'div_game')::boolean,
         r->>'stadium', r->>'roof', r->>'away_qb', r->>'home_qb', now()
  from jsonb_array_elements(p_rows) r
  on conflict (game_id) do update set
    season = excluded.season, game_type = excluded.game_type, week = excluded.week,
    kickoff = excluded.kickoff, time_tbd = excluded.time_tbd,
    away = excluded.away, home = excluded.home,
    away_score = coalesce(excluded.away_score, g.away_score),
    home_score = coalesce(excluded.home_score, g.home_score),
    overtime = excluded.overtime or g.overtime, neutral = excluded.neutral,
    spread_line = coalesce(excluded.spread_line, g.spread_line),
    total_line = coalesce(excluded.total_line, g.total_line),
    away_ml = coalesce(excluded.away_ml, g.away_ml),
    home_ml = coalesce(excluded.home_ml, g.home_ml),
    div_game = excluded.div_game, stadium = excluded.stadium, roof = excluded.roof,
    away_qb = coalesce(excluded.away_qb, g.away_qb), home_qb = coalesce(excluded.home_qb, g.home_qb),
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
```

- [ ] **Skref 2: Setja upp í Supabase**

Gegnum Supabase MCP `apply_migration` (project `imzqngcwykvqxzylhujf`, name `nfl_foundation`, query = skráin hér að ofan). Töflurnar eru nýjar og vefurinn í loftinu les þær ekki, svo þetta hefur engin áhrif á hann.

- [ ] **Skref 3: Staðfesta**

`execute_sql`: `select count(*) from public.nfl_teams;` → `0`, og `get_advisors` (security) sýnir engar nýjar viðvaranir um `nfl_*`.

- [ ] **Skref 4: Commit**

```bash
git add supabase/migrations/005_nfl.sql
git commit -m "NFL: tables and secret-guarded upsert RPCs"
```

---

### Verk 7: Innlestur, viðvaranir og lestur

**Files:**
- Create: `web/src/lib/nfl/ingest.ts`, `web/src/lib/nfl/queries.ts`, `web/scripts/ingest-nfl.mts`
- Test: `web/test/nfl-ingest.test.ts`

- [ ] **Skref 1: Skrifa prófið fyrir hreina hlutann (viðvaranir)**

```ts
import { describe, it, expect } from 'vitest'
import { ingestWarnings } from '../src/lib/nfl/ingest'
import type { NflGame } from '../src/lib/nfl/types'

const g = (id: string, kickoff: string, scored: boolean, home = 'A', away = 'B') =>
  ({ game_id: id, game_type: 'REG', kickoff, home, away, home_score: scored ? 1 : null, away_score: scored ? 0 : null }) as NflGame

describe('ingestWarnings', () => {
  const now = new Date('2026-10-14T12:00:00Z')
  it('varar við leik án úrslita 18 klst eftir upphaf', () => {
    const w = ingestWarnings([g('x', '2026-10-13T17:00:00Z', false), g('y', '2026-10-14T00:00:00Z', false)], now, 2)
    expect(w).toEqual(['x: engin úrslit 19 klst eftir upphaf'])
  })
  it('varar ef liðafjöldi tímabilsins er rangur', () => {
    expect(ingestWarnings([g('x', '2026-10-20T17:00:00Z', false)], now)).toEqual(['tímabilið hefur 2 lið, ekki 32'])
  })
})
```

- [ ] **Skref 2: Keyra og sjá falla**

Run: `npx vitest run test/nfl-ingest.test.ts`
Expected: FAIL, module not found

- [ ] **Skref 3: Útfæra `web/src/lib/nfl/ingest.ts`**

```ts
import { db } from '../db'
import { parseGames, parseTeams } from './csv'
import { isPlayed, type NflGame } from './types'

export const GAMES_URL = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'
export const TEAMS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv'
const SECRET = () => process.env.CRON_SECRET!
const BATCH = 500
const STALE_HOURS = 18

export interface NflIngestResult { season: number; games: number; newResults: number; warnings: string[] }

/** The KSÍ scraper once reported newMatches: 0 for six weeks without a word, so say what looks wrong. */
export function ingestWarnings(season: NflGame[], now: Date, expectedTeams = 32): string[] {
  const out: string[] = []
  for (const g of season) {
    const hours = Math.floor((now.getTime() - new Date(g.kickoff).getTime()) / 3600_000)
    if (!isPlayed(g) && hours >= STALE_HOURS) out.push(`${g.game_id}: engin úrslit ${hours} klst eftir upphaf`)
  }
  const teams = new Set(season.filter((g) => g.game_type === 'REG').flatMap((g) => [g.home, g.away])).size
  if (teams !== expectedTeams) out.push(`tímabilið hefur ${teams} lið, ekki ${expectedTeams}`)
  return out
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`nflverse svaraði ${res.status}: ${url}`)
  return res.text()
}

async function call(fn: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db().rpc(fn, { p_secret: SECRET(), p_rows: rows.slice(i, i + BATCH) })
    if (error) throw new Error(`${fn}: ${error.message}`)
  }
}

async function scoredIds(season: number): Promise<Set<string>> {
  const { data, error } = await db()
    .from('nfl_games').select('game_id').eq('season', season).not('home_score', 'is', null).range(0, 999)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.game_id as string))
}

/** Pull nflverse and write it. `all` loads every season since 1999 (one-off backfill). */
export async function ingestNfl(opts: { all?: boolean; now?: Date } = {}): Promise<NflIngestResult> {
  const [gamesCsv, teamsCsv] = await Promise.all([fetchText(GAMES_URL), fetchText(TEAMS_URL)])
  const teams = parseTeams(teamsCsv)
  const games = parseGames(gamesCsv)

  // validate everything before writing anything
  const known = new Set(teams.map((t) => t.abbr))
  const unknown = [...new Set(games.flatMap((g) => [g.away, g.home]))].filter((a) => !known.has(a))
  if (unknown.length) throw new Error(`Óþekkt lið í nflverse: ${unknown.join(', ')}`)

  const season = Math.max(...games.map((g) => g.season))
  const current = games.filter((g) => g.season === season)
  const rows = opts.all ? games : current
  const before = await scoredIds(season)

  await call('rpc_upsert_nfl_teams', teams)
  await call('rpc_upsert_nfl_games', rows)

  return {
    season,
    games: rows.length,
    newResults: current.filter((g) => isPlayed(g) && !before.has(g.game_id)).length,
    warnings: ingestWarnings(current, opts.now ?? new Date()),
  }
}
```

- [ ] **Skref 4: Útfæra `web/src/lib/nfl/queries.ts`**

```ts
import { db } from '../db'
import type { NflGame, NflTeam } from './types'

export async function nflTeams(): Promise<NflTeam[]> {
  const { data, error } = await db().from('nfl_teams').select('*').range(0, 999)
  if (error) throw error
  return (data ?? []) as NflTeam[]
}

export async function nflCurrentSeason(): Promise<number | null> {
  const { data, error } = await db().from('nfl_games').select('season').order('season', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0]?.season ?? null
}

/** One season, paged anyway: an unpaged read stops at 1,000 rows without a word (Gildrur 1). */
export async function nflSeasonGames(season: number): Promise<NflGame[]> {
  const out: NflGame[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('nfl_games').select('*').eq('season', season).order('kickoff').order('game_id').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as NflGame[]).map((g) => ({
      ...g,
      spread_line: g.spread_line === null ? null : Number(g.spread_line),
      total_line: g.total_line === null ? null : Number(g.total_line),
    })))
    if (!data || data.length < 1000) return out
  }
}
```

- [ ] **Skref 5: Útfæra `web/scripts/ingest-nfl.mts`**

```ts
/**
 * Load NFL games from nflverse - same code path as /api/cron/nfl.
 * Usage: cd web && npx tsx scripts/ingest-nfl.mts [--all]
 *   --all  every season since 1999 (one-off backfill for the Elo in part 2)
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const t0 = Date.now()
const { ingestNfl } = await import(join(webDir, 'src/lib/nfl/ingest.ts'))
console.log(JSON.stringify(await ingestNfl({ all: process.argv.includes('--all') }), null, 2))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
```

- [ ] **Skref 6: Keyra prófin, svo backfill**

Run: `npx vitest run test/nfl-ingest.test.ts` → PASS
Run: `npx tsx scripts/ingest-nfl.mts --all`
Expected: `season: 2026`, `games` um 7.300, `newResults: 79` (eða fleiri), `warnings: []`.

Staðfesta með `execute_sql`:
```sql
select season, count(*), count(home_score) from public.nfl_games group by season order by season desc limit 3;
```
Expected: 2026 → 272 leikir, 79+ með úrslit; 2025 → 285/285.

Keyra aftur `npx tsx scripts/ingest-nfl.mts` → `newResults: 0` (endurkeyrsla breytir engu).

- [ ] **Skref 7: Commit**

```bash
git add web/src/lib/nfl/ingest.ts web/src/lib/nfl/queries.ts web/scripts/ingest-nfl.mts web/test/nfl-ingest.test.ts
git commit -m "NFL: ingest from nflverse with warnings, and season reads"
```

---

### Verk 8: Merki liðanna

**Files:**
- Create: `web/scripts/fetch-nfl-logos.mts`, `web/public/nfl/*.png`

- [ ] **Skref 1: Skrifa skriftuna**

```ts
/**
 * Save the 32 club logos into public/nfl/ so the site never depends on a
 * third-party image host (comet.ksi.is died under us, Gildrur 26).
 * Usage: cd web && npx tsx scripts/fetch-nfl-logos.mts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseCsv } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { FRANCHISE } = await import(join(webDir, 'src/lib/nfl/types.ts'))
const csv = await (await fetch('https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv')).text()
const [head, ...rows] = parseCsv(csv) as string[][]
const abbr = head.indexOf('team_abbr')
const logo = head.indexOf('team_logo_espn')
const out = join(webDir, 'public/nfl')
mkdirSync(out, { recursive: true })
let n = 0
for (const r of rows) {
  if (r.length < head.length || FRANCHISE[r[abbr]]) continue
  const res = await fetch(r[logo])
  if (!res.ok) throw new Error(`${r[abbr]}: ${res.status} ${r[logo]}`)
  writeFileSync(join(out, `${r[abbr]}.png`), Buffer.from(await res.arrayBuffer()))
  n++
}
console.log(`${n} merki vistuð í public/nfl/`)
```

- [ ] **Skref 2: Keyra**

Run: `npx tsx scripts/fetch-nfl-logos.mts && ls public/nfl | wc -l && du -sh public/nfl`
Expected: `32 merki vistuð`, 32 skrár. Ef stærðin fer yfir ~3 MB: minnka í 128 px með `sips -Z 128 public/nfl/*.png`.

- [ ] **Skref 3: Commit**

```bash
git add web/scripts/fetch-nfl-logos.mts web/public/nfl
git commit -m "NFL: self-hosted club logos"
```

---

### Verk 9: Cron-leið

**Files:**
- Create: `web/src/app/api/cron/nfl/route.ts`

- [ ] **Skref 1: Útfæra**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ingestNfl } from '@/lib/nfl/ingest'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Separate from /api/cron/ingest so a KSÍ failure cannot take NFL down, or the reverse.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') !== null
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await ingestNfl()
    revalidatePath('/nfl', 'layout')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, { status: 500 })
  }
}
```

`vercel.json` fær cron-inn ekki fyrr en í útgáfuverkinu (13).

- [ ] **Skref 2: Prófa á þróunarþjóni (eftir verk 10 þegar hann er ræstur)**

`curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:<port>/api/cron/nfl` → `{"ok":true,"season":2026,...,"warnings":[]}`; án hauss → 401.

- [ ] **Skref 3: Commit**

```bash
git add web/src/app/api/cron/nfl/route.ts
git commit -m "NFL: nightly cron route"
```

---

### Verk 10: Umgjörð, þema og valmynd

**Files:**
- Create: `web/src/app/nfl/layout.tsx`, `web/src/components/Nfl/NflSubnav.tsx`, `web/src/components/Nfl/NflLogo.tsx`
- Modify: `web/src/app/globals.css` (á eftir Lengjudeildar-þemanu, um línu 52), `web/src/components/Nav.tsx`

- [ ] **Skref 1: Þema í `globals.css`**, beint á eftir `[data-league='lengjudeild']`-reglunum:

```css
/* NFL corner: its own red, set on the /nfl layout wrapper */
[data-league='nfl'] {
  --accent: #ef4a4f;
  --accent-ink: #1c0405;
  --glow: rgba(239, 74, 79, 0.07);
}
:root:not(.dark) [data-league='nfl'] {
  --accent: #c62828;
  --accent-ink: #ffffff;
}
```

- [ ] **Skref 2: `web/src/components/Nfl/NflSubnav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/nfl', label: 'Vikan' },
  { href: '/nfl/stada', label: 'Staðan' },
]

export function NflSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="NFL" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className="rounded-full px-4 min-h-[36px] inline-flex items-center font-semibold"
            style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Skref 3: `web/src/components/Nfl/NflLogo.tsx`**

```tsx
import type { NflTeam } from '@/lib/nfl/types'

export function NflLogo({ team, size = 24 }: { team: NflTeam | undefined; size?: number }) {
  if (!team) return <span style={{ width: size, height: size }} className="inline-block" aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element -- static local PNGs, no optimisation needed
  return <img src={team.logo} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
}
```

- [ ] **Skref 4: `web/src/app/nfl/layout.tsx`**

```tsx
import { Database } from 'lucide-react'
import { NflSubnav } from '@/components/Nfl/NflSubnav'

export const metadata = {
  title: 'NFL - Besta spáin',
  description: 'Leikir vikunnar, úrslit og staðan í NFL, á íslenskum tíma.',
}

export default function NflLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-league="nfl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="display text-3xl font-extrabold tracking-tight">
          NFL <span style={{ color: 'var(--accent)' }}>·</span>
        </h1>
        <NflSubnav />
      </div>
      {children}
      <p className="text-[11px] muted mt-10 inline-flex items-center gap-1.5">
        <Database size={11} aria-hidden /> Gögn: nflverse (nfldata). Tímar eru íslenskir.
      </p>
    </div>
  )
}
```

- [ ] **Skref 5: `Nav.tsx`**: bæta `{ href: '/nfl', label: 'NFL' }` í `NAV` á eftir `Leikir`, breyta `PRIMARY_NAV = NAV.slice(0, 8)` og `MORE_NAV = NAV.slice(8)`, og fela deildaskiptinn á `/nfl`:

```tsx
// desktop
{pathname.startsWith('/kort') ? <span className="text-[10px] muted whitespace-nowrap">Besta + Lengju · 2026</span> :
 pathname.startsWith('/nfl') ? null :
<LeagueSwitcher size="sm" />
}
// sími
{!pathname.startsWith('/kort') && !pathname.startsWith('/nfl') && <div className="md:hidden flex justify-center"><LeagueSwitcher size="sm" /></div>}
```

Ef átta atriði komast ekki fyrir á `lg` (1024 px) í preview: halda `slice(0, 7)`. Þá er NFL áfram í aðalröðinni (5. sæti) en Leikjaherbergið færist undir "Meira". Ákveða eftir skjáskot.

- [ ] **Skref 6: Commit**

```bash
git add web/src/app/globals.css web/src/components/Nav.tsx web/src/app/nfl/layout.tsx web/src/components/Nfl/NflSubnav.tsx web/src/components/Nfl/NflLogo.tsx
git commit -m "NFL: red corner layout, sub-navigation and a link in the main menu"
```

---

### Verk 11: Vikan (`/nfl`)

**Files:**
- Create: `web/src/app/nfl/page.tsx`, `web/src/components/Nfl/WeekView.tsx`

- [ ] **Skref 1: `web/src/app/nfl/page.tsx`**

```tsx
import { WeekView } from '@/components/Nfl/WeekView'
import { nflCurrentSeason, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

export default async function NflWeekPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [games, teams] = await Promise.all([nflSeasonGames(season), nflTeams()])
    return <WeekView season={season} games={games} teams={teams} initialWeek={defaultWeek(games, new Date())} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
```

- [ ] **Skref 2: `web/src/components/Nfl/WeekView.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NflLogo } from './NflLogo'
import { clock, dayKey, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { spreadLabel, totalLabel } from '@/lib/nfl/format'
import { weekLabel, weekTypes } from '@/lib/nfl/week'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'

export function WeekView({ season, games, teams, initialWeek }: { season: number; games: NflGame[]; teams: NflTeam[]; initialWeek: number }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const weeks = useMemo(() => weekTypes(games), [games])
  const [week, setWeek] = useState(initialWeek)

  // ?vika=6 makes a week shareable; read after mount so the page itself stays cacheable
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get('vika'))
    if (weeks.some(([w]) => w === v)) setWeek(v)
  }, [weeks])

  const go = (w: number) => {
    setWeek(w)
    const url = new URL(window.location.href)
    url.searchParams.set('vika', String(w))
    window.history.replaceState(null, '', url)
  }

  const idx = weeks.findIndex(([w]) => w === week)
  const type = weeks[idx]?.[1] ?? 'REG'
  const days = useMemo(() => {
    const m = new Map<string, NflGame[]>()
    for (const g of games.filter((x) => x.week === week)) m.set(dayKey(g.kickoff), [...(m.get(dayKey(g.kickoff)) ?? []), g])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [games, week])

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-5">
        <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
          disabled={idx <= 0} onClick={() => go(weeks[idx - 1][0])} aria-label="Fyrri vika">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="text-center">
          <p className="display text-2xl font-extrabold">{weekLabel(type, week)}</p>
          <p className="text-xs muted">Tímabilið {season}</p>
        </div>
        <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
          disabled={idx < 0 || idx >= weeks.length - 1} onClick={() => go(weeks[idx + 1][0])} aria-label="Næsta vika">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {days.length === 0 && <p className="muted">Engir leikir fundust.</p>}
      <div className="grid gap-6">
        {days.map(([key, list]) => (
          <div key={key}>
            <h2 className="text-sm font-semibold muted mb-2">{dayLabel(list[0].kickoff)}</h2>
            <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {list.map((g) => <GameRow key={g.game_id} g={g} home={byAbbr.get(g.home)} away={byAbbr.get(g.away)} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Side({ team, abbr, score, won }: { team: NflTeam | undefined; abbr: string; score: number | null; won: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NflLogo team={team} size={26} />
      <span className={`truncate ${won ? 'font-bold' : ''}`}>
        <span className="hidden sm:inline">{team?.name ?? abbr}</span>
        <span className="sm:hidden">{abbr}</span>
      </span>
      {score !== null && <span className={`ml-auto stat text-lg ${won ? '' : 'muted'}`}>{score}</span>}
    </div>
  )
}

function GameRow({ g, home, away }: { g: NflGame; home: NflTeam | undefined; away: NflTeam | undefined }) {
  const played = isPlayed(g)
  const spread = spreadLabel(g)
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="grid gap-1.5 min-w-0">
        <Side team={away} abbr={g.away} score={g.away_score} won={played && g.away_score! > g.home_score!} />
        <Side team={home} abbr={g.home} score={g.home_score} won={played && g.home_score! > g.away_score!} />
      </div>
      <div className="text-right text-xs muted grid content-center gap-0.5 num">
        {played ? (
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Lokið{g.overtime ? ' · framl.' : ''}</span>
        ) : g.time_tbd ? (
          <span>Tími óákveðinn</span>
        ) : (
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            {isSmallHours(g.kickoff) && <span className="muted font-normal">aðfaranótt </span>}
            {clock(g.kickoff)}
          </span>
        )}
        {!played && spread && <span>Forgjöf {spread}</span>}
        {!played && g.total_line !== null && <span>Heildarstig {totalLabel(g.total_line)}</span>}
        {g.neutral && g.stadium && <span>{g.stadium}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Skref 3: Ræsa þróunarþjón og skoða**

`preview_start` (launch.json í `/Users/elias/FH leikmenn./.claude/` ræsir alltaf "web" í aðalvinnutrénu, gildra 29). Því: keyra `npx next dev -p 3107` úr `nfl-wt/web` í bakgrunni og opna `http://localhost:3107/nfl` í vafraglugganum með `preview_start {url}`.

Athuga: Vika 6 opnast; SEA @ DEN undir "Föstudagur 16. október" með "aðfaranótt 00:15" og "Forgjöf SEA −2,5"; HOU @ JAX sýnir "Wembley Stadium"; ← fer í viku 5 með lokastöðum og feitletruðum sigurvegurum; `?vika=1` opnar viku 1. `read_console_messages` engar villur.

- [ ] **Skref 4: Commit**

```bash
git add web/src/app/nfl/page.tsx web/src/components/Nfl/WeekView.tsx
git commit -m "NFL: the week page with Icelandic kickoff times and lines"
```

---

### Verk 12: Staðan (`/nfl/stada`)

**Files:**
- Create: `web/src/app/nfl/stada/page.tsx`, `web/src/components/Nfl/StandingsView.tsx`

- [ ] **Skref 1: `web/src/app/nfl/stada/page.tsx`**

```tsx
import { StandingsView } from '@/components/Nfl/StandingsView'
import { nflCurrentSeason, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { computeStandings } from '@/lib/nfl/standings'

export const revalidate = 300
export const metadata = { title: 'Staðan í NFL - Besta spáin' }

export default async function NflStandingsPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const [games, all] = await Promise.all([nflSeasonGames(season), nflTeams()])
    const inSeason = new Set(games.flatMap((g) => [g.home, g.away]))
    const teams = all.filter((t) => inSeason.has(t.abbr))
    return <StandingsView season={season} standings={computeStandings(games, teams)} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
```

- [ ] **Skref 2: `web/src/components/Nfl/StandingsView.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { NflLogo } from './NflLogo'
import { diffLabel, pctLabel, REASON_LABEL } from '@/lib/nfl/format'
import { pct, type Ranked, type Standings, type WLT } from '@/lib/nfl/standings'
import { CONFERENCES, DIVISIONS, type NflTeam } from '@/lib/nfl/types'

type View = 'ridlar' | 'deild'
const DIV_NAME = { East: 'Austur', North: 'Norður', South: 'Suður', West: 'Vestur' } as const
const rec = (r: WLT) => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`)

export function StandingsView({ season, standings, teams }: { season: number; standings: Standings; teams: NflTeam[] }) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [view, setView] = useState<View>('ridlar')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('syn') === 'deild') setView('deild')
  }, [])
  const pick = (v: View) => {
    setView(v)
    const url = new URL(window.location.href)
    if (v === 'deild') url.searchParams.set('syn', 'deild'); else url.searchParams.delete('syn')
    window.history.replaceState(null, '', url)
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm muted">Deildarkeppnin {season}</p>
        <div role="tablist" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {(['ridlar', 'deild'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => pick(v)}
              className="rounded-full px-4 min-h-[36px] font-semibold"
              style={{ background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'var(--accent-ink)' : 'var(--text-2)' }}>
              {v === 'ridlar' ? 'Riðlar' : 'Deild'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {CONFERENCES.map((c) => (
          <div key={c} className="grid gap-4 content-start">
            <h2 className="display text-xl font-extrabold">{c}</h2>
            {view === 'ridlar'
              ? DIVISIONS.map((d) => (
                  <Table key={d} title={`${c} ${DIV_NAME[d]}`} rows={standings.divisions[c][d]} standings={standings} byAbbr={byAbbr} />
                ))
              : <Table title={`${c}: sæti`} rows={standings.seeds[c]} standings={standings} byAbbr={byAbbr} cutAfter={7} numbered />}
          </div>
        ))}
      </div>

      <p className="text-[11px] muted mt-6 leading-relaxed max-w-2xl">
        Lið með sama sigurhlutfall eru aðgreind í þessari röð: innbyrðis viðureignir, árangur í riðli, árangur í deild,
        stigamismunur. Þetta er einfölduð útgáfa af reglum NFL, sem nota fleiri viðmið (sameiginlega mótherja, styrk
        sigra og leikjadagskrár), svo röðin getur stöku sinnum vikið frá opinberu stöðunni.
      </p>
    </section>
  )
}

function Table({ title, rows, standings, byAbbr, cutAfter, numbered }: {
  title: string; rows: Ranked[]; standings: Standings; byAbbr: Map<string, NflTeam>; cutAfter?: number; numbered?: boolean
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="table-wrap">
        <table className="text-sm w-full [&_td]:px-1.5 [&_th]:px-1.5">
          <thead>
            <tr className="muted text-xs text-left">
              {numbered && <th className="w-6">#</th>}
              <th>Lið</th>
              <th className="text-right">S</th>
              <th className="text-right">T</th>
              <th className="text-right">J</th>
              <th className="text-right">Hlutf.</th>
              <th className="text-right hidden sm:table-cell">Skor.</th>
              <th className="text-right hidden sm:table-cell">Feng.</th>
              <th className="text-right">+/−</th>
              <th className="text-right hidden md:table-cell">Í riðli</th>
              <th className="text-right hidden md:table-cell">Runa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const r = standings.records[row.abbr]
              const team = byAbbr.get(row.abbr)
              const cut = cutAfter !== undefined && i === cutAfter
              return (
                <tr key={row.abbr} className="trow" style={cut ? { borderTop: '2px solid var(--accent)' } : undefined}>
                  {numbered && <td className="num muted">{i + 1}</td>}
                  <td className="py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <NflLogo team={team} size={20} />
                      <span className="font-semibold">{row.abbr}</span>
                      {row.reason && (
                        <span className="text-[10px] muted hidden sm:inline" title={REASON_LABEL[row.reason]}>
                          {REASON_LABEL[row.reason]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-right num">{r.w}</td>
                  <td className="text-right num">{r.l}</td>
                  <td className="text-right num">{r.t}</td>
                  <td className="text-right num font-semibold">{pctLabel(pct(r))}</td>
                  <td className="text-right num hidden sm:table-cell">{r.pf}</td>
                  <td className="text-right num hidden sm:table-cell">{r.pa}</td>
                  <td className="text-right num">{diffLabel(r.pf - r.pa)}</td>
                  <td className="text-right num hidden md:table-cell">{rec(r.div)}</td>
                  <td className="text-right num hidden md:table-cell">{r.streak}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Á síma (undir `sm`) er ástæðutextinn falinn til að taflan haldist læsileg; hann er áfram í `title`. Endurmeta eftir skjáskot í 375 px.

- [ ] **Skref 3: Skoða í preview**

`/nfl/stada`: átta riðlar með fjórum liðum, tölur passa við 79 spilaða leiki (summa sigra + jafntefli/2 yfir öll lið = fjöldi leikja). `?syn=deild`: sjö sæti og rauð lína undir 7. sæti. Prófa ljóst þema og 375 px breidd. `read_console_messages` engar villur.

- [ ] **Skref 4: Allt prófað + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: öll próf standast, engar gerðavillur, build tekst. (Gildra 31: ekki keyra `next build` meðan dev-þjónninn keyrir í sama vinnutré; stöðva hann fyrst.)

- [ ] **Skref 5: Commit**

```bash
git add web/src/app/nfl/stada/page.tsx web/src/components/Nfl/StandingsView.tsx
git commit -m "NFL: standings by division and conference seeding, with tiebreak reasons"
```

- [ ] **Skref 6: Elias skoðar localhost.** Bíða eftir áliti áður en verk 13 hefst.

---

### Verk 13: Útgáfa (aðeins eftir "full send" frá Elias)

- [ ] Athuga Vercel-áskrift (Hobby: einn dagur á milli keyrslna er í lagi).
- [ ] `web/vercel.json`: bæta `{ "path": "/api/cron/nfl", "schedule": "0 8 * * *" }` við `crons`.
- [ ] `git fetch && git log --oneline nfl..origin/main` tómt; annars sameina `origin/main` fyrst.
- [ ] `npx vitest run && npm run build`, `git status` hreint.
- [ ] `npx vercel deploy --prod --yes --scope eliasoli09s-projects` úr `nfl-wt/web`.
- [ ] Opna `https://islensk-fotbolti.vercel.app/nfl` og `/nfl/stada`, og athuga að `/leidin`, `/vallarleit` og `/` virki enn.
- [ ] Hvelfingin: `NFL/Yfirlit.md` (heimild, töflur, RPC, cron, frávik úr 2025-mælingunni) + lína í `START HÉR.md` + RPC-föllin í `Gagnagrunnur/RPC.md`.
- [ ] Push greinarinnar og sameining við `main`.
