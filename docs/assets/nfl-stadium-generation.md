# NFL stadium asset

Tool: built-in image_gen (2026-10-16).
Project asset: ../../web/public/nfl/stadium-night.jpg
Original: /Users/elias/.codex/generated_images/01a1444f-ae0b-77e3-a381-fe50efdca5b8/exec-18743b24-0217-4692-a3f7-71c182a7b612.png
JPEG encoding: quality 88, 576 KB. Original retained.

## Final generation prompt

Create a photorealistic premium American football stadium BACKGROUND ASSET for a dark sports analytics website. Landscape 16:9 composition, high resolution. Camera at field level inside a huge packed NFL-style stadium at night. Real tiered grandstands curve in a broad bowl along left and right edges, thousands of tiny fans and seats softly resolved. Brilliant realistic white and pale blue stadium floodlights cluster along upper left edge and upper right edge, starburst lens bloom and subtle volumetric haze, no obvious triangular geometric beams. The top center and top left-center have very dark navy open atmosphere to support white UI typography. The lower half has subtle realistic dark turf with faint field yard markings in perspective receding toward the middle, no large central logo. Cinematic deep midnight navy and black with rich electric blue edge illumination and tiny restrained red light accents. The stadium fills the frame edge to edge, photographic materials, realistic scale, atmospheric depth. Match a high-end NFL broadcast title screen, understated enough for translucent dark data cards to overlay its lower two thirds. Absolutely no football, no people in foreground, no logos, no lettering, no numbers, no user interface, no graphical rings, no illustration or cartoon. Single seamless full-frame photograph. Save as an image asset for the website.

## Football refinement

The football remains an animated Three.js mesh. Rebuilt its fuller profile, recessed four-panel joins, independent procedural leather color/bump/roughness maps, flat woven laces, eyelets and self-shadowing. Dark brown leather and white/red/blue rim lighting replace the earlier broad red fill. Full spin takes about 29 seconds. Existing pause, reduced-motion, visibility and disposal behavior retained.

Validation: production build and TypeScript pass; browser console has no errors or warnings; desktop screenshot and mobile 390px viewport checked; spinning screenshots change after resume; mobile document width equals viewport width.

## 3D light trails refinement

Replaced CSS ellipses with depth-tested Three.js tube orbits outside the leather. Red and blue cores have layered additive glow, animated comet highlights, moving flare sprites and local light spill. Trails precess gently while the ball spins; rear segments are occluded by the actual ball mesh. Changed ball tilt to match the reference. Removed pause-triggered replay of table entrances and made animation visibility checks recover after viewport changes. Geometry tests verify all three closed paths stay outside the leather and pass through both front and back. Six focused tests, TypeScript and production build pass. Browser checks confirm resumed animation changes frames, no console warnings/errors, and a 390px page fits without horizontal overflow.
