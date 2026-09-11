# Football entrance

Implement the supplied eight-frame storyboard as an optional, once-per-session
entrance to the existing dashboard. Preserve all current data and league work.

1. Build and test a real truncated-icosahedron football and dependency-free
   WebGL renderer; emboss the supplied PNG alpha onto its gold front panel.
2. Test a single timeline with continuous ball, trail and existing ribbon-field
   geometry. Share its wave clock with the final lightweight Canvas background.
3. Add a reusable client entrance around a streamed dashboard: keyboard/touch
   start, immediate skip, session memory, focus management, reduced motion,
   visibility pause, resource disposal and WebGL failure fallback.
4. Verify complete playback and handoff in the browser at desktop and phone
   dimensions, plus skip, repeat visits, reduced motion and fallback. Run the
   test suite and production build; remove temporary QA scaffolding.

The user explicitly requested immediate implementation; their storyboard and
specification are the approved design. No unrelated page redesign or new runtime
library is needed.

## Implemented and refined on September 11

- Raw WebGL2 renders a real 12-pentagon/20-hexagon ball and instanced followers
  (240 desktop / 96 phone). The supplied alpha PNG is unchanged and embossed
  inside the front hexagon. No runtime dependencies were added.
- One 3.3-second timeline drives the ball, trails and existing `drawWaves`
  renderer. Quintic easing joins acceleration across phases; a curved launch
  and integrated follower deceleration soften the transition into the live field.
  Wave buffers allocate on resize, not on each morph frame.
- The streamed dashboard loads during the opening screen. Start waits for its
  measured hero; Skip and WebGL failure release the real page immediately.
  Session memory, keyboard focus/trap, reduced motion, visibility pause and GPU
  cleanup are implemented. The final hero shares the entrance clock and palette.
- Server/browser Icelandic date differences were causing hydration replacement;
  the navigation label is now formatted on the server and dashboard kickoff
  labels use deterministic Icelandic UTC formatting.

## Verification

- 136 tests pass in 19 files; TypeScript and `git diff --check` pass.
- Browser: full normal desktop and 390 × 844 playback, slower inspection of
  ball-to-thread morph, Enter and Space, static reduced-motion idle (zero RAFs),
  its 180ms dissolve, unavailable WebGL, Skip, and return to `/` in the same
  session. Completion leaves one Canvas, no inert page elements, and heading
  focus. Phone document width equals its 390px viewport.
- Original PNG checksum matches the supplied file. Two read-only code reviews
  were completed; actionable findings were fixed and the final review was clear.
- Temporary `/entrance-check` controls and instrumentation were removed.
- Phone verification used a browser viewport, not a physical handset.
