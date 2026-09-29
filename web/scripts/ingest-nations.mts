/**
 * National-team matches from eloratings.net into nations_matches.
 *   npx tsx scripts/ingest-nations.mts            # latest results + fixtures
 *   npx tsx scripts/ingest-nations.mts --history  # also every UEFA nation's full history
 * History = one request per nation, 1 s apart (~1 min). The daily cron only
 * does the first form.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const N = await import(join(webDir, 'src/lib/nations.ts'))

if (process.argv.includes('--history')) {
  const { teams, tourn } = await N.codeMaps()
  const fixtures = await (await fetch('https://www.eloratings.net/fixtures.tsv')).text()
  // UEFA nations = everyone in a Nations League fixture
  const codes = new Set<string>()
  for (const line of fixtures.split('\n')) {
    const c = line.split('\t')
    if (/^EN[A-D]$/.test(c[5] ?? '')) { codes.add(c[3]); codes.add(c[4]) }
  }
  const all = new Map<string, unknown>()
  for (const code of codes) {
    const name = teams.get(code)
    if (!name) continue
    const r = await fetch(`https://www.eloratings.net/${name.replace(/ /g, '_')}.tsv`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; islensk-fotbolti.vercel.app)' },
    })
    if (!r.ok) { console.warn(`${code} ${name}: HTTP ${r.status}`); continue }
    for (const row of N.parseResults(await r.text(), teams, tourn)) all.set(row.key, row)
    await new Promise((res) => setTimeout(res, 1000))
  }
  console.log('history rows:', all.size, 'nations:', codes.size)
  console.log('written:', await N.upsertNations([...all.values()]))
}
console.log(JSON.stringify(await N.refreshNations()))
