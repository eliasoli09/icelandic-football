# NFL-hornið, verkefni 4a: leikmannatölfræði, leiðtogar og leikmannasíður

Dagsetning: 14. október 2026. Grein: `nfl-leikmenn` (worktree `/Users/elias/FH leikmenn/nfl-leikmenn-wt`).

## Samhengi
Verkefni 4 (beðið um 14. okt) skiptist í:
- **4a (þetta skjal):** leikmannagögn, tölfræðileiðtogar (nýliðar sér), leikmannasíður.
- **4b:** verðlaunasaga (Wikipedia, samanborin við aðra heimild) og kapphlaupið um MVP,
  OPOY, DPOY, OROY, DROY og Comeback Player, með líkani sem er mælt á fyrri árum.

Ákvarðanir Eliasar: öll sex verðlaunin í 4b; myndir tengdar beint á NFL (upphafsstafir ef
mynd hleðst ekki); orðin hér að neðan.

## 1. Gögn
- `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_<ár>.csv`:
  ein röð á leikmann í leik, deildarkeppni (`REG`) og úrslitakeppni (`POST`), frá 1999.
  `game_id` er á sama sniði og í `nfl_games`. **Um 19.400 raðir á tímabil** (varnar- og
  sérliðsmenn meðtaldir), svo sagan er um 500 þúsund raðir.
- `https://github.com/nflverse/nflverse-data/releases/download/players/players.csv` (7 MB):
  `gsis_id` = `player_id` í tölfræðinni. 2.024 af 2.025 leikmönnum 2025 eru þar; vanti
  leikmann eru nafn og staða tekin úr tölfræðiskránni.

## 2. Töflur
- `nfl_players`: `player_id` PK, `name`, `position`, `position_group`, `team`, `jersey`,
  `rookie_season`, `draft_year`, `draft_round`, `draft_pick`, `draft_team`, `college`,
  `birth_date`, `headshot`.
- `nfl_player_weeks`: (`player_id`, `season`, `week`, `season_type`) PK, `game_id`, `team`,
  `opponent`, og tölfræði: `completions`, `attempts`, `passing_yards`, `passing_tds`,
  `interceptions`, `sacks_taken`, `passing_epa`, `carries`, `rushing_yards`, `rushing_tds`,
  `rushing_epa`, `receptions`, `targets`, `receiving_yards`, `receiving_tds`,
  `receiving_epa`, `fumbles_lost` (summa sendingar, hlaupa og gripa), `tackles_solo`,
  `tackle_assists`, `tackles_for_loss`, `def_sacks`, `qb_hits`, `def_interceptions`,
  `passes_defended`, `forced_fumbles`, `def_tds`, `special_teams_tds`.
- Sýn `nfl_player_season` (`security_invoker = true`): samtölur á (leikmann, tímabil,
  tegund), leikir, síðasta lið tímabilsins, og nafn, staða, mynd og nýliðaár úr
  `nfl_players`.
- Skrif: `rpc_upsert_nfl_players` og `rpc_upsert_nfl_player_weeks` (upsert, mest 500 raðir).

## 3. Keyrsla
- `ingestNfl` sækir líka vikuskrá yfirstandandi tímabils og leikmannaskrána, og skrifar
  aðeins leikmenn sem koma fyrir í vikuskránni. Bilun hér fellir ekki úrslit, Elo eða
  hermun (`players: { error }`).
- `scripts/ingest-nfl-players.mts --all` les inn 1999-núna einu sinni.

## 4. Síður
**`/nfl/leikmenn` (fimmti flipi "Leikmenn"):**
- Flokkar og tölur (tíu efstu):
  - Sendingar: sendingajardar, snertimörk, EPA.
  - Hlaup: hlaupajardar, snertimörk.
  - Gripir: gripjardar, grip, snertimörk.
  - Vörn: fellur, hleranir, tæklingar (einar + aðstoð), tæklingar fyrir tap, þvingaðir
    boltamissar.
- Rofi **Allir | Nýliðar** (`rookie_season` = tímabilið).
- Leitarbox yfir leikmenn tímabilsins.

**`/nfl/leikmadur/[id]`:** haus (mynd eða upphafsstafir, nafn, staða, lið, númer, aldur,
háskóli, "1. umferð, 3. val 2024"), samtölur tímabilsins í flokkum sem eiga við stöðuna,
leikjaskrá, ferill (eitt tímabil í línu, úrslitakeppni sér). Óþekkt `id` → 404.
Leikstjórnendur á leikjasíðunni verða tenglar á síðuna sína.

**Undirvalmynd með fimm flipa** verður að passa á 375 px (mæla, eins og síðast).

## 5. Orð (bætt í `NFL/Orðasafn.md`)
jardar (sendinga-/hlaupa-/gripjardar), heppnaðar/tilraunir, grip, skotmark, hlaup, fella,
hlerun, tækling, tækling fyrir tap, boltamissir, þvingaður boltamissir, varin sending,
nýliði, nýliðaval, val, umferð.

## 6. Prófanir
- `parsePlayerWeeks` og `parsePlayers` á raungögnum 2025 (fixture með broti úr skránni).
- **Samtölur gegn nflverse:** samtölur okkar úr vikuraðunum 2025 eiga að jafngilda
  `stats_player_reg_2025.csv` fyrir valda dálka og alla leikmenn.
- `leaders`: röðun, jöfnuður, nýliðasía.
- `ageOn`, `draftLabel`, flokkar eftir stöðu.

## 7. Útgáfa
Eins og áður: localhost fyrir Elias, ekkert deploy fyrr en "full send".
