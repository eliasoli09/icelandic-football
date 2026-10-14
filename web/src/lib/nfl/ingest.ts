import { db } from '../db'
import { parseGames, parseTeams } from './csv'
import { isPlayed, type NflGame } from './types'

export const GAMES_URL = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'
export const TEAMS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv'
const SECRET = () => process.env.CRON_SECRET!
const BATCH = 500
const STALE_HOURS = 18

export interface NflIngestResult { season: number; games: number; newResults: number; warnings: string[] }

/** The KSÍ scraper once reported newMatches: 0 for six weeks without a word, so say what looks wrong. */
export function ingestWarnings(season: NflGame[], now: Date, expectedTeams = 32): string[] {
  const out: string[] = []
  for (const g of season) {
    const hours = Math.floor((now.getTime() - new Date(g.kickoff).getTime()) / 3600_000)
    if (!isPlayed(g) && hours >= STALE_HOURS) out.push(`${g.game_id}: engin úrslit ${hours} klst eftir upphaf`)
  }
  const teams = new Set(season.filter((g) => g.game_type === 'REG').flatMap((g) => [g.home, g.away])).size
  if (teams !== expectedTeams) out.push(`tímabilið hefur ${teams} lið, ekki ${expectedTeams}`)
  return out
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`nflverse svaraði ${res.status}: ${url}`)
  return res.text()
}

async function call(fn: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db().rpc(fn, { p_secret: SECRET(), p_rows: rows.slice(i, i + BATCH) })
    if (error) throw new Error(`${fn}: ${error.message}`)
  }
}

async function scoredIds(season: number): Promise<Set<string>> {
  const { data, error } = await db()
    .from('nfl_games').select('game_id').eq('season', season).not('home_score', 'is', null).range(0, 999)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.game_id as string))
}

/** Pull nflverse and write it. `all` loads every season since 1999 (one-off backfill). */
export async function ingestNfl(opts: { all?: boolean; now?: Date } = {}): Promise<NflIngestResult> {
  const [gamesCsv, teamsCsv] = await Promise.all([fetchText(GAMES_URL), fetchText(TEAMS_URL)])
  const teams = parseTeams(teamsCsv)
  const games = parseGames(gamesCsv)

  // validate everything before writing anything
  const known = new Set(teams.map((t) => t.abbr))
  const unknown = [...new Set(games.flatMap((g) => [g.away, g.home]))].filter((a) => !known.has(a))
  if (unknown.length) throw new Error(`Óþekkt lið í nflverse: ${unknown.join(', ')}`)

  const season = Math.max(...games.map((g) => g.season))
  const current = games.filter((g) => g.season === season)
  const rows = opts.all ? games : current
  const before = await scoredIds(season)

  await call('rpc_upsert_nfl_teams', teams)
  await call('rpc_upsert_nfl_games', rows)

  return {
    season,
    games: rows.length,
    newResults: current.filter((g) => isPlayed(g) && !before.has(g.game_id)).length,
    warnings: ingestWarnings(current, opts.now ?? new Date()),
  }
}
