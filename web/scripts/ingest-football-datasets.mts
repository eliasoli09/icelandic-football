/**
 * Load a competition's full history from datasets/football-datasets
 * (github.com/datasets/football-datasets) — 33 seasons per league of dated
 * match data with shots, corners and cards. No API key, no scraping.
 *
 * Carries real dates, unlike the KSÍ seasons 2019-2025, so it is the source
 * of record for these leagues. It carries NO bookmaker odds.
 *
 * Usage: cd web && npx tsx scripts/ingest-football-datasets.mts premier
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const REPO = '/Users/elias/FH leikmenn/football-datasets/datasets'
/** folder in the feed -> our league key, and its slot in the id scheme */
const MAP: Record<string, { league: string; idx: number }> = {
  premier: { league: 'premier', idx: 0 },
}
const which = process.argv[2] ?? 'premier'
const cfg = MAP[which]
if (!cfg) throw new Error(`óþekkt deild: ${which}`)
const folder = join(REPO, 'premier-league')

const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { feedMatchId } = await import(join(webDir, 'src/lib/leagues.ts'))
const SECRET = process.env.CRON_SECRET!

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

/** season-9394 -> 1993, season-2526 -> 2025 */
const seasonOf = (file: string) => {
  const m = file.match(/season-(\d{2})(\d{2})/)!
  const a = Number(m[1])
  return a < 50 ? 2000 + a : 1900 + a
}

const files = readdirSync(folder).filter((f) => /^season-\d{4}\.csv$/.test(f)).sort((a, b) => seasonOf(a) - seasonOf(b))
if (!files.length) throw new Error(`engar skrár í ${folder}`)

let total = 0, seasons = 0
for (const file of files) {
  const season = seasonOf(file)
  const text = readFileSync(join(folder, file), 'utf-8')
  const lines = text.split('\n').filter((l) => l.trim())
  const head = lines.shift()!.split(',')
  const col = (r: string[], name: string) => r[head.indexOf(name)] ?? ''
  const rows: Record<string, unknown>[] = []
  for (const [i, line] of lines.entries()) {
    const r = line.split(',')
    const home = col(r, 'HomeTeam').trim()
    const away = col(r, 'AwayTeam').trim()
    const hg = col(r, 'FTHG').trim()
    const ag = col(r, 'FTAG').trim()
    if (!home || !away || hg === '' || ag === '') continue
    const date = col(r, 'Date').trim()
    rows.push({
      id: feedMatchId(season, cfg.idx, i),
      season, league: cfg.league, phase: 'main',
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : null,
      venue: null,
      home_team: await ensureTeam(home),
      away_team: await ensureTeam(away),
      home_goals: Number(hg), away_goals: Number(ag), status: 'played',
    })
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().rpc('rpc_upsert_matches', { p_secret: SECRET, p_rows: rows.slice(i, i + 500) })
    if (error) throw error
  }
  total += rows.length; seasons++
}
console.log(JSON.stringify({ league: cfg.league, seasons, matches: total, teams: ids.size }, null, 1))
