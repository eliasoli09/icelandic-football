/**
 * Refresh World Cup fixtures/results + probabilities.
 * Usage: cd web && npx tsx scripts/refresh-wc.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { refreshWorldCup } = await import(join(webDir, 'src/lib/worldcup.ts'))
console.log(JSON.stringify(await refreshWorldCup(), null, 1))
