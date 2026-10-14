# NFL-hornið, verkefni 2b: hermun tímabilsins og úrslitakeppnistrén

Dagsetning: 14. október 2026. Grein: `nfl-hermun` (worktree `/Users/elias/FH leikmenn/nfl-hermun-wt`).
Byggir á 2a (Elo-líkanið, `docs/superpowers/specs/2026-10-14-nfl-spar-design.md`), sem er í loftinu.

## Ákvarðanir Eliasar
- Bæði tré: "staðan í dag" og "líklegasta niðurstaða".
- Líkindatafla fyrir öll lið.
- Merkin "tryggt sæti í úrslitakeppni", "riðilsmeistari" og "úr leik" birtast **aðeins þegar
  þau eru stærðfræðilega sönnuð**. Þau mega vera sein, en aldrei röng.

## 1. Hermunin (`web/src/lib/nfl/sim.ts`)
- 10.000 hermanir (minna ef mælingin sýnir að það er of hægt fyrir cron, og þá sagt frá því).
- Hver óspilaður leikur deildarkeppninnar fær sigurvegara eftir Elo-líkum: heimavöllur,
  fríbónus og afturhvarf eins og í `predictGame`. Engin jafntefli.
- **Heit eða köld:** í heitri hermun breytast einkunnir innan hverrar hermunar eftir hverjum
  hermdum leik (`K × M(7) × (s − p)`, þ.e. stigamunur 7 talinn), í kaldri eru þær fastar.
  Mælingin velur.
- Sætaröðun hverrar hermunar fer í gegnum `computeStandings` (sömu viðmið og stöðusíðan).
  Hermdir leikir fá stöðuna 1-0, svo stigamismunur verður í raun sigrafjöldi; það viðmið
  ræður nær aldrei.
- **Snið eftir tímabilum:** frá 2020 komast 7 lið úr hvorri deild áfram og sæti 1 fær frí;
  2002-2019 komust 6 áfram og sæti 1-2 fengu frí. Umspil: hæsta sæti án frís gegn því
  lægsta, og svo framvegis. 8 liða úrslit: efsta sæti gegn því lægsta sem eftir er. Betra
  sæti á heimaleik, Super Bowl á hlutlausum velli.
- Ef leikur í úrslitakeppninni milli sömu liða í sömu umferð hefur þegar verið spilaður er
  raunverulegi sigurvegarinn notaður.
- Úttak fyrir hvert lið: `p_div`, `p_playoffs`, `p_bye`, `p_seed[1..7]`, `p_round2`
  (8 liða úrslit), `p_round3` (undanúrslit), `p_sb` (í Super Bowl), `p_title`.

## 2. Mælingin (`web/scripts/nfl-sim-backtest.mts`)
- Hvert tímabil 2002-2025, hermt frá stöðunni eftir vikur 6, 10 og 14, með Elo eins og það
  var þá. Spáðar líkur á sæti í úrslitakeppni eru bornar saman við hvort liðið komst í
  úrslitakeppnina.
- Brier og kvörðun í bilum (0-10%, ..., 90-100%), með viðmiði: Brier þess að spá alltaf
  hlutfallinu sem kemst áfram.
- Heit eða köld valin á 2002-2014, prófuð á 2015-2025.
- Ein setning úr niðurstöðunni fer á síðuna; tölurnar í hvelfinguna (`NFL/Líkanið.md`).

## 3. Merkin (`web/src/lib/nfl/clinch.ts`)
Stig liðs: sigrar + ½ jafntefli. "Mest" = núverandi stig + leikir eftir. Jafnt telst liðinu
alltaf í óhag.
- **Riðilsmeistari:** ekkert annað lið í riðlinum getur náð núverandi stigum liðsins.
- **Tryggt sæti:** liðið tapar öllu sem eftir er. B = önnur lið í deildinni sem geta náð
  núverandi stigum þess. Í versta falli enda þau öll fyrir ofan, og hver riðill sem á lið í B
  á riðilsmeistara úr B. Tryggt ef `|B| − (fjöldi riðla í B) ≤ 2`, þ.e. í mesta lagi tvö
  villikort fyrir ofan liðið. (Sjö lið komast áfram; þetta skilyrði er fyrir 7 liða sniðið.)
- **Úr leik:** A = önnur lið í deildinni sem eru nú þegar með fleiri stig en liðið getur mest
  náð. Úr leik ef lið úr eigin riðli er í A (getur ekki unnið riðilinn) og
  `|A| − (fjöldi riðla í A) ≥ 3` (þrjú villikort örugglega fyrir ofan).
- Prófað á 2025: eftir hverja viku 10-18 má ekkert merki stangast á við lokastöðuna.

## 4. Geymsla og keyrsla
- Ný tafla `nfl_sim`: `season`, `team` PK, allar líkurnar, `p_seed numeric[]`, `sims`,
  `run_at`. Skrifuð með `rpc_replace_nfl_sim` (eyðir tímabilinu og setur inn í einni
  færslu, svo lesandi sér aldrei hálfa töflu).
- Daglegi cron-inn keyrir hermunina á eftir Elo. Ef hún mistekst stendur eldri hermun og
  svarið fær `sim: { error }`.
- Merkin eru reiknuð á síðunni úr leikjunum (hratt, alltaf rétt miðað við gögnin).

## 5. Síður
**Flipi:** Vikan | Staðan | Styrkleiki | Úrslitakeppnin (`/nfl/urslitakeppni`).

**Trén**, rofi Í dag | Líklegast:
- *Í dag:* sæti 1-7 eftir núverandi stöðu, umspilsleikirnir og frí sætis 1, líkur á sæti í
  úrslitakeppni við hvert lið, og "Í baráttunni" (næstu lið fyrir utan).
- *Líklegast:* sætin fyllt gráðugt úr hermuninni (líklegasta par lið-sæti fyrst, ekkert lið
  tvisvar), leikirnir til þess liðs sem Elo telur sigurstranglegra, og hermunarlíkur í hverjum
  hnút (líkur liðs á að ná þangað).
- Breiður skjár: AFC vinstra megin, Super Bowl í miðju, NFC hægra megin. Sími: deildirnar hvor
  undir annarri, hver umferð lóðréttur listi.

**Líkindatafla:** öll 32 lið eftir líkum á titli. Dálkar Riðill, Úrslitak., Frí, 8 liða,
Undanúrsl., Super Bowl, Titill. Rofi AFC / NFC / bæði. Á síma aðeins Úrslitak., Super Bowl,
Titill. Undir 0,5% stendur "<1%", nema liðið sé stærðfræðilega úr leik: þá "úr leik".

**Staðan:** merkin T (tryggt sæti), R (riðilsmeistari) og Ú (úr leik) við liðin, með
skýringu, og dálkurinn "Úrslitak." úr hermuninni í báðum sýnum.

## 6. Prófanir
- `nfl-sim.test.ts`: snið eftir árum; pörun í umspili og 8 liða úrslitum (bæði snið); summa
  `p_seed` = `p_playoffs`; summa `p_title` yfir lið = 1; lið sem er stærðfræðilega úr leik
  fær 0; spilaður leikur í úrslitakeppni er virtur; köld hermun með jöfnum einkunnum gefur
  um 50% í hverjum leik.
- `nfl-clinch.test.ts`: tilbúin dæmi fyrir hvert merki, og 2025-prófið hér að ofan.
- Mælingarskriftan neitar að velja heitt/kalt á tímabilum eftir 2014.

## 7. Útgáfa
Eins og áður: migration, keyrsla, localhost fyrir Elias, ekkert deploy fyrr en "full send".
