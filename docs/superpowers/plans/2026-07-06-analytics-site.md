# Íslensk knattspyrnugreiningarsíða — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live analytics site for Besta deild karla — team & player Elo, transparent match predictions, Monte Carlo season odds, live scorer tables — on Supabase + Next.js/Vercel, auto-updating after each match via cron ingest from ksi.is.

**Architecture:** A new Supabase Postgres project holds matches/events/players scraped from KSÍ plus user-supplied SofaScore drops. All computation (Elo, Poisson predictions, Monte Carlo) lives in pure TypeScript modules inside the Next.js app; a cron-protected API route re-scrapes KSÍ, upserts new results, recomputes ratings/simulations into cache tables, and revalidates pages. Pages are server components reading Supabase.

**Tech Stack:** Supabase (Postgres 17), Next.js 15 App Router + TypeScript + Tailwind v4, recharts, next-themes, vitest. Deployed on Vercel (hobby: daily cron + manual refresh button).

**Key facts learned in recon (do not re-derive):**
- Results list: `ksi.is/oll-mot/mot?id=<tid>&banner-tab=matches-and-results&toggle=results&page=<n>`; upcoming: same without `toggle=results`. ~15 cards/page; stop when a page adds no new match ids.
- Card markup: home span `class="body-4 group-hover:underline text-right"`, away span without `text-right`, score span `class="body-4 whitespace-nowrap">H - A<`, match link `leikur?id=<id>`, venue span `class="body-5 overflow-hidden..."`, date headers like `Mán 6. júlí 19:15` precede cards.
- 2026 tournament ids: Besta `7025510` (+ Efri `7025527`, Neðri `7025532`), Lengjudeild `7025540` (Umspil `7025545`). Historical ids are in the seed data (already scraped).
- Match events on `ksi.is/leikir-og-urslit/felagslid/leikur?id=<id>`: blocks `<div class="match-event __ ..." data-event-id="...">` containing minute, icon div (yellow card = `bg-[#FAC83C]`; goal/red/sub markers to be pinned from samples in Task 7 — validation rule: parsed goals per match MUST equal the final score), and player link `/leikmenn/leikmadur?id=<pid>`. Side = presence of `flex-row-reverse` on the event wrapper (home) vs not (away). Note: `flex-row-reverse` appears both in the wrapper AND inside `match-event` div — match on the OUTER `col-span-3` div's class list.
- Teams without a crest render `<Name> Fullorðnir Karlar` — strip suffix.
- KSÍ 0-0 placeholder quirk: two corrections are baked into seed data; ingest must flag any future computed-vs-official table mismatch (store in `ingest_log`).
- Home advantage baseline from 1,968 matches 2019–25: home 1.810 g/g, away 1.483 g/g; H 44.6% / D 24.3% / A 31.1%.
- Besta deild format: 22 rounds, then split — Efri (top 6) & Neðri (bottom 6), 5 games each, points carry over. 2 teams relegated. Champion → UCL qualifiers; assume top 3 + cup = Europe, we report "Evrópusæti" = top 3 (documented approximation).
- Seed data lives in session scratchpad `matches.csv` (2019–25 both divisions, corrected) and `matches_2026.csv`; SofaScore drops in `data-drops/`.

**File structure (repo `icelandic-football-predictor/`):**
```
data/seed/                     # CSVs + sofascore JSON/xlsx (copied in Task 3)
scripts/gen_seed_sql.py        # one-time: CSVs → SQL insert files
web/                           # Next.js app
  src/lib/db.ts                # supabase server client (service key)
  src/lib/types.ts             # shared row/domain types
  src/lib/ksi.ts               # fetch+parse results/fixtures lists
  src/lib/ksiEvents.ts         # fetch+parse match events
  src/lib/elo.ts               # team Elo engine (pure)
  src/lib/playerElo.ts         # player Elo engine (pure)
  src/lib/predict.ts           # Poisson prediction + factor breakdown (pure)
  src/lib/simulate.ts          # Monte Carlo season + scorer races (pure)
  src/lib/recompute.ts         # orchestrates: read db → run engines → write cache tables
  src/app/api/cron/ingest/route.ts
  src/app/api/refresh/route.ts # manual trigger (secret)
  src/app/(site)/{page,elo,tafla,leikir,leikir/[id],leikmenn}/page.tsx
  src/components/*             # ProbBar, EloChart, PosHeatmap, FactorList, FormBadges, ThemeToggle
  vercel.json                  # cron
```

---

### Task 1: Supabase project

- [ ] Step 1: `mcp get_cost(type=project)` → `confirm_cost` → `create_project(name="islensk-fotbolti", region="eu-west-1")`. Wait until `status=ACTIVE_HEALTHY` (poll `get_project`).
- [ ] Step 2: `get_project_url` + `get_publishable_keys`; write `web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — service key via dashboard note if MCP can't emit it; fall back to anon key + RLS-open-read/service-write via `execute_sql` from MCP for seeding) and `.gitignore` it.
- [ ] Step 3: Commit docs note `docs/db.md` with project ref (no secrets).

### Task 2: Schema migration

- [ ] Step 1: `apply_migration` named `init_football` with:

```sql
create table teams (
  id serial primary key,
  name text unique not null,            -- KSÍ canonical, e.g. 'Víkingur R.'
  sofascore_name text,
  crest_url text
);
create table matches (
  id bigint primary key,                -- KSÍ leikur id
  season int not null,
  league text not null check (league in ('besta','lengjudeild')),
  phase text not null default 'main' check (phase in ('main','efri','nedri','umspil')),
  date timestamptz,
  venue text,
  home_team int references teams(id) not null,
  away_team int references teams(id) not null,
  home_goals int, away_goals int,       -- null = not played
  status text not null default 'played' check (status in ('played','upcoming')),
  corrected boolean not null default false,
  updated_at timestamptz not null default now()
);
create index on matches (season, league, status);
create table players (
  ksi_id bigint primary key,
  name text not null,
  team_id int references teams(id),
  position text
);
create table match_events (
  id bigint primary key,                -- data-event-id
  match_id bigint references matches(id) not null,
  minute int not null,
  type text not null check (type in ('goal','owngoal','penalty','yellow','red','sub_in','sub_out')),
  player_ksi_id bigint,
  player_name text not null,
  side text not null check (side in ('home','away'))
);
create index on match_events (match_id);
create table team_elo (
  team_id int references teams(id) not null,
  match_id bigint references matches(id) not null,
  date timestamptz not null,
  elo_before real not null, elo_after real not null,
  primary key (team_id, match_id)
);
create table player_elo (
  player_ksi_id bigint not null,
  match_id bigint references matches(id) not null,
  elo_before real not null, elo_after real not null,
  primary key (player_ksi_id, match_id)
);
create table sofascore_team_stats (
  team_id int references teams(id), season int, stats jsonb not null,
  loaded_at timestamptz default now(), primary key (team_id, season)
);
create table sofascore_players (
  season int not null, rank int, name text not null, team text,
  rating real, appearances int, goals int, assists int, extra jsonb,
  loaded_at timestamptz default now(), primary key (season, name)
);
create table predictions (
  match_id bigint primary key references matches(id),
  p_home real, p_draw real, p_away real,
  lambda_home real, lambda_away real,
  factors jsonb, computed_at timestamptz default now()
);
create table season_sim (
  season int, league text, team_id int references teams(id),
  pos_probs jsonb,                      -- {"1":0.42,...}
  p_title real, p_europe real, p_relegation real,
  run_at timestamptz default now(), primary key (season, league, team_id)
);
create table scorer_sim (
  season int, name text, kind text check (kind in ('goals','assists')),
  current int, projected real, p_win real,
  run_at timestamptz default now(), primary key (season, name, kind)
);
create table ingest_log (
  id bigserial primary key, run_at timestamptz default now(),
  new_matches int, new_events int, warnings jsonb
);
alter table teams enable row level security;  -- repeat for all tables
-- public read policies on every table:
-- create policy "public read" on <t> for select using (true);
```

- [ ] Step 2: Verify with `list_tables`. Commit migration SQL copy into `supabase/migrations/`.

### Task 3: Seed historical data

- [ ] Step 1: Copy scratchpad CSVs + `data-drops/*` into `data/seed/`.
- [ ] Step 2: Write `scripts/gen_seed_sql.py`: reads `matches.csv` (cols league,season,home,away,hg,ag — no dates) and `matches_2026.csv`; emits `teams.sql` (distinct names) and `matches_hist.sql`. Historical matches lack KSÍ ids/dates → synthesize ids `season*100000+rownum` negative-space-safe (use negative ids: `-(season*10000+n)`) and date = null; 2026 matches will be re-ingested with real ids in Task 8, so seed only 2019–25 from CSV. Phase from tournament of origin (main/efri/nedri as in scrape).
  - NOTE: scratchpad `matches.csv` has no phase column → regenerate it from `final_tables.py` pipeline with phase (5-minute edit, cached HTML, no re-fetch).
- [ ] Step 3: Load via MCP `execute_sql` in ≤500-row chunks. Verify: `select count(*) from matches` = 1968; spot check a couple of season tables with SQL group-by vs `final_tables.json`.
- [ ] Step 4: Load SofaScore: `sofascore_team_stats` (12 rows, stats=jsonb from JSON file) and `sofascore_players` (150 rows from xlsx via openpyxl in gen script). Name-map SofaScore team names → teams.id (mapping dict in script: 'Breidablik Kópavogur'→'Breiðablik', 'KR Reykjavík'→'KR', 'Víkingur Reykjavík'→'Víkingur R.', 'Stjarnan Garðabær'→'Stjarnan', 'Keflavík IF'→'Keflavík', 'ÍA Akranes'→'ÍA', 'KA Akureyri'→'KA', 'ÍBV Vestmannaeyjar'→'ÍBV', 'Fram Reykjavík'→'Fram', 'Þór Akureyri'→'Þór', 'FH Hafnarfjörður'→'FH', 'Valur Reykjavík'→'Valur').
- [ ] Step 5: Commit scripts + seed files.

### Task 4: Next.js scaffold

- [ ] Step 1: `cd web && npx create-next-app@latest . --ts --tailwind --app --src-dir --no-eslint --use-npm`; add deps `@supabase/supabase-js recharts next-themes`; dev deps `vitest`.
- [ ] Step 2: `src/lib/db.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
export const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } })
```

- [ ] Step 3: `npm run dev` boots; commit.

### Task 5: KSÍ list parser (`src/lib/ksi.ts`) — TDD

- [ ] Step 1: Vitest fixture: save one real results-page HTML into `web/test/fixtures/results_page.html` (curl during dev). Failing test: `parseMatchCards(html)` returns array with `{ksiId, home, away, homeGoals, awayGoals, dateText, venue}` incl. a played and an upcoming card, and strips `Fullorðnir Karlar`.
- [ ] Step 2: Implement with the recon regexes (split on `grid-cols-[1fr_auto_1fr]`; date header regex `/(Mán|Þri|Mið|Fim|Fös|Lau|Sun)\s+(\d{1,2})\.\s*(\w+)(?:\s+(\d{2}):(\d{2}))?/` carried forward card-to-card; Icelandic month map; year = season). Upcoming cards have `-` instead of score → `status:'upcoming'`.
- [ ] Step 3: `fetchTournamentMatches(tid, season, opts)` paginates both `toggle=results` and fixtures views, dedupes by ksiId. Tests green; commit.

### Task 6 (parallel-safe with 5): Elo engine (`src/lib/elo.ts`) — TDD

Model: start 1500 (Besta) / 1400 (Lengjudeild) at a team's first appearance; K=24; HFA=60 Elo pts; expected `E=1/(1+10^(-(Rh+HFA-Ra)/400))`; MOV multiplier `((|gd|+1)**0.8)/(7.5+0.006*max(0,winnerEloDiff))` (538-style); draws S=0.5.

- [ ] Step 1: Failing tests: equal teams home win → home gains ≈ K*mov*(1-E); draw vs stronger team gains points; ratings conserve sum (±float); 3-goal win moves more than 1-goal win.
- [ ] Step 2: Implement `runElo(matches: EloMatch[]): EloRecord[]` (chronological fold, matches without date use season+insertion order — stable). Export `currentRatings(records)`.
- [ ] Step 3: Green; commit.

### Task 7: Events parser (`src/lib/ksiEvents.ts`) — TDD

- [ ] Step 1: Save 3 fixture HTMLs (a match with goals+cards+subs; use 2026 played matches). Pin icon markup per type by inspecting fixtures (goal svg vs `bg-[#FAC83C]` yellow vs red vs sub arrows). Failing test asserts exact events of a known match (compare with KSÍ page manually) AND `goals(side=home) === homeGoals`.
- [ ] Step 2: Implement `parseEvents(html): MatchEvent[]` + `fetchMatchEvents(ksiId)`. Own-goal handling: KSÍ marks OG — count for opposite side; penalty separate icon; validation helper `validateEvents(events, match)` returns warnings.
- [ ] Step 3: Green; commit.

### Task 8: Ingest pipeline (`src/lib/recompute.ts` + `api/cron/ingest`)

- [ ] Step 1: `ingestSeason(season)`: for each current-season tournament id (config map incl. split + umspil), fetch matches, upsert teams+matches (real KSÍ ids); for played matches missing events → `fetchMatchEvents`, validate, upsert players (from player links) + events. Collect warnings into `ingest_log`.
- [ ] Step 2: `recomputeAll()`: load all matches → `runElo` → replace `team_elo`; run player Elo (Task 10) → `player_elo`; predictions for upcoming (Task 9) → `predictions`; sims (Task 11) → `season_sim`/`scorer_sim`. Single transaction per table (delete+insert).
- [ ] Step 3: `api/cron/ingest/route.ts`: GET, guard `authorization: Bearer ${CRON_SECRET}` OR `x-vercel-cron` header; runs ingest(2026)+recomputeAll+`revalidatePath('/', 'layout')`. `api/refresh/route.ts`: POST with secret, same body. `vercel.json`: `{"crons":[{"path":"/api/cron/ingest","schedule":"0 3 * * *"}]}`.
- [ ] Step 4: Run locally against prod DB: `curl localhost:3000/api/cron/ingest -H auth...`; verify matches=79 played + upcoming fixtures inserted with dates, events loaded, elo rows > 4000. Commit.

### Task 9: Prediction engine (`src/lib/predict.ts`) — TDD

λ from blended strengths: `eloFactor = 10^((Rh+HFA-Ra)/800)`; `attackH = teamGF/gm ÷ leagueAvg`, `defA = oppGA/gm ÷ leagueAvg` (current season, min 5 games else Elo-only); `λh = leagueHomeAvg * (0.5*eloFactor + 0.5*attackH*defA)`, symmetric for away with `10^(-(…)/800)`. Poisson matrix 0–9 → pH/pD/pA + top scorelines. Factors object: `{eloHome, eloAway, eloDiff, formHome (last5 'WDLWW'), formAway, gfH, gaH, gfA, gaA, h2h: {w,d,l, lastResults[]}, homeAdv: leagueHomeAvg/leagueAwayAvg}`.

- [ ] Step 1: Failing tests: symmetric teams → pH>pA (home adv); Keflavík–Fram regression test ≈ (0.27/0.20/0.53 ±0.05 with 2026-to-date data snapshot fixture); probabilities sum to 1.
- [ ] Step 2: Implement; green; commit.

### Task 10: Player Elo (`src/lib/playerElo.ts`) — TDD

Per played match, for each player appearing in events (scorers, carded, subs — the observable set): start 1500. Delta = `8*teamResult (1/0/-1 from player's side) + 25*goals + 12*assist? (n/a from KSÍ → skip) - 10*yellow - 30*red + 15*goal_in_win_context`, capped ±60; decay 0.98/matchweek idle. Merge SofaScore snapshot: display rating & assists next to Elo (not part of Elo math).

- [ ] Step 1: Failing tests: scorer in winning team gains > teammate carded in loss; red card net negative even in win.
- [ ] Step 2: Implement `runPlayerElo(matches, events)`; green; commit.

### Task 11: Monte Carlo (`src/lib/simulate.ts`) — TDD

- [ ] Step 1: `simulateSeason(state, N=10000)`: for each run — simulate remaining regular fixtures via predict λ + Poisson sampling; after round 22 build split groups from simulated table (top6/nedri6), generate single-round-robin fixtures (home team = better-ranked with prob 0.5 — scheduling unknown, documented), simulate; final table w/ carried points → tally position counts, title=1st, europe=top3, releg=bottom2. Deterministic seedable RNG (mulberry32) for tests.
- [ ] Step 2: `simulateScorerRace(players, remainingGamesPerTeam)`: per-player per-game Poisson rate from current goals/apps, sample remaining; also assists from SofaScore rates (flagged snapshot-based).
- [ ] Step 3: Tests: with one dominant team (Elo 1900 vs field 1400) p_title > 0.9; pos_probs rows sum to 1. Green; commit.

### Task 12: UI shell + theme

- [ ] Layout with Icelandic nav (Yfirlit, Elo, Tafla, Leikir, Leikmenn), `next-themes` dark/light toggle, FotMob-ish visual system (Tailwind tokens: dense data tables, tabular-nums, accent per section, no white-report look). Commit.

### Task 13: `/` Yfirlit

- [ ] Next fixtures with `ProbBar` (H/D/J percentages), biggest Elo movers this week, top-scorer mini table, last ingest stamp. Commit.

### Task 14: `/elo`

- [ ] Current Elo table (rank, team, Elo, ±last5 matches) + `EloChart` (recharts LineChart, team multi-toggle, full history from `team_elo`, season boundary reference lines). Commit.

### Task 15: `/tafla`

- [ ] Live standings (from played matches incl. split logic) + `PosHeatmap`: 12×12 grid team×position shaded by probability + columns Meistari/Evrópa/Fall (from `season_sim`). Commit.

### Task 16: `/leikir` + `/leikir/[id]`

- [ ] Round-grouped fixture/result list; match page shows prediction bar + `FactorList` (Elo diff, form badges, GF/GA, H2H record, home adv — the transparent "why"), top scorelines, and for played matches the event timeline. Commit.

### Task 17: `/leikmenn`

- [ ] Player Elo table (position filter if data), Markakóngar & Stoðsendingar tables with `p_win` columns from `scorer_sim`; SofaScore snapshot date label. Commit.

### Task 18: Deploy

- [ ] Push repo to GitHub (`gh repo create`), import to Vercel (user's Vercel MCP or `vercel` CLI), set env vars (SUPABASE url/keys, CRON_SECRET), deploy, run `/api/refresh`, smoke-test all pages on prod, add README (Icelandic) documenting architecture + how data flows + hobby-cron daily limitation + manual refresh. Commit.

---

**Self-review notes:** All spec features map to tasks (Elo→6/14, spár→9/16, player Elo→10/17, markakóngar→17, sætalíkur→11/15, auto-update→8, Vercel→18). Types defined in lib tasks are consumed by UI tasks by name. Known approximations documented: split-phase home/away scheduling, Europe=top3, assists snapshot-based, player Elo limited to event-observable players. Risk logged: KSÍ goal-icon classification pinned by fixture inspection in Task 7 with score-sum validation as the safety net.
