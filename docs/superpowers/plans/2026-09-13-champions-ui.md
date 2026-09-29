# Champions League interface implementation plan

**Goal:** Implement the supplied Icelandic specification and blue star-ball reference on the existing UEFA page, preserving its real clubs, simulation rows, fixtures and competition selection.

**Architecture:** Keep database reads in the server page. Use a small client standings table for accessible sorting, pure shared formatting/scale helpers and a separate decorative background with a static initial state. Scope the navy palette to the Champions League page only. Use existing React/CSS/SVG capabilities without adding dependencies.

- [x] Verify simulation settings in `web/scripts/uefa.mts`, use a shared run-count constant for the producer and display, and test Icelandic number formatting, probabilities, sorting and shared bar scales in `web/test/uefaDisplay.test.ts` before implementing helpers.
- [x] Preserve the UEFA server query/filter logic and every standings/fixture row. Replace the UCL presentation with a compact hero, competition links, a two-thirds standings panel and a one-third strength panel. Keep other competition presentations unchanged. Put model details in an accessible native disclosure.
- [x] Add `web/src/components/Uefa/UefaStandings.tsx` with real HTML table headers, keyboard-operable sort buttons, stable original rank, linear probability bars and all rows. Preserve raw probabilities; only format their text labels.
- [x] Add isolated CSS module styling with opaque navy panels, readable cyan/violet/neutral probability columns, stable row hover/focus and table-local horizontal overflow on narrow screens.
- [x] Implement `ChampionsBackground` independently: projected spherical star geometry, slow lighting and edge contours, static reduced-motion fallback, bounded pointer response, visibility pause and cleanup. Do not render storyboard panels from the reference.
- [x] Run meaningful tests, production build, inspect actual desktop/mobile animation in the browser, check all rows, sorting, competition navigation, disclosure, keyboard access, console errors and scoped theming. Return desktop/mobile screenshots and concise validation evidence.

The user's detailed reference and GO authorize implementation. No publication or git push is part of this task.

## Validation — 13 September 2026

- Production build succeeded after final interface/background edits, including TypeScript and route generation.
- Display helper tests cover Icelandic formatting, independent percentage rounding, shared scales, missing values and sorting all 36 rows. Geometry tests cover valid paths and the seamless 72-second turn.
- Lifecycle tests verify initial and toggled reduced motion, hidden-tab/offscreen pause and resume without duplicate loops, and observer/listener/RAF cleanup. Reduced-motion behavior was verified through the lifecycle harness and CSS inspection; OS-level media emulation was not performed.
- Live in-app browser checks at 1440 × 900 and 390 × 844: 36 standings rows, 126 upcoming fixtures and 18 results retained. Rating sort works both ways; keyboard Enter sorts the last probability column and scrolls it into view.
- Mobile document width and scroll width both 390 px; 690 px table scrolls inside a 334 px region, preserving every column.
- UEFA competition navigation checked; the new theme is absent on the Europa League view. Model disclosure opens; no warning/error console entries during checks.
- Star path geometry changed over time in the running page. Background data-running changed to false when scrolled offscreen and true on returning. Tables remain opaque and stationary.
- Screenshots: `docs/screenshots/champions-desktop.png` and `docs/screenshots/champions-mobile.png`. Both were captured from the running page, not generated mockups.
- No new dependencies, database writes, commits, push or deployment.
