# Markaðurinn (/leikmenn/markadur)

Verðmiði á alla fantasy-sóknarmenn, vika fyrir viku, í anda markaðssíðu
Commissioner's Desk. Elias samþykkti hönnunina 26. okt 2026. Útgáfa 1 byggir á
okkar eigin mati úr tölfræði nflverse (CC BY 4.0). Skiptagögn Sleeper eru aðeins
leyfð utan viðskipta. Verð úr þeim kemur síðar sem sér verkefni, og aðeins ef
Sleeper veitir leyfi (Elias sendir póstinn).

**Síðan segir þetta beint:** þetta er mat síðunnar úr tölfræði, ekki verð sem
fólk borgar í skiptum.

## Verðmætið
Fyrir hvern sóknarmann (QB, RB, WR, TE) eftir hverja lokna umferð:

1. **Stig í leik** (hálft stig fyrir grip, `offenceScore` í `lib/nfl/stars.ts`):
   spá = meðaltal þessa tímabils og síðasta tímabils (vegið með `prev`), dregið að
   `prior` stöðunnar um `k` leiki. Sama form og `statProjection` í `vedmal.ts`, án
   mótherja- og liðsþáttar.
2. **Leikir eftir:** deildarleikir liðsins sem eru eftir. Ef leikmaðurinn er Out eða
   Doubtful á `nfl_injury` í nýjustu viku er næsti leikur dreginn frá (-1; Doubtful
   telst eins og Out). Fyrir IR, PUP og Reserve eru 4 leikir dregnir frá. Cut þýðir
   0 leikir eftir. Cut-lína gildir ekki ef leikmaðurinn er á lista liðs sömu vikuna
   (látinn fara og endursaminn, eða færður á æfingahóp eða varalista).
   - Liðið er félagið sem hann spilaði síðast með. Í nýjustu loknu umferðinni gildir
     félagið á skrá (`nfl_players.team`) ef það er annað félag (skipt eða samið
     annars staðar); eldri umferðir halda félaginu sem hann spilaði með þá.
3. **Varamannsstig stöðunnar** (12 liða deild): spáin í leik hjá QB nr. 12, RB nr. 30,
   WR nr. 36 og TE nr. 12 (raðað eftir spá).
4. **Verðmæti** = (spá − varamannsstig) × leikir eftir, í fantasy-stigum. Það getur
   verið neikvætt.
5. **Sæti** = röð eftir verðmæti meðal allra sóknarmanna (#1 dýrastur). Sæti í stöðu
   (RB3) líka. Leikmenn með 0 leiki eftir (verðmæti 0) raðast aftast, á eftir öllum sem
   eiga leik eftir, líka þeim sem eru undir varamannsstigum (neikvætt verðmæti). Annars
   lentu þeir um #91 í eina umferð og fylltu Kaupa núna / Selja núna af suði.

Leikmaður birtist ef hann hefur spilað leik á tímabilinu eða í fyrra og er á lista
liðs (`nfl_players.team` ekki tómt).

## Mæling áður en síðan fer í loftið
- **Markmið:** raunveruleg stig í leik það sem eftir er deildarkeppninnar, í þeim
  leikjum sem leikmaðurinn spilaði.
- **Úrtak:** eftir umferðir 3-14, leikmenn með a.m.k. 1 leik á tímabilinu og a.m.k.
  3 leiki eftir.
- **Samanburður:** spáin gegn "meðaltal tímabilsins til þessa", MAE, parað 95% bil.
  Bilið er klasað eftir leikmannatímabili: fyrst meðalmunur hvers leikmanns á tímabili,
  svo bilið yfir þá (sami leikmaður í 12 umferðir er ekki 12 óháð sýni).
- **Val og prófun:** `prev`, `k` og `prior` í hverri stöðu valin á 2016-2021 og prófuð
  einu sinni á 2022-2025. Ekkert er valið á prófunarárunum (gildra 33).
- **Úrskurður:** ef allt bilið er undir 0 fer spáin á síðuna. Annars er notað
  meðaltal til þessa (k = 0, prev = 0) og síðan segir það.
- **Niðurstaða (28. okt):** heildarbilið var -0,258 [-0,326, -0,190] (MAE 2,308 á móti
  2,595), svo reglan stóðst og spáin fór á síðuna. QB eitt og sér var ekki marktækt,
  -0,275 [-0,709, 0,159], en reglan, ákveðin fyrirfram, var heildarbilið.
- Niðurstaðan fer í hvelfinguna (`NFL/Markaðurinn.md`) og stillingarnar í kóðann
  (`NFL_MARKET`).

## Gögn og keyrsla
- **Ný tafla `nfl_market`** (migration 019): `season, week, player_id, value, rank,
  pos_rank, proj, games_left`, lykill `(season, week, player_id)`. Hún er opin til
  lestrar og skrifað er með `rpc_replace_nfl_market(season, week, rows)` (eyða og setja
  inn í einni færslu).
- **`lib/nfl/market.ts`:** hrein föll, `marketWeek(weeks, players, games, injuries,
  season, week, params)` → raðir. Engin gagnagrunnsköll, svo þau eru prófanleg.
- **Daglegi cron-inn** skrifar hverja lokna umferð sem vantar, og reiknar auk þess
  nýjustu loknu umferðina aftur á hverjum degi, svo nýjar meiðslaskýrslur ná inn þar til
  næsta umferð klárast. Umferð telst lokin þegar allir leikir hennar eru spilaðir og
  allir hafa tölfræði, eða 3 dögum eftir síðasta leik hennar ef minnst 60% leikjanna hafa
  tölfræði (nflverse fyllir stundum aldrei í restina). Bilun þar fellir ekki restina af
  cron-inum (eins og leikmenn).
- **`scripts/ingest-nfl-market.mts 2026 [--all]`** (tímabilið án flaggs) gerir það sama
  og cron-inn. Með `--all` er hver lokin umferð skrifuð upp á nýtt, og meiðslalisti
  hverrar umferðar tekinn úr sögu nflverse (`injuries_2026.csv` og
  `roster_weekly_2026.csv`), því `nfl_injury` geymir aðeins þær vikur sem cron-inn hefur
  séð. Taflan `nfl_injury` er látin ósnert. Svona hefur línuritið sögu frá fyrsta degi.
- **`scripts/nfl-market-backtest.mts`:** mælingin hér að ofan.

## Síðan
Nýr flipi í `PlayersSwitch`: Tölfræði | Verðlaun | Stjörnulið | Meiðsli | Markaðurinn.
Á 375 px þarf flipabarinn að skrunast, eða merkið að styttast í "Markaður" (prófað á síma).

1. **Línuritið:** sæti yfir tíma (umferð á x-ás, sæti á y-ás, #1 efst) fyrir valda
   leikmenn, í lit liðs hvers leikmanns (`visible()` úr WinChart fyrir dökka liti).
   - 1V | 1M | ALLT (síðustu 2 umferðir, síðustu 5, allt tímabilið)
   - Valið er í slóðinni (`?p=id,id`) svo hægt er að deila því. Sjálfgefið eru stærstu
     hreyfingar vikunnar.
   - Hámark 6 leikmenn
   - recharts (er þegar í nfl-web)
2. **Taflan:** #1-#300, síur Allir | QB | RB | WR | TE, breyting á sæti frá síðustu
   umferð (▲/▼), + bætir við línuritið, og tengill á leikmannasíðuna.
3. **Kaupa núna / Selja núna:** 5 sem hækkuðu og 5 sem lækkuðu mest frá síðustu umferð
   (í sætum, aðeins sæti 1-300). Undir þeim eru stærstu hreyfingar frá umferð 1, fyrir
   leikmenn með a.m.k. 3 leiki á tímabilinu.
4. **Skiptireiknir:** leit eftir nafni, leikmenn á hvora hlið og summa af max(verðmæti,
   0) á hvorri hlið.
   - **Sanngjarnt** ef munurinn er innan 10% af stærri hliðinni.
   - **Annars:** "[Hlið] vinnur skiptin um X stig".
   - Allt í vafranum, úr gögnum nýjustu umferðar.
5. **Skýring neðst:** hvernig verðið er reiknað og niðurstaða mælingarinnar í einni
   setningu.

Orðin fara fyrst í `Orðasafn.md`:
- markaður
- verðmæti
- varamannsstig
- kaupa núna, selja núna
- skiptireiknir
- sanngjarnt

## Ekki í útgáfu 1
- Dynasty
- Eigið lið, eða að lesa inn deild
- Elo-línurit liða
- Verð úr skiptum (Sleeper)
- Varnir og sparkarar

## Prófanir
- `market.test.ts`:
  - spáin á litlu dæmi
  - varamannsstig og verðmæti
  - meiðsli draga frá leiki
  - frí telst ekki sem leikur
  - röðun og sæti í stöðu
  - skiptireiknir: sanngjarnt og hver vinnur
- Ingest-skriftan á 2026 fyllir allar loknar umferðir, og summa raða passar við fjölda
  leikmanna.
- Á vefnum: síðan á 375 px og á breiðum skjá, `?p=` slóðin endurheimtir valið, og
  reiknirinn virkar.
