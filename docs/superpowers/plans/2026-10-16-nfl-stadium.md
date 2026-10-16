# NFL Stadium Implementation Plan

**Goal:** Implement the supplied NFL visual with functioning forecasts and accessible animation.
**Architecture:** Server page loads existing NFL model and simulation. Pure dashboard transformations provide typed rows; a client dashboard handles filters, sorting and expansion. A separate lazy Three.js component renders the ball. CSS module scopes the stadium and motion.
**Tech Stack:** Next.js 16, React 19, Three.js, CSS Modules, Vitest.

- [x] Add dashboard transformation tests: completed wins, ties, remaining forecasts, exclude postseason, missing simulations, conference selection, division means.
- [x] Implement web/src/lib/nfl/dashboard.ts and run its tests.
- [x] Add NflFootball.tsx, NflDashboard.tsx, NflStadium.module.css; use a procedural leather texture and 3D laces, independent luminous orbit trails, static fallback, reduced-motion and pause support.
- [x] Integrate /nfl page and layout; keep weekly games and news, retain links to every existing NFL section. Scope shared header/main appearance using the NFL wrapper's presence.
- [x] Verify TypeScript, NFL tests, production build and desktop/mobile browser interactions. Review diff and retain work in the existing clean nfl-qb worktree.

Validation: 195 NFL tests pass; TypeScript and production build pass. Browser checks at 1672px and 390px cover filters, expansion, sorting, pause, rendered WebGL, no document overflow, and existing standings navigation. Fixed browser/server Icelandic number-format hydration mismatch using deterministic separators. Independent code review found no actionable issues.
