/**
 * Read ChatGPT's JSON reply and write the summaries that pass the checks
 * (length, known link, no eight words copied from the source).
 * Usage: cd web && npx tsx scripts/nfl-news-import.mts ../nfl-svar.json [--model "heiti"] [--dry]
 *   --dry  check only, write nothing
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { parseReply } = await import(join(webDir, 'src/lib/nfl/news.ts'))
const { writeSummaries } = await import(join(webDir, 'src/lib/nfl/newsIngest.ts'))
const file = process.argv[2]
if (!file) { console.error('Vantar skrá: npx tsx scripts/nfl-news-import.mts <svar.json>'); process.exit(1) }
const i = process.argv.indexOf('--model')
const model = i > 0 ? process.argv[i + 1] : 'ChatGPT (handvirkt)'
const dry = process.argv.includes('--dry')
const { written, rejected } = await writeSummaries(parseReply(readFileSync(file, 'utf-8')), model, dry)
console.log(`${written} ${dry ? 'myndu skrifast (--dry, ekkert skrifað)' : 'skrifaðar'}`)
if (rejected.length) console.log(`${rejected.length} hafnað:\n  ${rejected.join('\n  ')}`)
