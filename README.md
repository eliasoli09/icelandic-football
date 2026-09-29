# ⚽ Besta spáin — íslensk knattspyrnugreining

Lifandi greiningarsíða fyrir **Bestu deild karla** (og Lengjudeildina sem gagnagrunn):
Elo-stig liða og leikmanna, gagnsæjar leikjaspár, markakóngskapphlaup og sætalíkur
reiknaðar með Monte Carlo hermun. Kerfið uppfærist sjálfkrafa eftir hverja umferð.

Innblásin af [aziztitu/football-match-predictor](https://github.com/aziztitu/football-match-predictor),
en byggð frá grunni fyrir íslenskar aðstæður og íslensk gögn.

## Hvernig þetta virkar

```
ksi.is ──(cron scrape)──▶ Supabase (Postgres) ──▶ Next.js (Vercel)
                              ▲                        │
   SofaScore-innslög ─────────┘      Elo · Poisson-spár · Monte Carlo
```

1. **Gögn:** Öll úrslit beggja efstu deilda frá 2019 eru skröpuð af vef KSÍ
   (1.968 sögulegir leikir + yfirstandandi tímabil), staðfest línu fyrir línu á móti
   opinberum stöðutöflum KSÍ. Atburðir hvers leiks (mörk, spjöld, skiptingar) eru
   sóttir af leiksíðum KSÍ. Liðatölfræði og topp-150 leikmannalisti frá SofaScore
   eru hlaðin inn sem stök innslög (`data/seed/`).
2. **Elo liða:** World Football Elo líkan (K=24, heimavallarforskot 60 stig,
   margfaldari eftir markamun). Stig fylgja liðum milli deilda — nýliðar bera
   Elo-söguna sína með sér upp úr Lengjudeildinni.
3. **Spár:** Poisson-líkan þar sem vænt mörk blandast úr Elo-mun og markatölfræði
   tímabilsins (50/50 eftir 5 leiki). Hver spá sýnir rökin: Elo-mun, form síðustu
   5 leikja, mörk skoruð/fengin, innbyrðis viðureignir og heimavallaráhrif.
4. **Sætalíkur:** 10.000 hermanir af restinni af tímabilinu, með deildarskiptingunni
   (efri/neðri hluti eftir 22 umferðir, stig fylgja með). Skilar líkum á hverju sæti,
   Íslandsmeistaratitli, Evrópusæti (3 efstu — nálgun) og falli (2 neðstu).
5. **Leikmenn:** Elo-stig leikmanna út frá atburðum KSÍ (mörk +25, víti +25,
   gult −10, rautt −30, sjálfsmark −15, úrslit liðs ±8). KSÍ birtir ekki
   byrjunarlið eða stoðsendingar — stoðsendingatafla og einkunnir koma úr
   SofaScore-innslögum.

## Rangstöðugreining (prufuútgáfa) — `/rangstada`

Hladdu inn myndbroti (MP4/WebM) úr tölvunni. Allt keyrir í vafranum — myndbandinu er
aldrei hlaðið upp.

1. **Sparkið:** gervigreind (MediaPipe EfficientDet-Lite2, COCO „person“ + „sports ball“,
   keyrð á skörun reita svo litlir leikmenn og bolti greinist) skannar ±3 s við 10 ramma/s,
   fylgir boltanum og finnur augnablikið þegar hraði hans breytist skyndilega við fætur
   leikmanns. Síðan er fínstillt ramma fyrir ramma. Notandinn getur alltaf merkt sparkið
   sjálfur (**K** / „Merkja spark hér“) eða fært það um ramma.
2. **Völlurinn í metrum:** stærð valla er breytileg en merkingar eru staðlaðar (IFAB:
   vítateigur 40,32 × 16,5 m, markteigur, vítapunktur, vítabogi, miðhringur). Notandinn
   smellir á ≥4 sýnilega punkta á sparkrammanum og kerfið reiknar samvörpun (homography)
   frá pixlum yfir í vallarhnit. Vallarlínur eru teiknaðar aftur ofan á myndina til staðfestingar.
3. **Leikmenn og lið:** leikmenn finnast sjálfkrafa, skipt í lið eftir treyjulit (k-means í
   Lab-litrúmi), liðið sem sparkar er sóknarliðið, og móttakandinn er rakinn aftur á
   sparkrammann. Allt má leiðrétta með smelli/drætti.
4. **Úrskurður (lög 11):** rangstöðulína = næstaftasti varnarmaður eða boltinn (sá sem er
   nær marklínu); ekki rangstaða á eigin vallarhelmingi; jafnt = réttstaða. Mismunur innan
   óvissumarka (sjálfgefið ±30 cm) er merktur „of tæpt“.

**Takmarkanir:** ein myndavél og ~25 ramma/s (einn rammi ≈ 20–30 cm á spretti), fótpunktur
er nálgun á fremsta líkamshluta, og smáir/óskýrir boltar greinast illa í víðum útsendingarskotum
— þá þarf að merkja sparkið handvirkt. Tólið metur rangstöðu*stöðu*, ekki hvort leikmaður hafi
áhrif á leikinn. Líkanið (~23 MB) er sótt af storage.googleapis.com við fyrstu notkun;
WASM-keyrslan er afrituð í `web/public/mediapipe` við `npm install`.

## Uppsetning

```bash
# 1. Gagnagrunnur (Supabase)
#    - búðu til verkefni og keyrðu supabase/migrations/001_init.sql
#    - python3 scripts/gen_seed_sql.py  →  keyrðu data/seed/sql/*.sql í röð

# 2. Vefur
cd web
cp .env.local.example .env.local   # fylltu inn Supabase URL/lykla + CRON_SECRET
npm install
npm run dev

# 3. Fyrsta innhleðsla (sækir 2026 tímabilið + atburði, reiknar allt)
curl -X POST localhost:3000/api/refresh -H "Authorization: Bearer $CRON_SECRET"
```

## Sjálfvirkar uppfærslur

- `vercel.json` skilgreinir cron sem keyrir `/api/cron/ingest` daglega kl. 03:00
  (hobby-tier Vercel leyfir daglegt cron; eftir leiki má ýta á `/api/refresh`
  með leyndarmálinu til að uppfæra strax).
- Innhleðslan skráir frávik í `ingest_log` — þar á meðal "0-0 gildruna" hjá KSÍ
  (leikir sem sýna 0-0 á leikjakortum en enduðu öðruvísi samkvæmt opinberri töflu).

## Prófanir

```bash
cd web && npm test   # vitest: þáttarar (raunveruleg KSÍ-HTML fixtures) + reiknivélar
```

## Þekktar takmarkanir

- Leikmanna-Elo nær aðeins yfir leikmenn sem koma við sögu í atburðum
  (KSÍ birtir ekki byrjunarlið á vefnum).
- Stoðsendingar uppfærast aðeins með nýjum SofaScore-innslögum.
- Heimalið í hermdum leikjum deildarhlutans er slembival — raunveruleg
  leikjaniðurröðun KSÍ liggur ekki fyrir fyrirfram.
- Evrópusæti = 3 efstu sæti er nálgun (bikarmeistarar geta breytt myndinni).
