# League light waves

**Goal:** Animate the reference's fine light ribbons behind the existing dashboard hero, with the active league's accent.

**Architecture:** A reusable client component owns a Canvas 2D renderer, elapsed animation time, observers and pointer smoothing. Pure ribbon geometry and quality settings live beside it. No new dependencies or changes to data, navigation or other dashboard sections. Canvas was chosen over WebGL for small, antialiased paths and a simpler lifecycle; translating an SVG cannot deliver the requested deformation.

**Design:** Three ribbons share coherent, slowly changing curves. Their twist opens and compresses the thread spacing. Separate traveling light packets illuminate individual threads. Sparse particles follow the flow. Strong light sits to the right, behind the featured fixture, with a dark left scrim and soft edge masks. The hero uses the existing league palette and crossfades colour without resetting geometry. Reduced motion draws the same composition once.

## Implementation and verification

- [x] Add behavioral tests for changing curvature, coherent neighbors, mobile budgets, pixel-density limits and control clamping.
- [x] Implement the pure ribbon field and quality selection in `web/src/components/LightWaves/field.ts`.
- [x] Implement the reusable Canvas component and scoped CSS. Expose speed, amplitude, thread count, brightness, particle count and mouse influence. Cap DPR at 1.75 desktop / 1.5 mobile. Stop offscreen and in hidden tabs; redraw a static frame for reduced motion. Dispose RAF, media listeners, pointer listeners and observers on unmount.
- [x] Replace only the dashboard hero pitch texture and add a dark card backing. Reuse the existing league theme; retain the Canvas across league changes.
- [x] Run `npm test` and `npm run build` in `web`.
- [x] Observe live rendering at desktop and phone widths over a full 12–20 second motion interval. Check colour switching, pointer/scroll interaction, offscreen suspension, reduced motion and console output. Record results here.

The user explicitly requested immediate implementation; proceed in this task without a separate design approval checkpoint.


## Verification results

- `npm test`: 119 tests passed in 16 files on the final run, including six new ribbon geometry / quality tests.
- `npm run build`: production compilation, TypeScript and static generation completed successfully; the temporary `/wave-check` page is absent from the built routes.
- Live browser checks at 1440×1000, 390×844 and 320×740. The hero fits the available width; at 390 px the complete document is 390 px wide. The narrower 320 px view still has a small overflow in existing lower dashboard content, outside the hero.
- Besta gold and Lengjudeild blue checked through the actual league picker, including intermediate colour blending. Canvas remains mounted across league changes. Dark hero text also checked in light site mode.
- A temporary local harness mounted the real component and counted Canvas paints. Desktop ran for more than 2,000 frames; mobile for more than 1,800 additional frames. Representative mobile measurements were 60 fps with 4.2–4.6 ms p95 callback duration. These are browser viewport tests on the development machine, not physical phone benchmarks.
- Simulated `prefers-reduced-motion` change: paint counter stayed at 2,107, 0 fps, unchanged pixel hash. Simulated hidden-document event: counter stopped at 2,117. Actual scroll out of view: counter stopped at 4,010 with canvas bottom at −815.5 px. Unmount: counter stopped at 4,014 and canvas was absent. DPR 3 on a 358×380 region produced a 537×570 backing canvas (1.5× cap).
- Independent code review verified lifecycle/timing/cleanup and identified two visual issues. Both fixed: decoration inherits the hero's rounded corners, and the atmosphere now uses the same interpolated palette as the filaments.
- Existing browser hydration warnings originate from locale formatting of the navigation timestamp (server Icelandic date versus browser fallback locale). These were present before the feature and are outside this hero-only change.
- No dependencies added. Existing concurrent edits to league data/loading/theme configuration were preserved.

## Tuning

`LightWaves` accepts `color`, `speed`, `amplitude`, `threadCount`, `brightness`, `particleCount`, `mouseInfluence`, and `className`. Defaults and safe bounds live in `web/src/components/LightWaves/field.ts`. Counts are totals across the three layers; mobile uses 50% of the threads and 40% of the particles. `speed={0}` freezes the field while still allowing palette interpolation; reduced-motion suspends the animation loop entirely.
