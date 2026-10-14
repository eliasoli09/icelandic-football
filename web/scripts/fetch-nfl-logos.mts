/**
 * Save the 32 club logos into public/nfl/ so the site never depends on a
 * third-party image host (comet.ksi.is died under us, Gildrur 26).
 * Usage: cd web && npx tsx scripts/fetch-nfl-logos.mts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { parseCsv } = await import(join(webDir, 'src/lib/nfl/csv.ts'))
const { FRANCHISE } = await import(join(webDir, 'src/lib/nfl/types.ts'))
const csv = await (await fetch('https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv')).text()
const [head, ...rows] = parseCsv(csv) as string[][]
const abbr = head.indexOf('team_abbr')
const logo = head.indexOf('team_logo_espn')
const out = join(webDir, 'public/nfl')
mkdirSync(out, { recursive: true })
let n = 0
for (const r of rows) {
  if (r.length < head.length || FRANCHISE[r[abbr]]) continue
  const res = await fetch(r[logo])
  if (!res.ok) throw new Error(`${r[abbr]}: ${res.status} ${r[logo]}`)
  writeFileSync(join(out, `${r[abbr]}.png`), Buffer.from(await res.arrayBuffer()))
  n++
}
console.log(`${n} merki vistuð í public/nfl/`)
