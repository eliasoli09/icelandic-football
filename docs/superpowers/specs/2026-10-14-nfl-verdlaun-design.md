# NFL-hornið, verkefni 4b: verðlaunasagan og kapphlaupið

Dagsetning: 14. október 2026. Grein: `nfl-verdlaun` (worktree `/Users/elias/FH leikmenn/nfl-verdlaun-wt`).
Byggir á 4a (leikmannatölfræði, `2026-10-14-nfl-leikmenn-design.md`), sem er í loftinu.

## Ákvarðanir Eliasar
- Sex verðlaun: MVP, OPOY, DPOY, OROY, DROY, Comeback Player (CPOY).
- Comeback fær líkan, en fer aðeins á síðuna ef það slær viðmiðið; annars aðeins sagan.

## 1. Verðlaunasagan
**Aðalheimild:** AP-töflur á Wikipedia (HTML úr `action=parse`):
- `AP_NFL_Most_Valuable_Player` (taflan með "Season | Player"), `AP_NFL_Offensive_Player_of_the_Year`,
  `AP_NFL_Defensive_Player_of_the_Year`, `AP_NFL_Comeback_Player_of_the_Year`;
- `List_of_NFL_Rookie_of_the_Year_awards`, tafla [0] undir "Associated Press (AP)"
  (Season | Offensive | Defensive, hvort með nafni, liði, stöðu). Hinar töflurnar á síðunni
  eru frá öðrum samtökum og eru ekki notaðar.

**Deild verðlaun:** tveir tenglar í sama reit (t.d. MVP 2003: Manning og McNair). Skipt eftir
tenglum; staða og lið þá tóm.

**Varnir (skipt um frá hönnun):** Wikidata reyndist of gloppótt (MVP-færslan með enga
verðlaunahafa, DPOY 11 af 50+) til að vera seinni heimild. Í staðinn:
1. **Tímabilssíður** (`<ár>_NFL_season`, tafla "Award | Winner") þau ár sem þær hafa hana.
   Hlutfall ára sem ná samanburði er skráð. Hvert ósamræmi er prentað og skoðað handvirkt.
2. **Tölfræðin okkar** (frá 1999): sigurvegari verður að hafa spilað tímabilið, OPOY/OROY
   sóknarmaður, DPOY/DROY varnarmaður, OROY/DROY með `rookie_season` = tímabilið.
3. **Tenging við leikmann** aðeins með nákvæmri pörun á staðlaðu nafni (án kommu/punkta,
   bókstafa með broddum og Jr./Sr./II/III) meðal leikmanna sem spiluðu tímabilið; tvíræð
   eða engin pörun = enginn tengill og skráð. Aldrei hlutstrengja-pörun (Gildrur 2).

**Geymsla:** `web/src/lib/nfl/data/nfl-awards.json` í repo-inu (breytist einu sinni á ári,
yfirfaranlegt í git). Skriftan `scripts/nfl-awards.mts` endurgerir hana.

## 2. Kapphlaupið
- Eitt líkan á verðlaun: skilyrt logit (softmax yfir frambjóðendur tímabils), L2-refsing,
  þjálfað með stigli í TypeScript.
- **Gögn:** staðan eftir hverja viku 4-18 hvers tímabils 2002-2025 (samtölur úr
  `nfl_player_weeks` upp að vikunni), merkt með þeim sem vann í lok tímabilsins. Einkenni
  eru meðaltöl á leik, svo hálft og heilt tímabil séu sambærileg; vikufjöldi að baki er
  einkenni líka, svo líkanið læri að óvissan minnkar.
- **Frambjóðendur:** 30 efstu á tímabili eftir skimunartölu hvers verðlauns.
- **Einkenni:**
  - MVP: sendinga-EPA/leik, snertimörk/leik, staða QB, sigurhlutfall liðs.
  - OPOY / OROY: jardar frá miðlínu/leik, snertimörk/leik, EPA/leik (allt), staða.
  - DPOY / DROY: fellur, hleranir, tæklingar fyrir tap, þvingaðir boltamissar, varðar
    sendingar, högg á leikstjórnanda, allt á leik.
  - CPOY: leikir fyrra tímabils, besta fyrra tímabil (EPA eða fellur, eftir stöðu), afköst
    núna á leik.
- **Mæling** (`scripts/nfl-award-backtest.mts`): refsing valin á 2002-2014, prófað á
  2015-2025. Log loss sigurvegarans og hlutfall þar sem efsti vann, eftir viku 6/10/14/18.
  **Viðmið:** "leiðtoginn í aðaltölu vinnur" (MVP: sendinga-EPA; OPOY: jardar frá miðlínu; DPOY: fellur; OROY/DROY sömu tölur meðal
  nýliða; CPOY: afköst núna meðal þeirra sem misstu helming fyrra tímabils). Verðlaun fer á
  síðuna aðeins ef líkanið slær viðmiðið í hittni efsta manns á prófunarárunum.
- **Geymsla:** `nfl_award_race` (season, award, player_id, p, rank, week, run_at), skrifað af
  daglega cron-inum með `rpc_replace_nfl_award_race`.

## 3. Síður
- `/nfl/verdlaun`: rofi milli verðlaunanna sex; kapphlaupið (tíu efstu, mynd, lið,
  viðeigandi tölur, líkur) og sagan (allir sigurvegarar, nýjast efst, tengill frá 1999).
  Skýringarlína úr mælingunni. Verðlaun sem stóðust ekki mælinguna sýna aðeins söguna og
  segja af hverju.
- Undirvalmyndin fær ekki sjötta flipa (passar ekki á 375 px): á `/nfl/leikmenn` og
  `/nfl/verdlaun` er rofi **Tölfræði | Verðlaun**, og flipinn "Leikmenn" er virkur á báðum.
- Leikmannasíðan: verðlaunamerki í hausnum ("MVP 2025").

## 4. Orð (tillögur, í orðasafnið)
MVP = verðmætasti leikmaðurinn; OPOY = sóknarmaður ársins; DPOY = varnarmaður ársins;
OROY = sóknarnýliði ársins; DROY = varnarnýliði ársins; CPOY = endurkoma ársins.

## 5. Prófanir
- Lestur taflnanna á vistuðum brotum úr síðunum (fixtures): deilt MVP 2003, AP-nýliðataflan,
  hreinsun "(3)" og neðanmálsgreina.
- Nafnastöðlun og pörun: nákvæm, tvíræð → null.
- Logit-kjarninn: líkur summast í 1, stigull réttur (tölulegur samanburður), þjálfun finnur
  augljósan sigurvegara á tilbúnum gögnum.
- Mælingarskriftan neitar að velja refsingu á 2015 eða síðar.

## 6. Útgáfa
Eins og áður: localhost fyrir Elias, ekkert deploy fyrr en "full send".
