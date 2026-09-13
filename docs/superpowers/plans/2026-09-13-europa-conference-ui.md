# Europa and Conference interfaces

Goal: extend the approved Champions League layout to both requested competitions, preserving real data, sorting, model disclosure and all rows.
Architecture: one server-rendered CompetitionPage and tokenized CSS for all three competitions; separate ChampionsBackground and TournamentBackground. Keep database reads/filter semantics unchanged. Use original supplied trophy references as transparent cutout assets, no generic invented trophies or logos. No new dependencies or publishing.

- [x] Add typed competition definitions and test fallback/three distinct themes; use definitions in page filtering and links.
- [x] Generalize ChampionsPage into CompetitionPage: titles, scoped IDs, existing standings/fixtures/model explanation, Next Links with scroll=false and stable table state per competition.
- [x] Replace hardcoded CSS colors with shared competition tokens; preserve UCL values, add orange/copper and green/mint palettes, opaque panels and subtle borders. Keep all columns and same grid geometry.
- [x] Prepare two trophy cutouts from supplied references and persist under web/public/uefa, documenting provenance and prompts.
- [x] Implement independent decorative SVG chevrons/ribbons, masked trophy lighting, mobile reductions, visibility/reduced-motion lifecycle and cleanup, with geometry/lifecycle tests.
- [x] Run full suite, TypeScript/production build; inspect real desktop/mobile views, rows, tabs, sorting, disclosure, errors, animation and stationary data; capture screenshots for both themes.

The user's detailed designs authorize immediate implementation. No additional design approval is required. Shared UI and independent backgrounds can be implemented concurrently using dispatching-parallel-agents. Existing working tree changes are preserved.

## Validation — 13 September 2026

- Full Vitest suite: 34 files, 241 tests passed. After final curve/asset-position refinements: both affected test files, 8 tests passed.
- Final production build passed compilation, TypeScript and page generation. `git diff --check` clean.
- Running production preview: UEL has 36 standings rows and 144 upcoming fixtures; UECL has 36 rows and 108 fixtures. Existing database filtering and raw probabilities retained; no mock data inserted.
- All three competition links verified; UCL retained blue tokens and 36 rows. Native clicks UEL ↔ UECL preserved scrollY=160 in both directions. Locator-click auto-scroll initially gave a false alarm; native browser clicks isolated that test-tool behavior.
- Both SVG geometries observed changing over time in the running browser. Sharp UEL contours and continuously deforming UECL cubics; one active background after each transition. Off-screen rendering paused (data-running=false at scrollY=4006).
- Desktop 1440×900 and mobile 390×844 visually reviewed. Both mobile pages have scrollWidth=390, all 36 rows and 7 table columns; table region 334px with 690px scroll width. Keyboard Tab reached the last column and scrolled the table 356px; Enter sorted it.
- Model disclosure opened/closed using Enter. Rating/points sorting checked. Browser warning/error log empty.
- Reduced motion, hidden-tab lifecycle, cleanup and frame-independent movement verified by automated lifecycle tests and CSS inspection; no OS-level reduced-motion emulation was performed.
- Screenshots: ../../screenshots/uel-desktop.png, uel-mobile.png, uecl-desktop.png, uecl-mobile.png.
- Trophy asset provenance and prompts: ../../uefa-trophy-assets.md.
