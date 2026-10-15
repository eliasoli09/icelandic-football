import { db } from '../db'
import { stateFromRows, type EloRow, type EloState } from './elo'
import type { SimTeam } from './sim'
import { STATS, type NflPlayer, type PlayerWeek, type SeasonTotal } from './players'
import type { NflGame, NflTeam } from './types'

export async function nflTeams(): Promise<NflTeam[]> {
  const { data, error } = await db().from('nfl_teams').select('*').range(0, 999)
  if (error) throw error
  return (data ?? []) as NflTeam[]
}

export async function nflCurrentSeason(): Promise<number | null> {
  const { data, error } = await db().from('nfl_games').select('season').order('season', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0]?.season ?? null
}

/** One season, paged anyway: an unpaged read stops at 1,000 rows without a word (Gildrur 1). */
export async function nflSeasonGames(season: number): Promise<NflGame[]> {
  const out: NflGame[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('nfl_games').select('*').eq('season', season).order('kickoff').order('game_id').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as NflGame[]).map(normalize))
    if (!data || data.length < 1000) return out
  }
}

// numeric columns arrive as strings from PostgREST
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))
function normalize(g: NflGame): NflGame {
  return { ...g, spread_line: num(g.spread_line), total_line: num(g.total_line) }
}

export async function nflGame(id: string): Promise<NflGame | null> {
  const { data, error } = await db().from('nfl_games').select('*').eq('game_id', id).maybeSingle()
  if (error) throw error
  return data ? normalize(data as NflGame) : null
}

/** Last meetings of two clubs under any of their names (OAK and LV are one club). */
export async function nflMeetings(a: string[], b: string[], limit = 5): Promise<NflGame[]> {
  const A = a.join(',')
  const B = b.join(',')
  const { data, error } = await db()
    .from('nfl_games').select('*')
    .or(`and(home.in.(${A}),away.in.(${B})),and(home.in.(${B}),away.in.(${A}))`)
    .not('home_score', 'is', null)
    .order('kickoff', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((g) => normalize(g as NflGame))
}

export type StoredElo = EloRow

export async function nflEloRows(seasons: number[]): Promise<StoredElo[]> {
  const out: StoredElo[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('nfl_elo').select('*').in('season', seasons).order('season').order('week').order('game_id').range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map((r) => ({ ...r, elo_before: Number(r.elo_before), elo_after: Number(r.elo_after), p_win: Number(r.p_win) }) as StoredElo))
    if (!data || data.length < 1000) return out
  }
}

export interface SeasonModel {
  season: number
  games: NflGame[]
  teams: NflTeam[]
  /** This season's and last season's rows, oldest first. */
  elo: StoredElo[]
  state: EloState
}

/** Everything a page needs to show and forecast one season. Last season's rows cover clubs yet to play. */
export async function nflSeasonModel(season: number): Promise<SeasonModel> {
  const [games, teams, elo] = await Promise.all([nflSeasonGames(season), nflTeams(), nflEloRows([season - 1, season])])
  return { season, games, teams, elo, state: stateFromRows(elo, games) }
}

export interface StoredSim extends SimTeam { sims: number; run_at: string }

/** The current simulation, one row per club; empty before the first run. */
export async function nflSim(season: number): Promise<Record<string, StoredSim>> {
  const { data, error } = await db().from('nfl_sim').select('*').eq('season', season)
  if (error) throw error
  const n = (x: unknown) => Number(x)
  return Object.fromEntries((data ?? []).map((r) => [r.team, {
    team: r.team, p_div: n(r.p_div), p_playoffs: n(r.p_playoffs), p_bye: n(r.p_bye), p_seed: (r.p_seed as unknown[]).map(n),
    p_round2: n(r.p_round2), p_round3: n(r.p_round3), p_sb: n(r.p_sb), p_title: n(r.p_title), sims: r.sims, run_at: r.run_at,
  }]))
}

export type PlayerSeasonRow = SeasonTotal & { season_type: 'REG' | 'POST'; name: string; position: string | null; headshot: string | null; rookie_season: number | null }

const toSeason = (r: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && STATS.includes(k as never) ? Number(v) : v])) as unknown as PlayerSeasonRow

/** Season totals for every player, one season and type; paged (about 2,000 rows). */
export async function nflPlayerSeasons(season: number, type: 'REG' | 'POST' = 'REG'): Promise<PlayerSeasonRow[]> {
  const out: PlayerSeasonRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_season').select('*').eq('season', season).eq('season_type', type).order('player_id').range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map(toSeason))
    if (!data || data.length < 1000) return out
  }
}

export async function nflPlayer(id: string): Promise<NflPlayer | null> {
  const { data, error } = await db().from('nfl_players').select('*').eq('player_id', id).maybeSingle()
  if (error) throw error
  return (data as NflPlayer) ?? null
}

export async function nflPlayerCareer(id: string): Promise<PlayerSeasonRow[]> {
  const { data, error } = await db().from('nfl_player_season').select('*').eq('player_id', id).order('season').order('season_type', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toSeason)
}

export async function nflPlayerGames(id: string, season: number): Promise<PlayerWeek[]> {
  const { data, error } = await db().from('nfl_player_weeks').select('*').eq('player_id', id).eq('season', season).order('week')
  if (error) throw error
  return (data ?? []) as PlayerWeek[]
}

/** The one quarterback by this name, if exactly one; two players can share a name. */
export async function nflQbByName(name: string): Promise<string | null> {
  const { data, error } = await db().from('nfl_players').select('player_id').eq('name', name).eq('position', 'QB').limit(2)
  if (error) throw error
  return data && data.length === 1 ? data[0].player_id : null
}

export interface NewsItem { url: string; source: string; published_at: string; teams: string[]; title_is: string; summary_is: string }

/** Summarised items only, newest first; optionally those naming one of `teams`. */
export async function nflNews(opts: { limit?: number; teams?: string[]; sinceDays?: number } = {}): Promise<NewsItem[]> {
  let q = db().from('nfl_news').select('url, source, published_at, teams, title_is, summary_is').not('summary_is', 'is', null)
  if (opts.teams?.length) q = q.overlaps('teams', opts.teams)
  if (opts.sinceDays) q = q.gte('published_at', new Date(Date.now() - opts.sinceDays * 86400_000).toISOString())
  const { data, error } = await q.order('published_at', { ascending: false }).limit(opts.limit ?? 50)
  if (error) throw error
  return (data ?? []) as NewsItem[]
}
