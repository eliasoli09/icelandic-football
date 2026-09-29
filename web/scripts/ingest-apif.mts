/**
 * Pull an API-Football competition into the database.
 * Usage: cd web && npx tsx scripts/ingest-apif.mts premier 2024
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const [league = 'premier', season = '2024'] = process.argv.slice(2)
const { ingestApifLeague } = await import(join(webDir, 'src/lib/apifIngest.ts'))
console.log(JSON.stringify(await ingestApifLeague(league, Number(season)), null, 1))
