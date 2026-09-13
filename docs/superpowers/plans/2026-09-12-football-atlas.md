# Iceland football atlas

**Goal:** An editable animated Blender scene and an interactive atlas in the existing Besta spáin website, covering all 24 men's clubs in the 2026 Besta deild and Lengjudeild.

**Design:** A worn parchment chart rests on a walnut table under warm directional light. Accurate Natural Earth coastlines use a shared equirectangular projection centred on 65°N, 19°W. Brass pins have official club crests. Club selection eases the camera toward the home ground and opens a sourced fact sheet. A fixture selector connects the two home grounds with dotted lines in the two club colours. Distances are great-circle kilometres, explicitly labelled as straight-line distances rather than driving routes. Crowded capital-area crests use offset heads with stems leading to the exact ground.

**Architecture:** Higgsfield 3D Jutsu authors the editable table/map/camera scene. Local Blender completes official badge textures (the remote importer only accepts catalog models), adds pins and exports the final packed `.blend` and `.glb`. A lazily loaded Three.js renderer loads that asset on `/kort`; React owns accessible club/fixture controls and facts. Existing match data stays on the server. All atlas state stays independent of the dashboard's league selector.

**Files:** `assets/atlas/` holds Blender source/build scripts; `web/public/atlas/` holds the GLB, preview, textures and badges; `web/src/lib/atlas/` holds checked club data and projection/distance helpers; `web/src/components/Atlas/` owns the renderer and controls; `web/src/app/kort/page.tsx` loads real 2026 fixtures. One `Kort` link is added to navigation.

- [x] Verify 12+12 membership, official crests, venue coordinates and short facts; retain sources and note displaced venues.
- [x] Build and visually inspect the Higgsfield scene from its delivery camera; preserve editable materials, semantic objects and animation.
- [x] Add official crests and geographic pin anchors in local Blender; export a packed source file and portable GLB with a matching preview.
- [x] Test projection, distance symmetry/known values, roster coverage and match filtering before implementing helpers.
- [x] Implement responsive club/fixture UI, smooth camera selection, coloured dotted routes, touch and keyboard access, reduced motion, render suspension and cleanup.
- [x] Inspect the running scene on desktop and phone, exercise selection/routes/reset and check console output.
- [x] Run the full test suite and production build; document evidence and deliver the interactive atlas plus Blender source.

**Validation limits:** Membership is season-specific. Pin coordinates represent the documented home ground, not a claim about every temporary fixture venue. The interface must surface venue exceptions. Decorative aging and lighting must not distort the geographic anchors. Browser facts/click handlers live in the website; Blender delivers the scene and camera animation.

**Evidence:** See `assets/atlas/README.md` for the final Blender, data, browser and build validation, including test limitations.
