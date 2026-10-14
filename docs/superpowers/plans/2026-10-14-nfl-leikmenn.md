# NFL-hornið, verkefni 4a (leikmenn) - framkvæmd

> Skráð sem framkvæmd: hönnunin var samþykkt og Elias bað um að byrjað yrði strax.

Spec: `docs/superpowers/specs/2026-10-14-nfl-leikmenn-design.md`.

1. **`players.ts`** - lestur vikuskrár og leikmannaskrár, samtölur, leiðtogar, aldur,
   valréttur, flokkar eftir stöðu. Próf á úrtaki úr 2025 (42 leikmenn, 722 leikir): samtölur
   okkar = samtölur nflverse í níu dálkum og fjölda leikja, fyrir alla 42.
2. **`008_nfl_players.sql`** - `nfl_players`, `nfl_player_weeks`, sýnin `nfl_player_season`
   (`security_invoker`), og tvö upsert-RPC.
3. **Innlestur** - `playerIngest.ts`, skriftan `ingest-nfl-players.mts`, og daglegi cron-inn.
   Sagan: 481.665 raðir, 51.228 leikmannauppfærslur, 305 s. Ferill Brady: 89.216 jardar /
   649 snertimörk (opinbert 89.214 / 649).
4. **Síður** - `/nfl/leikmenn` (leiðtogar, nýliðar, leit), `/nfl/leikmadur/[id]`,
   leikstjórnendur á leikjasíðu tengdir, fimm flipar (passar á 375 px með styttri "Úrslit").
5. **Fundið við skoðun og lagað** - myndir NFL voru allt að 4,4 MB (nú beðið um 11 kB
   útgáfu); ferilstaflan þandi leikmannasíðuna út á síma (grid `minmax(0,1fr)`); mínusmerki.
6. **Staðfest** - 1.095 próf, build, ekkert flæðir út fyrir á 375 px.
