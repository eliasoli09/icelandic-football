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
