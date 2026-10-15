# NFL-hornið: leiðrétting fyrir leikstjórnanda í Elo

Dagsetning: 15. október 2026. Grein: `nfl-qb` (worktree `/Users/elias/FH leikmenn/nfl-qb-wt`).
Opna atriðið úr hvelfingunni, `NFL/Líkanið` ("leið B").

## Ákvörðun Eliasar
Leið C: tvær útgáfur mældar hlið við hlið, sú betri fer á síðuna, og aðeins ef hún slær
núverandi líkan.

## Vandinn
Elo veit ekki hver spilaði. KC tapaði 87 Elo-stigum í vikum 16-18 2025 með varaleikstjórnendum,
og um 50 þeirra fylgdu inn í 2026.

## Gögn
- `games.csv` hefur `home_qb_id`/`away_qb_id` (gsis-auðkenni, sama og `nfl_player_weeks.player_id`).
  Fyllt í öllum 7.276 leikjum til 2025. Á yfirstandandi tímabili aðeins fyrir næstu umferð
  (staðfest 15. okt: vika 6 fyllt, vika 7+ tóm).
- `nfl_player_weeks`: `passing_epa` og `rushing_epa` á leik frá 1999, um 580-600 leikir
  leikstjórnenda (5+ sendingatilraunir) á tímabili.
- Nýtt: `nfl_games.home_qb_id`, `away_qb_id` (migration `010_nfl_qb.sql`), lesið inn eins og nöfnin.

## Útgáfurnar tvær (`lib/nfl/qbElo.ts`)
Báðar skila **leiðréttingu í Elo-stigum á lið í leik**, `adj`, sem er lögð við Elo-muninn:
`diff = eloH − eloA + HFA ± BYE + adjH − adjA`.

**Uppfærslan notar leiðréttu líkurnar** (eins og FiveThirtyEight). Ef varamaður byrjar og liðið
tapar eins og búist var við, lækkar grunneinkunn liðsins lítið. Þannig festist tap vegna
meiðsla ekki í einkunninni og fylgir ekki inn í næsta tímabil.

- **A. Föst refsing:** `adj = −P` þegar byrjunarmaðurinn er ekki sá sem byrjaði flesta af
  síðustu þremur leikjum liðsins (sama regla og `qbChange`, en yfir tímabilaskil). Annars 0.
- **B. Einkunn leikstjórnanda:** EPA leiks = `passing_epa + rushing_epa` byrjunarmannsins.
  - Einkunn leikmanns: veldisvegið meðaltal (vægi `a` á nýjasta leik) með `n0` leikjum af
    forgildi `prior` fyrir þá sem hafa fáa leiki.
  - Venjuleg einkunn liðsins: veldisvegið meðaltal EPA byrjunarmanna liðsins (vægi `t`).
  - `adj = c × (einkunn byrjunarmanns − venjuleg einkunn liðsins)`.
  - Einkunnir eru uppfærðar eftir leikinn, svo leikur notar aðeins það sem var vitað fyrir hann.

Leikur án skráðs byrjunarmanns (framtíðarleikir lengra en næsta umferð) fær `adj = 0`,
þ.e. gert ráð fyrir venjulega manninum.

## Mæling (`scripts/nfl-qb-backtest.mts`)
- Stillingar (P fyrir A; c, a, t, n0, prior fyrir B) valdar á **2002-2014** með leit á
  log loss. Varnaglinn úr `tune()` gildir: neitar vali á 2015 eða síðar.
- K, HFA, R, BYE haldast `NFL_ELO` í mælingunni, svo aðeins QB-hlutinn er borinn saman.
- Prófað á **2015-2025**: log loss, hittni, forgjafarskekkja, hvor útgáfa gegn núverandi
  líkani og gegn Vegas, parað 95% bil.
- **Regla:** útgáfa fer á síðuna aðeins ef bilið fyrir (útgáfa − núverandi) í log loss er allt
  undir 0. Ef báðar standast fer sú með lægra log loss. Ef hvorug stenst fer ekkert á síðuna og
  niðurstaðan er skráð í hvelfinguna.
- Lokastillingar valdar á 2016-2025 eins og með Elo, eftir að prófunin er búin.

## Ef útgáfa stenst
- **Geymsla:** tafla `nfl_game_qb` (game_id, team, qb_id, qb, adj), skrifuð af daglega cron-inum
  fyrir alla leiki með skráðan byrjunarmann, með `rpc_replace_nfl_game_qb` (secret-varið).
  `nfl_elo` geymir áfram grunneinkunnir; `p_win` í henni verður leiðréttu líkurnar.
- **Spár á síðum:** `predictGame` tekur við `adj` hvors liðs. Vikan, leikjasíðan og hermunin
  lesa `adj` úr `nfl_game_qb`; hermunin notar 0 fyrir leiki án skráðs byrjunarmanns.
- **Merkið "nýr leikstjórnandi"** fær töluna: "Drew Lock byrjar (−48 Elo)". Sýnt þegar
  `|adj| ≥ 10`, óháð `qbChange`.
- Skýringartexti á styrkleikalistanum: einkunnin er grunneinkunn liðsins, án leiðréttingar.

## Prófanir
- `qbElo`: A gefur −P aðeins við skipti; B: einkunn hreyfist í átt að nýjum leik, forgildi
  ræður hjá nýliða, adj = 0 án byrjunarmanns, enginn leikur notar eigin úrslit.
- `runElo` með `adj = 0` alls staðar gefur nákvæmlega sömu raðir og í dag.
- Varnaglinn neitar 2015+.
- csv-lestur: `home_qb_id`/`away_qb_id`.

## Útgáfa
Eins og áður: localhost fyrir Elias, ekkert deploy fyrr en "full send".

## Niðurstaða (15. okt): hvorug útgáfan stenst, ekkert fer á síðuna
Úttakið er í `2026-10-15-nfl-qb-results.txt`.
- **Fyrsta keyrslan var of jákvæð** (B −0,0071 [−0,0113, −0,0028]). Grunnstillingarnar
  `NFL_ELO` voru valdar á 2016-2025, sem skarast við prófunarárin. Mælingin velur núna
  Elo-stillingarnar líka á 2002-2014 (K 25, HFA 55, R 0,5, BYE 35).
- **Hrein mæling** eftir að leitin var víkkuð þar til engin stilling var á jaðri (t = 0 er
  eðlilegt gólf):
  - A: −0,0024 [−0,0052, +0,0005]
  - B: −0,0029 [−0,0063, +0,0005]
  - Bæði bilin ná yfir 0.
- **Stefnan er sú sama í öllum útgáfum**, um 0,0025-0,0035, sem er um 10-15% af bilinu upp í
  Vegas. Það er þó ekki marktækt, og hvort B stóðst réð breidd leitarinnar. Það er ekki traust
  niðurstaða.
- **Stillingar B eru óstöðugar milli tímabila.** Á 2002-2014 var valið c 15, a 0,3, t 0,
  n0 10, forgildi −30 (í raun algild leikstjórnandaeinkunn). Á 2016-2025 var valið c 15,
  a 0,02, t 0,02, n0 2, forgildi −6.
- Grein `nfl-qb` er ekki sameinuð `main`. Taflan `nfl_game_qb` og `rpc_replace_nfl_game_qb`
  eru í gagnagrunninum, tómar og ónotaðar.
