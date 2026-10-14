import { db } from '../db'
import { parseGames, parseTeams } from './csv'
import { runElo, type EloRow, type EloState } from './elo'
import { simulateSeason } from './sim'
import { ingestPlayers } from './playerIngest'
import { isPlayed, type NflGame, type NflTeam } from './types'

export const GAMES_URL = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'
export const TEAMS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv'
const SECRET = () => process.env.CRON_SECRET!
const BATCH = 500
const STALE_HOURS = 18

export interface NflIngestResult {
  season: number
  games: number
  newResults: number
  warnings: string[]
  elo: { rows: number } | { error: string }
  sim: { sims: number; ms: number } | { error: string }
  players: { players: number; weeks: number } | { error: string }
}

/** Hot simulation, chosen by scripts/nfl-sim-backtest.mts; 10,000 runs take a few seconds. */
export const NFL_SIM = { sims: 10_000, hot: true }

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

  // Elo and the simulation are display layers on top of the results: if either
  // fails, the results still count and the previous simulation stays up.
  const run = runElo(games)
  const elo = await writeElo(run.rows, opts.all ? null : season).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
  const sim = await writeSim(current, teams, run.state).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
  // player stats are a separate feed: a failure there leaves the rest untouched
  const players = await ingestPlayers([season]).then(({ players, weeks }) => ({ players, weeks })).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))

  return {
    season,
    games: rows.length,
    newResults: current.filter((g) => isPlayed(g) && !before.has(g.game_id)).length,
    warnings: ingestWarnings(current, opts.now ?? new Date()),
    elo,
    sim,
    players,
  }
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

/**
 * Write the rows of a full replay since 1999 (milliseconds). Daily runs
 * write only the current season: earlier ratings cannot change unless an old
 * result does, and `--all` covers that.
 */
async function writeElo(all: EloRow[], onlySeason: number | null): Promise<{ rows: number }> {
  const rows = all
    .filter((r) => onlySeason === null || r.season === onlySeason)
    .map((r) => ({ ...r, elo_before: round(r.elo_before, 2), elo_after: round(r.elo_after, 2), p_win: round(r.p_win, 5) }))
  await call('rpc_upsert_nfl_elo', rows)
  return { rows: rows.length }
}

async function writeSim(season: NflGame[], allTeams: NflTeam[], state: EloState): Promise<{ sims: number; ms: number }> {
  const names = new Set(season.flatMap((g) => [g.home, g.away]))
  const teams = allTeams.filter((t) => names.has(t.abbr))
  const t0 = Date.now()
  const sim = simulateSeason(season, teams, state, { ...NFL_SIM, seed: Date.now() % 1e9 })
  const rows = Object.values(sim).map((x) => ({
    ...x,
    p_seed: x.p_seed.map((v) => round(v, 5)),
    ...Object.fromEntries((['p_div', 'p_playoffs', 'p_bye', 'p_round2', 'p_round3', 'p_sb', 'p_title'] as const).map((k) => [k, round(x[k], 5)])),
    sims: NFL_SIM.sims,
  }))
  const { error } = await db().rpc('rpc_replace_nfl_sim', { p_secret: SECRET(), p_season: season[0].season, p_rows: rows })
  if (error) throw new Error(`rpc_replace_nfl_sim: ${error.message}`)
  return { sims: NFL_SIM.sims, ms: Date.now() - t0 }
}
