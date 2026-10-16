# NFL-síðan: undirbúningur opinberrar kynningar

Dagsetning: 16. október 2026. Grein: `nfl-kynning`. Síðan: `nfl-web/` (nfl-island.vercel.app).

## Innihald
1. **Vefkort** (`app/sitemap.ts`): fastar síður, birtar greinar og leikir tímabilsins.
   **`app/robots.ts`**: allt opið nema `/ritstjorn` og `/api`.
2. **Deilimyndir** (`opengraph-image.tsx`, 1200×630, Inter úr `src/assets`):
   - forsíðan: nafn síðunnar og hvað hún býður
   - `/spa`: spáleikurinn
   - `/grein/[slug]`: tegund, fyrirsögn og inngangur
   - `/leikur/[id]`: merki liðanna, líkur líkansins fyrir leik eða úrslit
   - Twitter-spjald `summary_large_image` á öllu.
3. **Mæling:** Vercel Web Analytics (`@vercel/analytics`), án vafrakaka og án persónugagna.
   Kveikt á mælingunni í Vercel-verkefninu `nfl-island`.
4. **Tákn** (`app/icon.tsx`): "NFL" á dökkbláum grunni í stað fótboltatáknsins.
5. **`/um`:** hvað síðan er, hvaðan gögnin koma (nflverse, RSS-heimildir), hvernig spárnar
   virka, og að greinar eru skrifaðar með aðstoð gervigreindar og yfirlesnar.

## Prófanir
`sitemap` skilar slóðum á réttu léni, myndirnar svara `image/png` á localhost, smíð stenst.

## Útgáfa
localhost, svo "full send" (push á `main` gefur nfl-island út sjálfkrafa).
