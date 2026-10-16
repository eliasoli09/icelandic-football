# NFL stadium design
Implement the user's supplied reference in the latest NFL checkout, nfl-qb-wt. The request explicitly authorizes implementation (GO).

Create a navy stadium landing page at /nfl, with a large procedural 3D rotating American football, cyan/red orbit trails, spacious title, AFC/NFC/Super Bowl filters, forecast table and division strength card. Preserve existing NFL navigation, weekly games and news below the new dashboard. Use current Elo, actual completed wins plus expected remaining wins, and stored simulation probabilities. Never substitute reference-image numbers for real data. Missing simulation values render as unavailable. Scope the theme to NFL routes, support mobile, reduced motion, pause control and no-WebGL fallback.

Use existing Three.js, CSS modules and server queries. Keep animation lifecycle and data transformation separate from the dashboard. Verify derived data with unit tests, TypeScript, production build and browser inspection of desktop/mobile, filters and motion controls.
