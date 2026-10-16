# NFL-ritstjórn: útfærsluáætlun

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Drög að greinum úr NFL-gögnunum, ritstjórn á `/ritstjorn` og birtar greinar á `/nfl/greinar`.
**Architecture:** Hrein föll (slots, facts, writer, markdown) prófuð í vitest; cron-skref skrifar drög um secret-RPC; ritstjórar skrifa beint með RLS; síður lesa birtar greinar.
**Tech Stack:** Next 16, Supabase (RLS, plpgsql), vitest.

Spec: `docs/superpowers/specs/2026-10-16-nfl-ritstjorn-design.md`.

- [ ] 1. `lib/nfl/articles/slots.ts` + `test/nfl-article-slots.test.ts`
- [ ] 2. `lib/nfl/articles/facts.ts` + `test/nfl-article-facts.test.ts` (fixture `nfl-2025.csv`)
- [ ] 3. `lib/nfl/articles/writer.ts` + `test/nfl-article-writer.test.ts`
- [ ] 4. `lib/nfl/articles/markdown.tsx` + `test/nfl-article-markdown.test.tsx`
- [ ] 5. Migration `012_nfl_article.sql`, beita, RLS-próf afturkallað, Elias ritstjóri
- [ ] 6. `lib/nfl/articles/ingest.ts` (drög + sjálfvirkur texti) tengt aftast í `ingestNfl`
- [ ] 7. `/ritstjorn` og `/ritstjorn/[id]`
- [ ] 8. `/nfl/greinar`, `/nfl/grein/[slug]`, reitir á Vikunni og leikjasíðunni
- [ ] 9. Keyra cron-skrefið einu sinni (drög fyrir viku 6-7), localhost-yfirferð, hvelfing
