import { db } from '../db'
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
    out.push(...((data ?? []) as NflGame[]).map((g) => ({
      ...g,
      spread_line: g.spread_line === null ? null : Number(g.spread_line),
      total_line: g.total_line === null ? null : Number(g.total_line),
    })))
    if (!data || data.length < 1000) return out
  }
}
