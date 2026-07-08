/**
 * Fetch bookmaker odds for near-term Besta deild fixtures and store them in
 * match_odds. MUST run from an Icelandic/European IP — BetExplorer filters
 * the bookmaker list by visitor country (US datacenter IPs only see 1-2
 * books), which is why this runs from the local scheduled task instead of
 * the Vercel cron. Usage: cd web && npx tsx scripts/fetch-odds.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { refreshOdds } = await import(join(webDir, 'src/lib/odds.ts'))
const result = await refreshOdds()
console.log(JSON.stringify(result, null, 1))
if (result.warnings.length) process.exitCode = 0 // warnings are informational
