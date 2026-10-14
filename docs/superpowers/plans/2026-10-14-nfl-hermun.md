# NFL-hornið, verkefni 2b (hermunin) - framkvæmd

> Skráð sem framkvæmd frekar en fyrirfram skrifuð áætlun: hönnunin var þegar samþykkt í
> köflum og Elias bað um að byrjað yrði strax. Hvert verk var unnið próf-fyrst þar sem
> fallið er hreint, og hvert er sitt commit.

Spec: `docs/superpowers/specs/2026-10-14-nfl-hermun-design.md`.

1. **`clinch.ts`** - sönnuð merki. Próf: ekkert merki stangast á við lokastöðu 2025 eftir
   neina viku 8-18. Fyrsta merki eftir viku 12; eftir viku 16 hafa 23 lið merki.
2. **`sim.ts`** - hermun gegnum úrslitakeppnina, bæði sætasnið (6/2 fyrir 2020, 7/1 frá
   2020), raunveruleg úrslit virt, seedable RNG. 2.000 hermanir á 1 s.
3. **`scripts/nfl-sim-backtest.mts`** - heit valin á 2002-2014 (Brier 0,1106 gegn 0,1116).
   Prófun 2015-2025, 1.056 spár: Brier 0,1146 gegn 0,2417 fyrir meðaltalið, öll kvörðunarbil
   innan óvissu.
4. **`007_nfl_sim.sql`** - `nfl_sim` og `rpc_replace_nfl_sim` (eyða + setja inn í einni
   færslu). `ingestNfl` keyrir 10.000 hermanir á eftir Elo (8 s); cron `maxDuration` 300.
5. **`bracket.ts`** - `todayBracket`, `likelyBracket` (gráðug sætaúthlutun, Elo-uppáhald
   vinnur), `probCell`.
6. **Síður** - `/nfl/urslitakeppni` (tré í dag / líklegast, líkindatafla), merki og
   "Úrslitak." á stöðunni, fjórði flipi í undirvalmynd (passar á 375 px).
7. **Staðfest** - 1.041 próf, build, ekkert flæðir út fyrir á 375 px á neinni NFL-síðu.

Útgáfa aðeins eftir "full send".
