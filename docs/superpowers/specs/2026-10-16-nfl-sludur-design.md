# NFL-miðillinn, áfangi 2: slúðrið og skiptafresturinn

Dagsetning: 16. október 2026. Grein: `nfl-sludur`. App: `nfl-web/`.
Skiptafresturinn: þriðjudaginn 10. nóvember 2026 kl. 16 að austurtíma = **21:00 UTC**
(sumartími endar 1. nóv, svo EST, UTC−5). Heimild: NFL.com, "2026-27 important dates".

## Ákvarðanir Eliasar
- Slúður og staðfest skipti, með niðurtalningu.
- Vélin stingur upp (finnur slúður, samantekt), ritstjóri staðfestir skipti og merkir hita.

## Gögn (`supabase/migrations/013_nfl_rumours.sql`)
- `nfl_news` fær `rumour boolean` (sjálfgefið false) og `heat` (`heitt` | `volgt` | `kalt` | null).
  `rpc_insert_nfl_news` les `rumour` úr röðinni. Eldri fréttir fá `rumour` með sömu reglu (SQL).
  Ritstjórar mega uppfæra `nfl_news` (RLS: `is_nfl_editor()`); lesendur lesa áfram.
- `nfl_trade`: `id`, `traded_on` (dagur), `moves jsonb` (`[{player, from, to}]`), `compensation`
  (texti), `source_url`, `created_by`, `created_at`. Allir lesa; ritstjórar skrifa.

## Greining (`lib/nfl/rumours.ts`, hreint)
- `isRumour(text)`: orð eins og trade(d|s|ing), acquire(d|s), deal for, trade talks/market/block/
  request, shopping, on the block, sign-and-trade, swap. Ekki "trade deadline" eitt og sér í
  fyrirsögn um annað. Prófað á dæmum.
- `TRADE_DEADLINE`, `countdown(now)`: dagar, klst, mín; null eftir frestinn.
- Samantektir: slúður fer fremst í `pendingNews` (bæði sjálfvirkt og ChatGPT-prompt).

## Síður
- `/sludur` (flipinn "Slúður"): niðurtalning, staðfest skipti, slúðrið (samantekt, heimild,
  tengill, hiti), sía eftir liði.
- `/ritstjorn/sludur`: fréttir síðustu 14 daga með rofa "slúður" og hitahnöppum; form fyrir
  staðfest skipti (leikmenn, frá, til, á móti, heimild); listi yfir skráð skipti með eyðingu.

## Prófanir
`isRumour`, `countdown`; RLS á lifandi grunni (lesandi getur ekki skrifað skipti eða hita,
ritstjóri getur). Útgáfa: localhost, svo "full send".
