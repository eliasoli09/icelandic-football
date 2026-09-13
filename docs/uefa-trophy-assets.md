# UEFA trophy cutouts

Created with the built-in image generation tool from the user-supplied design references on 13 September 2026. These are AI-assisted reference cutouts, not claimed to be official original logo files. No standalone official logo was added.

- `web/public/uefa/uel-trophy.png`: 1024×1536 RGBA. Source: codex-clipboard-3a4772f1-e14f-4003-9522-97008fbc12ff.png.
- `web/public/uefa/uecl-trophy.png`: 1024×1536 RGBA. Source: codex-clipboard-9fd0f2a2-e8ef-4d9d-8680-e1b7755e24c1.png.

Both images have verified transparent corners and real alpha channels. They remain upright in the UI, with slight translation and separate alpha-masked surface lighting; the SVG background is independently animated.

## Prompt set

UEL: Extract only the large Europa League trophy in the upper-right main hero of the supplied mockup. Preserve its recognizable handleless tall flared faceted shape, proportions, base, metal texture and warm rim. Remove all UI, typography, angular background, stage and extra trophies. One centered upright fully visible isolated trophy, genuine transparent alpha, portrait 2:3 with small padding. Cutout rather than redesign; no generic handled cup, added symbols, invented official logo or text.

UECL: Extract only the large silver Conference trophy in the upper-right. Preserve the slender twisted body, vertical ribs, flared open rim, round medallion and proportions. Remove UI, letters, ribbons, stage and extra trophies. Restore the tiny base obscured by the panel consistently with the smaller reference panels. One upright isolated trophy, genuine transparent alpha, portrait 2:3 with small padding. No generic cup or invented logo; retain cool metal and green reflection.

UECL alpha correction: Precise background removal only. Keep the exact ribbed trophy silhouette, details and composition. Remove the gray/white checkerboard including lower openings. Output genuine alpha outside the object, not a painted checker or white background. Do not redraw, stylize, or add text, stage or glow. The initial checkerboard output was discarded; the corrected RGBA output is used.
