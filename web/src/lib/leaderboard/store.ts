'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { winPct, type Result, type Row } from './rank'

/**
 * The browser's own Supabase client. It signs in as the person using it and
 * writes only their own rows: the tables let a signed-in person add their name
 * and their results and nothing else, so no secret is needed in the page.
 */
let client: SupabaseClient | null = null
export function browserDb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'besta-spain-auth' } },
    )
  }
  return client
}

export interface Me { id: string; email: string | null; name: string | null }

export async function whoAmI(): Promise<Me | null> {
  const { data } = await browserDb().auth.getSession()
  const user = data.session?.user
  if (!user) return null
  return { id: user.id, email: user.email ?? null, name: await nameOf(user.id) }
}

async function nameOf(id: string): Promise<string | null> {
  const { data } = await browserDb().from('game_user').select('name').eq('id', id).maybeSingle()
  return data?.name ?? null
}

export type AuthOutcome = { ok: true; needsEmail: boolean } | { ok: false; message: string }

/** Supabase answers in English; the messages people actually meet are in Icelandic. */
function icelandic(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Netfang eða lykilorð stemmir ekki'
  if (m.includes('already registered')) return 'Þetta netfang er þegar skráð. Skráðu þig inn.'
  if (m.includes('password should be')) return 'Lykilorðið þarf að vera minnst sex stafir'
  if (m.includes('email not confirmed')) return 'Þú átt eftir að staðfesta netfangið. Kíktu í pósthólfið.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Of margar tilraunir í bili. Reyndu aftur eftir stutta stund.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Netfangið lítur ekki rétt út'
  return message
}

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await browserDb().auth.signUp({ email, password })
  if (error) return { ok: false, message: icelandic(error.message) }
  // with e-mail confirmation on, there is no session until the link is clicked
  return { ok: true, needsEmail: !data.session }
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const { error } = await browserDb().auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: icelandic(error.message) }
  return { ok: true, needsEmail: false }
}

export const signOut = () => browserDb().auth.signOut()

export async function claimName(id: string, name: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await browserDb().from('game_user').upsert({ id, name }, { onConflict: 'id' })
  if (!error) return { ok: true }
  return { ok: false, message: error.code === '23505' ? 'Þetta nafn er frátekið' : error.message }
}

/** Results played before signing in wait here, so nothing that was played is lost. */
const QUEUE = 'stigatafla:bidrod'
const readQueue = (): Result[] => {
  try { const raw = JSON.parse(localStorage.getItem(QUEUE) ?? '[]'); return Array.isArray(raw) ? raw.slice(0, 60) : [] }
  catch { return [] }
}
const writeQueue = (rows: Result[]) => {
  try { localStorage.setItem(QUEUE, JSON.stringify(rows.slice(-60))) } catch { /* nothing waits */ }
}
export function queueResult(result: Result) {
  const rows = readQueue()
  if (rows.some((r) => r.game === result.game && r.puzzle === result.puzzle)) return
  writeQueue([...rows, result])
}
export const queueLength = () => readQueue().length

/** Records one finished puzzle. The first result stands; a repeat is not an error. */
export async function record(playerId: string, result: Result): Promise<'saved' | 'already' | 'failed'> {
  const { error } = await browserDb().from('game_result').insert({
    player: playerId, game: result.game, puzzle: result.puzzle, won: result.won, detail: result.detail ?? null,
  })
  if (!error) return 'saved'
  return error.code === '23505' ? 'already' : 'failed'
}

/** Everything waiting on this device, once there is someone to record it for. */
export async function flushQueue(playerId: string): Promise<number> {
  const rows = readQueue()
  if (!rows.length) return 0
  let saved = 0
  for (const result of rows) if ((await record(playerId, result)) !== 'failed') saved++
  writeQueue([])
  return saved
}

export async function loadBoard(): Promise<Row[]> {
  const { data, error } = await browserDb().from('leaderboard').select('id, name, played, won, win_pct')
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    played: Number(r.played),
    won: Number(r.won),
    winPct: r.win_pct === null ? winPct(Number(r.won), Number(r.played)) : Number(r.win_pct),
  }))
}

/** What this person has played, for their own row when the board is long. */
export async function myTally(playerId: string): Promise<{ played: number; won: number }> {
  const { data } = await browserDb().from('game_result').select('won').eq('player', playerId)
  const rows = data ?? []
  return { played: rows.length, won: rows.filter((r) => r.won).length }
}
