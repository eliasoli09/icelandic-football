/**
 * The daily player, day by day, written down so that adding players never
 * changes a puzzle someone has already played. Days up to tomorrow keep the
 * player they have; the days after draw first from players not yet used, in a
 * scrambled order that spreads Icelanders and others evenly, and then start
 * the cycle again. The first run takes the days already played from the order
 * the game used before (--seed-from, the players.json of that time).
 *
 * Usage: cd web && npx tsx scripts/hver/schedule.mts [--seed-from old-players.json] [--days 400]
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
const { dailyOrder, dayNumber } = await import(join(webDir, 'src/lib/topp10/daily.ts'))
const { LAUNCH_DAY } = await import(join(webDir, 'src/lib/hver/game.ts'))
type P = { id: string; level: 'easy' | 'medium' | 'hard'; region: string }

const arg = (name: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
const OUT = join(webDir, 'src/lib/hver/schedule.json')
const players: P[] = JSON.parse(readFileSync(join(webDir, 'src/lib/hver/players.json'), 'utf-8'))
const ids = new Set(players.map((p) => p.id))
const horizon = Number(arg('--days') ?? 400)
const today = dayNumber(new Date())
const frozen = today + 1 - LAUNCH_DAY // index of tomorrow

const existing: { start: number; days: Record<string, string[]> } = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf-8'))
  : { start: LAUNCH_DAY, days: {} }
const seedFrom = arg('--seed-from')
const old: P[] | null = seedFrom ? JSON.parse(readFileSync(seedFrom, 'utf-8')) : null

const days: Record<string, string[]> = {}
for (const level of ['easy', 'medium', 'hard'] as const) {
  let kept = (existing.days[level] ?? []).slice(0, frozen + 1)
  if (!kept.length && old) {
    // the order the game used before there was a schedule
    const order = dailyOrder(old.filter((p) => p.level === level))
    kept = Array.from({ length: frozen + 1 }, (_, i) => order[i % order.length].id)
  }
  if (kept.some((id) => !ids.has(id))) throw new Error(`${level}: leikmaður sem þegar hefur verið þraut er horfinn úr players.json`)
  const order: string[] = dailyOrder(players.filter((p) => p.level === level)).map((p: P) => p.id)
  const plan = [...kept]
  // finish the cycle in progress with players not yet used, then cycle through everyone
  const used = new Set(kept.slice(-order.length))
  plan.push(...order.filter((id) => !used.has(id)))
  while (plan.length < frozen + horizon) plan.push(...order)
  days[level] = plan.slice(0, frozen + horizon)
}
writeFileSync(OUT, JSON.stringify({ start: LAUNCH_DAY, days }) + '\n')
console.log(Object.entries(days).map(([l, d]) => `${l}: ${d.length} dagar, ${new Set(d).size} leikmenn`).join('; '))
