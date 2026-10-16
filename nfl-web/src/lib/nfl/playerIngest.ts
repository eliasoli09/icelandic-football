import { db } from '../db'
import { parsePlayerWeeks, parsePlayers, type NflPlayer, type PlayerWeek } from './players'

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download'
export const PLAYERS_URL = `${BASE}/players/players.csv`
export const weeksUrl = (season: number) => `${BASE}/stats_player/stats_player_week_${season}.csv`

const SECRET = () => process.env.CRON_SECRET!
const BATCH = 500
const PARALLEL = 4

async function text(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`nflverse svaraði ${res.status}: ${url}`)
  return res.text()
}

/** Write in batches of 500, a few at a time: the history is about half a million rows. */
async function write(fn: string, rows: unknown[]) {
  const batches: unknown[][] = []
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH))
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(batches.slice(i, i + PARALLEL).map(async (b) => {
      const { error } = await db().rpc(fn, { p_secret: SECRET(), p_rows: b })
      if (error) throw new Error(`${fn}: ${error.message}`)
    }))
  }
}

const round = (x: number) => Math.round(x * 1000) / 1000

/** Load the given seasons' weekly stats and the players in them. */
export async function ingestPlayers(seasons: number[], log: (s: string) => void = () => {}): Promise<{ seasons: number; players: number; weeks: number }> {
  const register = await text(PLAYERS_URL)
  let players = 0
  let weeks = 0
  for (const season of seasons) {
    const { weeks: rows, seen } = parsePlayerWeeks(await text(weeksUrl(season)))
    const list: NflPlayer[] = parsePlayers(register, seen)
    // players first: the weekly rows reference them
    await write('rpc_upsert_nfl_players', list)
    await write('rpc_upsert_nfl_player_weeks', rows.map((w: PlayerWeek) => ({ ...w, passing_epa: round(w.passing_epa), rushing_epa: round(w.rushing_epa), receiving_epa: round(w.receiving_epa) })))
    players += list.length
    weeks += rows.length
    log(`${season}: ${list.length} leikmenn, ${rows.length} leikir`)
  }
  return { seasons: seasons.length, players, weeks }
}
