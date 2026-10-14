# NFL-hornið, verkefni 4b (verðlaun) - framkvæmd

> Skráð sem framkvæmd: hönnunin var samþykkt og Elias bað um að byrjað yrði strax.

Spec: `docs/superpowers/specs/2026-10-14-nfl-verdlaun-design.md`.

1. **Verðlaunasagan** (`awardsParse.ts`, `scripts/nfl-awards.mts`, `data/nfl-awards.json`):
   AP-töflur Wikipedia, 328 sigurvegarar 1957-2025; allir 164 frá 1999 tengdir við
   leikmann með nákvæmri pörun. Wikidata reyndist of gloppótt sem seinni heimild; tímabils-
   síður hafa verðlaunatöflu aðeins 3 af 27 ár (öll sammála). Nafnatvífarar greindir á
   stöðu og nýliðaári; tvö gælunöfn handstaðfest (Mike Vick, Pat Surtain II). Deilt
   1980-verðlaun tvöfölduðu sóknarnýliðann; lagað.
2. **Líkanið** (`awardRace.ts`, `scripts/nfl-award-backtest.mts`, `data/award-models.json`):
   skilyrt logit á stöðunni eftir hverja viku 4-18. Fyrsta keyrsla: frambjóðendahópar misstu
   sigurvegarann (DPOY 25%, CPOY 69%). Greint á þjálfunarárum eingöngu: tæklingar vantaði,
   jardar hlaupara vógu of lítið, comeback = framför, ekki bara meiðsli. Sameinaðir hópar.
   Seinni keyrsla: aðeins OROY (51,6% gegn 17,6%) og DROY (48,4% gegn 22,0%) stöðugt betri
   en viðmiðið; MVP/OPOY/DPOY snerust við milli keyrslna á 11 prófunartímabilum.
3. **Ákvörðun Eliasar:** líkur aðeins fyrir nýliðaverðlaunin; MVP/OPOY/DPOY sýna leiðtoga
   án líka með skýringu; CPOY aðeins sagan.
4. **Síður:** `/nfl/verdlaun` (rofi Tölfræði | Verðlaun undir "Leikmenn"), verðlaunamerki
   á leikmannasíðu. Reiknað á síðunni úr tölfræði tímabilsins; engin ný tafla.
5. **Staðfest:** 1.114 próf, build, ekkert flæðir út fyrir á 375 px.
