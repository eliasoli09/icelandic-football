# NFL-spáleikurinn: útfærsluáætlun

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spáleikur á `/nfl/spa` þar sem innskráðir notendur velja sigurvegara, keppa á viku- og tímabilstöflum og í einkadeildum, með líkanið sem keppanda.

**Architecture:** Notandinn skrifar eigin spár beint úr vafranum (Supabase Auth + RLS, eins og `game_result`); læsing við upphaf leiks og leynd spáa eru í RLS-stefnum. Deildir fara um security-definer RPC. Stigareikningur og töflur eru hrein föll í `lib/nfl/pickem.ts`; síðan er client component sem les gögnin sem innskráður notandi.

**Tech Stack:** Next 16, React 19, Supabase (Auth, RLS, plpgsql), vitest.

Spec: `docs/superpowers/specs/2026-10-16-nfl-spaleikur-design.md`. Úr `web/`: `npx vitest run test/<skrá>`, `npx tsc --noEmit`.

---

### Task 1: Hreinn reikningur (`lib/nfl/pickem.ts`)

**Files:** Create `web/src/lib/nfl/pickem.ts`; Test `web/test/nfl-pickem.test.ts`

```ts
export type PickGame = Pick<NflGame, 'game_id' | 'season' | 'week' | 'game_type' | 'kickoff' | 'home' | 'away' | 'home_score' | 'away_score'>
export interface Pick { player: string; game_id: string; pick: string }
export interface Tiebreak { player: string; season: number; week: number; total: number }
export interface BoardRow { id: string; name: string; points: number; picks: number; tiebreakOff: number | null; place: number; model?: true }
export const MODEL_ID = 'model'
export function pickPoints(pick: string, g: PickGame): number | null   // null = not played
export function modelPicks(games: PickGame[], pWin: Map<string, number>): Pick[]   // pWin key `${game_id}` = home p
export function lastGameOf(games: PickGame[], season: number, week: number): PickGame | null
export function weekBoard(games, picks, tiebreaks, names, season, week): BoardRow[]
export function seasonBoard(games, picks, names, season): BoardRow[]
export function pickWeek(games: PickGame[], now: Date): { season: number; week: number } | null
```
Röðun: stig niður; í viku svo `tiebreakOff` upp (null síðast, aðeins þegar síðasti leikur er spilaður); jafnir (sömu stig og sami munur) fá sama sæti. Líkanið fær `tiebreakOff: null`.

- [ ] Próf: rétt/rangt/jafntefli/óspilað; líkanið velur heimalið við p 0,6 og útilið við 0,4 (p = 0,5 → heimalið); bráðabani sker úr; jöfn sæti 1,1,3; `pickWeek` skilar fyrstu umferð með óhafinn leik og null eftir tímabilið; `lastGameOf` eftir upphafstíma.
- [ ] Útfæra, keyra, commit.

### Task 2: Gagnagrunnurinn (`supabase/migrations/011_nfl_pick.sql`)

- Töflur `nfl_pick`, `nfl_tiebreak`, `nfl_league`, `nfl_league_member` og stefnur eins og í spec 2.
- `is_nfl_league_member(uuid)`, `rpc_create_nfl_league(text)`, `rpc_join_nfl_league(text)` security definer, `set search_path = ''`, `auth.uid()` ekki null.
- Sýnin `nfl_pick_points` (security_invoker).
- `grant execute` á RPC til `authenticated` eingöngu (revoke frá `anon`/`public`).
- [ ] Beita sem migration `nfl_pick`.
- [ ] RLS-próf á lifandi grunni í einni færslu sem er afturkölluð (`begin; ... rollback;`) með tveimur hermdum notendum og tveimur leikjum (einn óhafinn, einn hafinn, búnir til í færslunni): allar reglur úr spec 7. Ekkert situr eftir.
- [ ] Get advisors (security). Commit.

### Task 3: Vafraskrif (`lib/nfl/pickStore.ts`)

`browserDb()` úr `lib/leaderboard/store`. Föll: `loadMyPicks(season)`, `savePick(gameId, team)`, `clearPick(gameId)`, `loadPicks(season)` (allar sýnilegar), `loadTiebreaks(season)`, `saveTiebreak(season, week, total)`, `myLeagues()`, `leagueMembers(ids)`, `createLeague(name)`, `joinLeague(code)`, `leaveLeague(id)`, `names(ids)`; biðröð í `localStorage` (`nfl-spa:bidrod`) með `queuePick`/`flushPicks`. Villa frá RLS (42501 / tóm uppfærsla) → `'locked'`.
- [ ] tsc; commit.

### Task 4: Innskráning sameiginleg

`SignIn`/`ChooseName` úr `components/leaderboard/LeaderboardView.tsx` fluttar í `components/leaderboard/SignIn.tsx` (export), LeaderboardView flytur þær inn. Engin hegðunarbreyting.
- [ ] tsc, leaderboard-próf, commit.

### Task 5: Síðan `/nfl/spa`

**Files:** `web/src/app/nfl/spa/page.tsx` (server: tímabil, leikir, `p_win` heimaliðs úr `nfl_elo`, `pickWeek`, hero ef til), `web/src/components/Nfl/Pickem/PickemView.tsx` (client), `PickRow.tsx`, `Boards.tsx`, `Leagues.tsx`.
- Leikir umferðar með tveimur hnöppum, læsing, rétt/rangt, hlutfall valsins, val líkansins eftir upphaf.
- Bráðabani, vikuval, töflur Vikan | Tímabilið, sía eftir deild, deildirnar mínar (stofna, afrita tengil, hætta).
- [ ] Commit.

### Task 6: Boðssíða `/nfl/spa/deild/[kodi]`
Client: innskráning ef þarf, svo `joinLeague`, svo `router.replace('/nfl/spa?deild=<id>')`. Villa: "Boðstengillinn er ógildur".
- [ ] Commit.

### Task 7: Valmynd og Vikan
- `NflSubnav`: "Spáleikur" (`/nfl/spa`) í stað "Styrkleiki"; "Staðan" virk á `/nfl/styrkleiki`.
- `components/Nfl/StandingsSwitch.tsx`: rofi Staðan | Styrkleiki á báðum síðum.
- Vikan: reitur "Spáðu í leiki vikunnar".
- [ ] Commit.

### Task 8: Prófun á localhost og hvelfing
- `next dev -p 3007` í worktree (Gildrur 29). Prófunaraðgangur á localhost; spá, breyta, bráðabani, deild, boðstengill (annar prófunaraðgangur), 375 px og dökkt. Prófunargögnum og -aðgöngum eytt á eftir.
- Hvelfing: `NFL/Spáleikur.md`, `NFL/Yfirlit.md`, `Gagnagrunnur/RPC.md`; minnið.
- Ekkert deploy fyrr en "full send".
