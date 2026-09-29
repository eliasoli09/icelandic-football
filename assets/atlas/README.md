# Heimavellir Íslands

Open `iceland-football.blend` in Blender 5.2 or newer. The delivery camera has a gentle 12-second move at 30 fps, frames 1–360, with the matching loop pose keyed at 361. All 24 official crest images and the paper/wood textures are packed. The file retains separate named, editable materials, curves, pins, camera and lights. Each pin root contains its club id, league, stadium and latitude/longitude as custom properties.

The interactive version is `/kort` in the existing Next.js application. Click a pin or select a club in the list to zoom and read the facts. The fixture list uses both 2026 leagues from the existing database. Match routes join actual ground anchors and use the two club colours. Distances use a 6371.0088 km mean Earth radius and great-circle interpolation; they are explicitly labelled as straight-line distances, not driving routes. The website owns facts and click handlers; these are not Blender viewport UI controls.

## Provenance and geography

The table, folded parchment, engraved coastline/glaciers, brass compass and animated camera were authored using Higgsfield's native Blender worker: https://higgsfield.ai/3d-jutsu/ef849712-5176-4991-8ddd-4a490ec4daa6 (committed revision 3). Its downloadable source is retained as `higgsfield-base.blend`. Higgsfield's importer accepts catalog models only, so official badge image textures and geographic pin tips were added locally in Blender with `finish_blender.py`.

Coastlines and glacier polygons are Natural Earth's public-domain 1:10m vectors: https://www.naturalearthdata.com/downloads/10m-physical-vectors/ and https://github.com/nvkelso/natural-earth-vector/tree/master/geojson. Paper aging is decorative. All map coordinates use the same equirectangular projection, centred on 65°N, 19°W with a 65°N standard parallel. One degree of latitude maps to 0.21 scene metres. Blender uses north=+Y, up=+Z; glTF uses north=−Z, up=+Y.

Ground coordinates, competition membership, histories and original crest sources are documented in `../../docs/atlas-sources.md`. The snapshot contains the men's 2026 Besta deild and Lengjudeild, twelve clubs each. Badge heads are separated in crowded areas, with brass stems leading to the unaltered ground coordinates. In particular, the latest documented Stjarnan venue is Miðgarður; Grindavík is at Stakkavíkurvöllur in Grindavík. Facts explain temporary venue and club-history distinctions.

## Rebuild the deliverables

From the repository root on this Mac:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/atlas/higgsfield-base.blend --python assets/atlas/finish_blender.py
```

This reads `web/src/lib/atlas/clubs.json` and the original PNGs in `web/public/atlas/badges/`. It writes the packed `.blend`, `web/public/atlas/iceland-football.glb`, `web/public/atlas/preview.jpg` and `web/src/lib/atlas/pin-layout.json`. Static engraving geometry is consolidated only after saving the editable Blender file, to reduce browser draw calls. Browser lighting is calibrated separately because Blender exports punctual lights in candela.

`build_higgsfield.py` is the first remote scene edit; inject `web/src/lib/atlas/coastline.json` as `COASTLINES` before executing it. The second edit is `detail_higgsfield.py`, with `glaciated_areas.json` injected as `GLACIERS`. The retained base file includes the final corrected land UV map.

```sh
cd web
npm test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3002
```

The 3D renderer loads only on `/kort`, caps pixel ratio, pauses while hidden or outside the viewport, supports reduced motion, and releases WebGL resources on unmount. HTML club and fixture controls remain available if 3D loading fails.

## Validation — 12 September 2026

- Full Vitest suite: 28 files, 220 passing tests. Atlas tests cover the 12+12 roster, PNG badge assets, all pin anchors, projection, great-circle distances, fixture filtering, search and pointer/pinch classification.
- Production build: successful, including TypeScript and the prerendered `/kort` route.
- Blender: 24 unique club roots and badge faces; all 26 image textures packed; camera changes between frames 1 and 181 and returns exactly at 361; 360 frames at 30 fps.
- Live browser: desktop 1280×720 and phone viewport 390×844; no horizontal overflow on phone. Verified both twelve-club filters, 298 fixtures, canvas-pin selection, zoom/reset, fact sheets, and match routes. FH–KA shows 253 km; Vestri–Grindavík shows 250 km. Latest browser warning/error log is empty.
- Touch gesture classification is unit-tested; the phone layout was tested in a browser viewport, not on physical phone hardware. Reduced-motion and visibility handling were checked in code, not through OS-level motion-setting emulation.

The complete club atlas is the local `.blend` and website. The Higgsfield preview retains the environment before the local official-badge finishing step. Nothing has been committed, pushed or deployed by this atlas task.

### Capital-area focus and isolated club selection

The map's `Höfuðborgarsvæðið` button clears the current club/match selection and smoothly frames all capital-area pin heads and ground tips. Selecting a club, either on the canvas or in the catalogue, hides every other club pin. A selected fixture shows only its two clubs and the route. `Sýna öll lið` clears the selection and restores pins for the current league filter.

Verified in the production preview at 1280×900 and 390×844: capital-area framing, direct FH pin clicks, all other pins disappearing, FH–KA retaining both pins and 253 km, and restoring the full map. No phone horizontal overflow or browser warnings/errors. The 16 existing atlas tests and a fresh production build pass.
