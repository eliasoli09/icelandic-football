/**
 * Load Premier League per-player, per-gameweek stats from the Fantasy Premier
 * League open dataset into `fpl_gw`.
 *
 * The repo is plain CSV in git — no scraping and no API key — and it carries
 * expected goals/assists, which no Icelandic source provides. Refresh it with
 * `git -C <repo> pull` before running.
 *
 * Usage: cd web && npx tsx scripts/ingest-fpl.mts [season ...]   (default: current)
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const REPO = '/Users/elias/FH leikmenn/Fantasy-Premier-League'
const seasons = process.argv.slice(2).length ? process.argv.slice(2) : ['2026-27']
const { db } = await import(join(webDir, 'src/lib/db.ts'))

/** Minimal CSV reader: the feed quotes fields containing commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const head = rows.shift()!
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

const COLS = ['fixture','name','position','team','opponent_team','was_home','kickoff_time','minutes','starts',
  'goals_scored','assists','clean_sheets','goals_conceded','own_goals','penalties_saved',
  'penalties_missed','saves','yellow_cards','red_cards','bonus','bps','influence','creativity',
  'threat','ict_index','expected_goals','expected_assists','expected_goal_involvements',
  'expected_goals_conceded','defensive_contribution','tackles','recoveries',
  'clearances_blocks_interceptions','total_points','value','selected','team_h_score','team_a_score']

let total = 0
for (const season of seasons) {
  const file = join(REPO, 'data', season, 'gws', 'merged_gw.csv')
  if (!existsSync(file)) { console.log(`${season}: merged_gw.csv fannst ekki — sleppi`); continue }
  const rows = parseCsv(readFileSync(file, 'utf-8'))
  const out = rows.map((r) => {
    // one row per player per FIXTURE — double gameweeks give a player two
    const o: Record<string, unknown> = { season, gw: Number(r.GW ?? r.round), element: Number(r.element) }
    for (const c of COLS) o[c] = r[c] ?? ''
    // the feed writes booleans as True/False
    o.was_home = /^true$/i.test(String(r.was_home)) ? 'true' : /^false$/i.test(String(r.was_home)) ? 'false' : ''
    return o
  }).filter((o) => Number.isFinite(o.gw as number) && Number.isFinite(o.element as number))

  // the feed carries a handful of exact duplicate rows; last one wins
  const byKey = new Map<string, Record<string, unknown>>()
  for (const o of out) byKey.set(`${o.gw}|${o.element}|${o.fixture}`, o)
  const deduped = [...byKey.values()]
  if (deduped.length !== out.length) {
    console.log(`  ${out.length - deduped.length} tvítekin röð fjarlægð`)
  }
  out.length = 0; out.push(...deduped)

  for (let i = 0; i < out.length; i += 500) {
    const { error } = await db().rpc('rpc_upsert_fpl_gw', {
      p_secret: process.env.CRON_SECRET!, p_rows: out.slice(i, i + 500),
    })
    if (error) throw error
  }
  const gws = new Set(out.map((o) => o.gw)).size
  console.log(`${season}: ${out.length} raðir úr ${gws} umferðum`)
  total += out.length
}
console.log(`alls: ${total} raðir`)
