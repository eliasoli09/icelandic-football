import { db } from '../db'
import { stateFromRows, type EloRow, type EloState } from './elo'
import type { SimTeam } from './sim'
import { STATS, type NflPlayer, type PlayerWeek, type SeasonTotal } from './players'
import type { NflGame, NflTeam } from './types'
import { STAT_FIELDS } from './vedmalView'

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

/** One round's player lines with name, position and photo, for the team of the week. */
export async function nflRoundLines(season: number, week: number): Promise<import('./stars').StarLine[]> {
  const cols = 'player_id, team, opponent, game_id, completions, attempts, passing_yards, passing_tds, interceptions, carries, rushing_yards, rushing_tds, receptions, receiving_yards, receiving_tds, fumbles_lost, tackles_solo, tackle_assists, tackles_for_loss, def_sacks, qb_hits, def_interceptions, passes_defended, forced_fumbles, def_tds, nfl_players(name, position, headshot)'
  const out: import('./stars').StarLine[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_weeks').select(cols).eq('season', season).eq('week', week).order('player_id').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as unknown as (Omit<import('./stars').StarLine, 'name' | 'position' | 'headshot'> & { nfl_players: { name: string; position: string | null; headshot: string | null } | null })[]) {
      const { nfl_players: p, ...rest } = r
      out.push({ ...rest, name: p?.name ?? 'Óþekktur', position: p?.position ?? null, headshot: p?.headshot ?? null })
    }
    if (!data || data.length < 1000) return out
  }
}

export type RumourItem = NewsItem & { heat: import('./rumours').Heat | null }

/** Summarised trade talk from the last month, newest first. */
export async function nflRumours(limit = 100): Promise<RumourItem[]> {
  const { data, error } = await db().from('nfl_news').select('url, source, published_at, teams, title_is, summary_is, heat')
    .eq('rumour', true).not('summary_is', 'is', null).gte('published_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as RumourItem[]
}

/** Confirmed trades, newest first. */
export async function nflTrades(): Promise<import('./rumours').Trade[]> {
  const { data, error } = await db().from('nfl_trade').select('id, traded_on, moves, compensation, source_url').order('traded_on', { ascending: false }).order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []) as import('./rumours').Trade[]
}

export interface Broadcast { channel: string; note: string }

/** Games shown on Icelandic TV this season, by game id (editors list them on /ritstjorn/sjonvarp). */
export async function nflBroadcasts(season: number): Promise<Record<string, Broadcast>> {
  const { data, error } = await db().from('nfl_broadcast').select('game_id, channel, note').like('game_id', `${season}_%`).range(0, 999)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.game_id as string, { channel: r.channel as string, note: r.note as string }]))
}

export interface VedmalData {
  lines: import('./vedmalView').VedmalLine[]
  prev: import('./vedmalView').PrevTotal[]
  leaguePts: number
  /** Last season's team-games (two a game), to turn its totals into a league average. */
  teamGames: number
}

/** This season's player lines with names, last season's regular-season totals and the league's points from last season, for /vedmal. */
export async function nflVedmalData(season: number): Promise<VedmalData> {
  const stats = STAT_FIELDS.join(', ')
  const cols = `player_id, week, game_id, team, opponent, ${stats}, nfl_players(name, position, headshot)`
  const lines: import('./vedmalView').VedmalLine[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_weeks').select(cols).eq('season', season).eq('season_type', 'REG').order('player_id').order('week').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as unknown as (Omit<import('./vedmalView').VedmalLine, 'name' | 'position' | 'headshot'> & { nfl_players: { name: string; position: string | null; headshot: string | null } | null })[]) {
      const { nfl_players: p, ...rest } = r
      lines.push({ ...rest, ...Object.fromEntries(STAT_FIELDS.map((k) => [k, Number(rest[k])])), name: p?.name ?? 'Óþekktur', position: p?.position ?? null, headshot: p?.headshot ?? null })
    }
    if (!data || data.length < 1000) break
  }
  const prev: import('./vedmalView').PrevTotal[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('nfl_player_season').select(`player_id, games, ${stats}`)
      .eq('season', season - 1).eq('season_type', 'REG').order('player_id').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as unknown as Record<string, string | number>[]) {
      prev.push({ player_id: String(r.player_id), games: Number(r.games), ...Object.fromEntries(STAT_FIELDS.map((k) => [k, Number(r[k])])) } as import('./vedmalView').PrevTotal)
    }
    if (!data || data.length < 1000) break
  }
  const last = (await nflSeasonGames(season - 1)).filter((g) => g.game_type === 'REG' && g.home_score !== null)
  const n = Math.max(1, 2 * last.length)
  return {
    lines, prev,
    leaguePts: last.length ? last.reduce((t, g) => t + g.home_score! + g.away_score!, 0) / n : 22,
    teamGames: n,
  }
}

export interface InjuryList { week: number | null; rows: import('./injuries').Injury[] }

/** The newest injury week on file up to `week`, every listed player in it. */
export async function nflInjuries(season: number, week: number): Promise<InjuryList> {
  const { data: last, error: e1 } = await db().from('nfl_injury').select('week').eq('season', season).lte('week', week).order('week', { ascending: false }).limit(1)
  if (e1) throw e1
  const w = last?.[0]?.week as number | undefined
  if (w === undefined) return { week: null, rows: [] }
  const { data, error } = await db().from('nfl_injury').select('team, player_id, name, position, status, injury, practice, source').eq('season', season).eq('week', w).range(0, 1999)
  if (error) throw error
  return { week: w, rows: (data ?? []) as import('./injuries').Injury[] }
}

/** How many readers chose each side, by game (pick'em and polls); games below five choices before kickoff are left out. */
export async function nflCrowd(gameIds: string[]): Promise<Record<string, import('./crowd').Crowd>> {
  if (!gameIds.length) return {}
  const { data, error } = await db().rpc('rpc_nfl_crowd', { p_games: gameIds })
  if (error) throw error
  return Object.fromEntries(((data ?? []) as { game_id: string; home: number; away: number }[]).map((r) => [r.game_id, { home: r.home, away: r.away }]))
}

/** The stored live win chances of some games, in order, for the charts. */
export async function nflLiveWp(gameIds: string[]): Promise<Record<string, import('./winChart').WpPoint[]>> {
  const out: Record<string, import('./winChart').WpPoint[]> = Object.fromEntries(gameIds.map((id) => [id, []]))
  const { data, error } = await db().from('nfl_live_wp').select('game_id, progress, p_home, home_score, away_score, status').in('game_id', gameIds).order('at').limit(5000)
  if (error) throw error
  for (const r of (data ?? []) as (import('./winChart').WpPoint & { game_id: string })[]) {
    const { game_id, ...p } = r
    out[game_id]?.push(p)
  }
  return out
}
