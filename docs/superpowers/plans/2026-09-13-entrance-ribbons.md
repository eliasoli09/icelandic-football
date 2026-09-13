# Smooth entrance and Blender ribbon refresh

## Scope and design

Implement the supplied black-and-gold reference in the existing home hero and entrance. Keep the lower dashboard and atlas intact. Use Blender as an editable geometry source, then animate its exported guides with the existing Canvas renderer so the website remains interactive and changes colour with the selected league.

## Implementation

- Author three separated Bezier ribbon guides in Blender, with fine gold filaments, champagne highlights, sparse dust and a 20-second deformation study. Export 17 normalized samples per guide to the website.
- Interpolate the exported guides and combine several slow currents to deform the actual geometry. Apply continuous traveling illumination without a modulo-boundary jump. Vary individual filament brightness without independent jitter.
- Extend the entrance to 4.5 seconds. Smoothly decelerate followers, dissolve the balls into the shared ribbon field, settle the viewport onto the measured hero bounds, then crossfade to the live hero using the same clock.
- Prewarm the hero canvas before it appears. Clear the loading watchdog when the renderer and streamed dashboard are ready so it cannot interrupt a started animation.
- Remove the dashboard's old `fade-up` class: re-enabling that animation when the entrance attribute disappeared caused a brief second fade from black after the otherwise continuous handoff.
- Match the reference headline and gold call to action. Reveal real outcome probabilities on match-card hover/focus. Add an accessible replay control after the dashboard.
- Preserve reduced-motion handling, hidden-tab/offscreen pauses, pointer transparency, capped pixel density, phone quality reduction, colour interpolation and effect cleanup.

## Validation

Continuity tests cover phase boundaries, follower velocity, the exact hero destination, the 4.5-second release and continuous traveling illumination. Browser checks exercise the real intro sequence at 1280×720 and 390×844, replay, restored scrolling/focus, the match-card detail state and blue Lengjudeild colour. The phone DOM check reports document width 390, no remaining inert nodes, cleared body overflow and one remaining decorative canvas.

The Blender scene is verified with `assets/entrance/verify_ribbons.py`; rebuild and editing instructions are in `assets/entrance/README.md`. The Blender study is a continuous excerpt, not a closed loop or a video used by the site. Reduced-motion and visibility behavior were reviewed in code; no OS-level reduced-motion emulation or numeric frame-rate benchmark was performed.

Run the production build and tests serially after Blender has finished. A concurrent verification run exceeded the pre-existing season-simulation test's five-second timeout while Blender and the compiler were busy; no assertion in that test failed.

Final test rerun: `npm test -- --maxWorkers=1` passed all 221 tests in 28 files. The Blender verifier passed with 3 guides, 17 samples each, 96 filaments, 28 dust objects and measurable geometry deformation. The final production build passed after removal of the duplicate CSS entrance. A fresh browser run confirmed opacity stays at 1 and animation-name stays none across release, with no console warnings or errors in that run.

## Hover resize regression

The match details previously animated from `0fr` to `1fr`, expanding the hero and repeatedly reallocating its Canvas bitmap. Reproduced with the pointer over the match at a 687px viewport: the bitmap height changed from 779 to 882 pixels during the transition. The details now reserve their intrinsic height and animate opacity/translation only; the card's existing highlight and scale remain.

After the CSS fix, live hover samples stayed constant at hero height 366 / bitmap height 637 on a 1280px viewport, and hero height 652 / bitmap height 650 on a 390px viewport. The latter had no horizontal overflow. The production build and whitespace check passed, and the fresh browser run reported no console warnings/errors. Temporary viewport overrides were reset.
