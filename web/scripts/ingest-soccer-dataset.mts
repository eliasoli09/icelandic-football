/**
 * Load a competition from the soccer-dataset export into `matches`.
 *
 * Run scripts/export-backtest-data.mts first — this reads the CSVs it writes.
 * Club names follow the same football-data.co.uk convention the feed leagues
 * use, so a club that moves between divisions resolves to one row and keeps
 * one rating.
 *
 * Usage: cd web && npx tsx scripts/ingest-soccer-dataset.mts championship
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const DATA = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/sd'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

/** our league key -> the dataset's league id */
const MAP: Record<string, number> = {
  championship: 2,
  eredivisie: 13,
  primeira: 14,
}
const key = process.argv[2] ?? ''
const datasetLeague = MAP[key]
if (!datasetLeague) throw new Error(`óþekkt deild: ${key} (${Object.keys(MAP).join(', ')})`)

const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { datasetMatchId } = await import(join(webDir, 'src/lib/leagues.ts'))
const SECRET = process.env.CRON_SECRET!

const teamName = new Map<string, string>()
for (const line of readFileSync(join(DATA, 'bt_teams.csv'), 'utf-8').split('\n').slice(1)) {
  if (!line) continue
  const i = line.indexOf(',')
  teamName.set(line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '').trim())
}

const ids = new Map<string, number>()
{
  const { data } = await db().from('teams').select('id, name')
  for (const t of (data ?? []) as { id: number; name: string }[]) ids.set(t.name, t.id)
}
async function ensureTeam(name: string) {
  if (ids.has(name)) return ids.get(name)!
  const { data, error } = await db().rpc('rpc_ensure_team', { p_secret: SECRET, p_name: name })
  if (error) throw error
  ids.set(name, data as number)
  return data as number
}

/** European seasons run August to May, so a January match belongs to the year before. */
const seasonOf = (date: string) => {
  const [y, m] = date.split('-').map(Number)
  return m >= 7 ? y : y - 1
}

const rows: Record<string, unknown>[] = []
let skipped = 0
for (const line of readFileSync(join(DATA, 'bt_fixtures.csv'), 'utf-8').split('\n').slice(1)) {
  if (!line) continue
  const [id, date, league, home, away, gh, ga] = line.split(',')
  if (Number(league) !== datasetLeague) continue
  const hn = teamName.get(home), an = teamName.get(away)
  if (!hn || !an) { skipped++; continue }
  rows.push({
    id: datasetMatchId(Number(id)),
    season: seasonOf(date),
    league: key,
    phase: 'main',
    date: `${date}T00:00:00Z`,
    venue: null,
    home_team: await ensureTeam(hn),
    away_team: await ensureTeam(an),
    home_goals: Number(gh),
    away_goals: Number(ga),
    status: 'played',
  })
}

for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db().rpc('rpc_upsert_matches', { p_secret: SECRET, p_rows: rows.slice(i, i + 500) })
  if (error) throw error
}
const seasons = new Set(rows.map((r) => r.season)).size
console.log(JSON.stringify({ league: key, matches: rows.length, seasons, skippedUnknownTeam: skipped }, null, 1))
