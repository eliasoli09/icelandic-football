# NFL-hornið, verkefni 2a: líkanið (Elo, leikjaspár, styrkleiki)

Dagsetning: 14. október 2026. Grein: `nfl-spar` (worktree `/Users/elias/FH leikmenn/nfl-spar-wt`).
Byggir á verkefni 1 (`docs/superpowers/specs/2026-10-14-nfl-grunnur-design.md`), sem er í loftinu.

## Ákvarðanir Eliasar

- **Hreint Elo + Vegas til hliðar.** Líkanið ræður öllum líkum á síðunni. Vegas-línan er sýnd
  við hliðina til samanburðar en hefur ekki áhrif á einkunnir.
- **Verkefni 2 skiptist í tvennt.** 2a (þetta skjal): líkanið, leikjaspár, leikjasíða og
  styrkleikalisti. 2b (sér spec): hermun tímabilsins, tvö úrslitakeppnistré ("staðan í dag" og
  "líklegast"), líkindatafla og merkin "tryggt sæti í úrslitakeppni" og "úr leik".
- **Leið A:** NFL-Elo í anda FiveThirtyEight. Engin leiðrétting fyrir leikstjórnanda í
  líkunum, en merki birtist þegar nýr leikstjórnandi byrjar.

## Bakgrunnur sem mótar hönnunina

- Í fótboltanum vann markaðurinn líkanið alls staðar (hvelfingin, `Lærdómur/Markaðurinn.md`).
  Búist er við því sama hér, og síðan segir það.
- Vegas-línur í `nfl_games` ná aðeins tvær vikur fram í tímann. 14. okt höfðu vikur 6-7
  línur en vikur 8-18 (165 leikir) enga. Allir spilaðir leikir frá 1999 hafa lokalínu og
  moneyline, svo mæla má líkanið gegn markaðnum á um 7.000 leikjum.

## 1. Líkanið (`web/src/lib/nfl/elo.ts`)

Hreint fall yfir alla leiki í tímaröð (`kickoff`, svo `game_id`).

- Öll félög byrja í **1505** árið 1999. Lið eru auðkennd með `franchise`, svo saga Raiders
  fylgir félaginu frá OAK til LV.
- Líkur heimaliðs: `pHome = 1 / (1 + 10^(-(eloH - eloA + hfa) / 400))`, og `hfa = 0` á
  hlutlausum velli.
- Uppfærsla: `delta = K * M * (s - pHome)`, þar sem `s` er 1, ½ eða 0. Heimaliðið fær
  `+delta` og útiliðið `-delta`.
- Margfaldari: `M = ln(|stigamunur| + 1) * 2.2 / (winnerDiff * 0.001 + 2.2)`, þar sem
  `winnerDiff` er Elo-forskot sigurvegarans að HFA meðtöldu. Í jafntefli er `M = 1`.
- Milli tímabila: `elo = elo * (1 - R) + 1505 * R` við fyrsta leik liðs á nýju tímabili.
- Fríbónus (valkvætt, `bye`): lið sem átti ekki leik í síðustu viku deildarkeppninnar fær
  `+bye` Elo í þeim leik. Á ekki við í úrslitakeppni.
- Spáð forgjöf heimaliðs: `(eloH - eloA + hfa) / 25` stig. Jákvætt þýðir heimaliðið sterkara,
  sama formerki og `spread_line`.
- Stillingar `K`, `HFA`, `R` og `BYE` eru fastar í `NFL_ELO` í `elo.ts` og koma úr mælingunni.

## 2. Mælingin (`web/scripts/nfl-backtest.mts`)

- Gögn úr `test/fixtures`-sniðinu: öll `games.csv` sótt beint frá nflverse.
- **Val á stillingum:** netleit á **2002-2014** (1999-2001 er upphitun). Skriftan neitar að
  nota leiki eftir 2014 til að velja stillingar.
- **Próf:** stillingarnar festar og keyrðar á **2015-2025** (2026 er ókláruð og ekki með).
- Mælikvarðar, fyrir líkanið og Vegas á sömu leikjunum (þeim sem hafa bæði moneyline og
  spread):
  - log loss og Brier á sigri heimaliðs (jafntefli talin ½);
  - hlutfall réttra spáa;
  - meðalskekkja (MAE) forgjafar gegn raunverulegum stigamun.
- Munur líkans og Vegas í log loss fær 95% öryggisbil úr pöruðum mismuni.
- Líkur Vegas: `1/odds` fyrir hvort lið úr amerískum stuðli, deilt með summunni.
- Skriftan prentar líka besta HFA á hverju fimm ára bili, til að sjá hvort heimavallarforskot
  hafi minnkað. Það er aðeins skráð; HFA er ekki valið á prófunarárunum.
- Niðurstöður fara í hvelfinguna, `NFL/Líkanið.md`, og ein setning á styrkleikasíðuna.
- **Elias sér niðurstöðurnar áður en síðurnar eru smíðaðar.**

## 3. Geymsla og keyrsla

- Ný tafla `nfl_elo`: `game_id` + `team` (franchise) PK, `season`, `week`, `elo_before`,
  `elo_after`. Opinber lestur með RLS. Skrifað með nýju `rpc_upsert_nfl_elo` (upsert, svo
  lesendur sjá aldrei hálfa töflu).
- `ingestNfl` keyrir Elo-endurreikning á eftir innlestri, bæði í cron og í skriftunni. Ef
  hann mistekst skrifast úrslitin samt og svarið fær `elo: { error }`.
- Spá fyrir óspilaðan leik er reiknuð á síðunni úr nýjustu `elo_after` hvers liðs. Engin
  spátafla er geymd. Ef næsti leikur liðs er á nýju tímabili er R beitt fyrst.
- Fyrir spilaðan leik geymir `elo_before` það sem líkanið sagði.

## 4. Nýr leikstjórnandi (`web/src/lib/nfl/qb.ts`)

Fyrir óspilaðan leik: ef skráður byrjunarleikstjórnandi (`home_qb`/`away_qb`) er ekki sá sem
byrjaði flesta af síðustu þremur leikjum liðsins á tímabilinu, skilar fallið
`{ qb, usual }`. Síðan sýnir "nýr leikstjórnandi: {qb} (í stað {usual})". Engin breyting á
líkum. Á ekki við fyrir fyrstu leiki tímabils (færri en tveir leikir að baki) né ef nafn vantar.

## 5. Síður

**Undirvalmynd:** Vikan | Staðan | Styrkleiki.

**Vikan (`/nfl`):**
- Óspilaður leikur: sigurlíkur líkansins hjá hvoru liði ("58%") og þunn tvílit stika í
  litum liðanna. Hægra megin "Líkanið SEA −2" og "Vegas SEA −2,5", og heildarstig Vegas.
- Spilaður leikur: "líkanið gaf SEA 58%" í lítilli línu.
- Merkið "nýr leikstjórnandi" þegar við á.
- Öll línan er tengill á leikjasíðuna.

**Leikjasíða (`/nfl/leikur/[id]`):**
- Haus: merki og nöfn, íslenskur tími eða lokastaða, völlur.
- Spá: stór tvílit líkindastika og tafla, líkanið gegn Vegas: sigurlíkur (Vegas úr moneyline
  án álags) og forgjöf. Heildarstig aðeins frá Vegas.
- Liðin: Elo og breyting síðustu fimm leikja, met tímabilsins, síðustu fimm úrslit, byrjunar-
  leikstjórnandi og merki um nýjan.
- Innbyrðis: síðustu fimm viðureignir frá 1999.
- Eftir leik: úrslitin efst og spáin sem líkanið gaf stendur áfram.
- Óþekkt `id` → 404.

**Styrkleiki (`/nfl/styrkleiki`):**
- Tafla 32 liða eftir Elo: sæti, lið, Elo, breyting frá síðustu viku (▲/▼), met, og forskot
  gegn meðalliði á hlutlausum velli í stigum (`(elo - 1505) / 25`).
- Línurit yfir tímabilið, átta efstu sjálfgefið, hægt að velja fleiri.
- Ein setning úr mælingunni með raunverulegum tölum.

**Sími:** prósentur og línurnar tvær í hægri dálki Vikunnar. Á leikjasíðunni fara liðin hvort
undir annað. Forskotsdálkurinn er falinn undir `sm`.

**Ekki í 2a:** hermun, tré, merki um tryggt sæti, heildarstigaspá líkans, líkindasaga leiks.

## 6. Prófanir

- `nfl-elo.test.ts`: samhverfa og summa líkinda; HFA = 0 á hlutlausum velli; jafntefli færir
  einkunnir að líkunum; margfaldarinn minnkar þegar sterkara liðið vinnur stórt; R beitt einu
  sinni á tímabil; OAK → LV heldur einkunn; **summa allra einkunna óbreytt eftir hvern leik**;
  fríbónus aðeins í deildarkeppni.
- `nfl-odds.test.ts`: −142/+120 → um 0,57/0,43, summa nákvæmlega 1; `null` ef stuðul vantar.
- `nfl-qb.test.ts`: raunveruleg skipti úr 2025-skránni; engin merki fyrir viku 1-2.
- Mælingarskriftan neitar að velja stillingar á leikjum eftir 2014 (prófað).

## 7. Útgáfa

Eins og í verkefni 1. Migration, backfill og localhost fyrir Elias. Ekkert deploy fyrr en
hann segir "full send". Þá: athuga að `main` hafi ekki færst, deploy, sameina `main`, og
uppfæra hvelfinguna (`NFL/Líkanið.md`, `NFL/Yfirlit.md`, RPC-listann).
