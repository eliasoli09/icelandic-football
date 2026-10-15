/**
 * Print a ready-made ChatGPT prompt with the NFL news items that still lack an
 * Icelandic summary (newest 20 from the last week). See docs/nfl-frettir-chatgpt.md.
 * Usage: cd web && npx tsx scripts/nfl-news-prompt.mts > ../nfl-prompt.txt
 */
import { join } from 'path'
import { webDir } from './_env.mts'

const { pendingNews } = await import(join(webDir, 'src/lib/nfl/newsIngest.ts'))
const { buildPrompt } = await import(join(webDir, 'src/lib/nfl/news.ts'))
const items = await pendingNews()
if (!items.length) {
  console.error('Engar fréttir án samantektar síðustu 7 daga.')
  process.exit(0)
}
process.stdout.write(buildPrompt(items))
console.error(`${items.length} fréttir í promptinum.`)
