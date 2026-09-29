# Gold ribbon studio

`golden-ribbons.blend` is an editable Blender 5.2 scene built for the Besta spáin entrance and home-page wave background. It contains three authored Bezier guide curves, 96 individual fine filaments, sparse gold dust, a dark orthographic composition and subtle compositor halation. Press Space in Blender to play the 20-second deformation study (frames 1–600 at 30 fps). It is a continuous excerpt starting at browser wave time 7.5; its noncommensurate currents deliberately do not close into a repeating loop. The browser continues its clock without restarting.

The three `GUIDE_1`–`GUIDE_3` objects are hidden from the render and viewport by default. Unhide them in the Outliner to edit their Bezier control points. The individual filaments remain separate curve objects with named shape keys. Their animation bakes the same three coherent currents, spatial warp and strand offsets as the browser at one-third-second intervals, with linear interpolation between neighbouring poses. Warm gold and occasional champagne filaments are brightest towards the right so the heading area remains quiet.

## Real-time website connection

The Blender build script samples the actual evaluated Bezier handles and writes 17 points per layer into `web/src/components/LightWaves/ribbon-guides.json`. Coordinates are normalized: x increases to the right, y increases down the hero area and spread is the full ribbon width divided by the hero height. Depth is a relative layer parameter.

The website uses those guide shapes as the basis of its own time-driven Canvas animation. Browser rendering adds continuous deformation and lighting, responsive quality settings and the intro-to-home transition. The Blender studio is an editable design source and animation study; the website does not play a rendered video, move a background image or directly execute Blender shape keys.

`golden-ribbons-preview.png` is a reference still only. It is not used as the animated website background.

## Rebuild

Run from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/entrance/build_ribbons.py
```

This rebuilds the studio file, exports the guide JSON and renders the preview. To change the guide design permanently, update the `controls` arrays in the build script; rebuilding recreates the scene. The script uses Blender 5.2's compositor node-group API. No external asset or font dependencies are needed.

Verify actual evaluated curve deformation and the guide export with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/entrance/golden-ribbons.blend --python assets/entrance/verify_ribbons.py
```
