'use client'

import { browserDb } from '../leaderboard/store'
import type { UserPick, Tiebreak } from './pickem'

/**
 * The pick'em's reads and writes, as the signed-in person. Row level security
 * decides what is allowed (supabase/migrations/011_nfl_pick.sql): a pick is
 * written only before kickoff, and others' picks are read only after it.
 */

export type SaveOutcome = 'saved' | 'locked' | 'failed'

const PAGE = 1000

async function all<T>(query: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from)
    if (error || !data) return out
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

/** Every pick this person may see in these games: their own, and everyone's once a game has started. */
export function loadPicks(gameIds: string[]): Promise<UserPick[]> {
  if (!gameIds.length) return Promise.resolve([])
  return all<UserPick>((from) => browserDb().from('nfl_pick').select('player, game_id, pick').in('game_id', gameIds).order('game_id').order('player').range(from, from + PAGE - 1))
}

export function loadTiebreaks(season: number): Promise<Tiebreak[]> {
  return all<Tiebreak>((from) => browserDb().from('nfl_tiebreak').select('player, season, week, total').eq('season', season).order('week').order('player').range(from, from + PAGE - 1))
}

/** Names for the boards: everyone with a pick this season. */
export async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await browserDb().from('game_user').select('id, name').in('id', ids.slice(i, i + 200))
    for (const r of data ?? []) out.set(r.id as string, r.name as string)
  }
  return out
}

/** A write RLS turned away comes back as an error (insert) or as no row (update). */
export async function savePick(player: string, gameId: string, team: string): Promise<SaveOutcome> {
  const { data, error } = await browserDb().from('nfl_pick')
    .upsert({ player, game_id: gameId, pick: team, updated_at: new Date().toISOString() }, { onConflict: 'player,game_id' })
    .select('game_id')
  if (error) return error.code === '42501' ? 'locked' : 'failed'
  return data?.length ? 'saved' : 'locked'
}

export async function saveTiebreak(player: string, season: number, week: number, total: number): Promise<SaveOutcome> {
  const { data, error } = await browserDb().from('nfl_tiebreak')
    .upsert({ player, season, week, total, updated_at: new Date().toISOString() }, { onConflict: 'player,season,week' })
    .select('week')
  if (error) return error.code === '42501' ? 'locked' : 'failed'
  return data?.length ? 'saved' : 'locked'
}

export interface League { id: string; name: string; code: string; owner: string; members: string[] }

/** The leagues this person is in, with their members (RLS shows nothing else). */
export async function myLeagues(): Promise<League[]> {
  const { data: leagues } = await browserDb().from('nfl_league').select('id, name, code, owner').order('created_at')
  if (!leagues?.length) return []
  const members = await all<{ league: string; player: string }>((from) =>
    browserDb().from('nfl_league_member').select('league, player').in('league', leagues.map((l) => l.id)).order('league').order('player').range(from, from + PAGE - 1))
  return leagues.map((l) => ({ ...(l as Omit<League, 'members'>), members: members.filter((m) => m.league === l.id).map((m) => m.player) }))
}

const message = (e: { message?: string } | null) => e?.message ?? 'Eitthvað fór úrskeiðis'

export async function createLeague(name: string): Promise<{ ok: true; id: string; code: string } | { ok: false; message: string }> {
  const { data, error } = await browserDb().rpc('rpc_create_nfl_league', { p_name: name })
  if (error || !data?.[0]) return { ok: false, message: error?.code === '23514' ? 'Nafnið þarf að vera 2-40 stafir' : message(error) }
  return { ok: true, id: data[0].id, code: data[0].code }
}

export async function joinLeague(code: string): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const { data, error } = await browserDb().rpc('rpc_join_nfl_league', { p_code: code })
  if (error || !data?.[0]) return { ok: false, message: message(error) }
  return { ok: true, id: data[0].id, name: data[0].name }
}

export async function leaveLeague(player: string, league: string): Promise<boolean> {
  const { error } = await browserDb().from('nfl_league_member').delete().eq('league', league).eq('player', player)
  return !error
}

/** Picks made before signing in wait on this device and are saved once there is someone to save them for. */
const QUEUE = 'nfl-spa:bidrod'
export function queuedPicks(): Record<string, string> {
  try { const raw = JSON.parse(localStorage.getItem(QUEUE) ?? '{}'); return raw && typeof raw === 'object' ? raw : {} } catch { return {} }
}
export function queuePick(gameId: string, team: string | null) {
  const q = queuedPicks()
  if (team) q[gameId] = team; else delete q[gameId]
  try { localStorage.setItem(QUEUE, JSON.stringify(q)) } catch { /* kept in memory only */ }
}
export async function flushPicks(player: string): Promise<number> {
  const q = queuedPicks()
  let saved = 0
  for (const [gameId, team] of Object.entries(q)) if ((await savePick(player, gameId, team)) === 'saved') saved++
  try { localStorage.removeItem(QUEUE) } catch { /* nothing to clear */ }
  return saved
}

/** An invite opened before signing in: kept so a confirmation e-mail detour does not lose it. */
const INVITE = 'nfl-spa:bod'
export function keepInvite(code: string) { try { localStorage.setItem(INVITE, code) } catch { /* the link still works */ } }
export function takeInvite(): string | null {
  try { const c = localStorage.getItem(INVITE); localStorage.removeItem(INVITE); return c } catch { return null }
}
