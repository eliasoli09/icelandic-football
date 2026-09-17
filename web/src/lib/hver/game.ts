import { dailyOrder, dayNumber } from '../topp10/daily'
import { normalise } from '../topp10/normalise'
import type { Level } from '../level'
import { nameKeys } from './names'
import type { WhoPlayer } from './types'

export const HINTS = [
  { id: 'position', label: 'Staða' },
  { id: 'born', label: 'Fæddur' },
  { id: 'national', label: 'A-landslið' },
  { id: 'initials', label: 'Upphafsstafir' },
] as const
export type HintId = (typeof HINTS)[number]['id']

/**
 * The career opens one club at a time, oldest first: the first club shows from
 * the start and every wrong guess adds the next. Once the whole career is out,
 * each wrong guess opens a clue instead. A player has as many guesses as there
 * are clubs and clues, so the last guess is made with everything showing.
 */
export const triesFor = (player: WhoPlayer) => player.career.length + HINTS.length

const wrongGuesses = (player: WhoPlayer, state: WhoState) => state.guesses.filter((g) => g !== player.name).length

/** How many career rows show: all of them once the puzzle is over. */
export function clubsShown(player: WhoPlayer, state: WhoState): number {
  if (state.status !== 'playing') return player.career.length
  return Math.min(player.career.length, 1 + wrongGuesses(player, state))
}

/** How many clues show: none until the whole career is out, all once the puzzle is over. */
export function hintsOpen(player: WhoPlayer, state: WhoState): number {
  if (state.status !== 'playing') return HINTS.length
  return Math.max(0, Math.min(HINTS.length, wrongGuesses(player, state) - (player.career.length - 1)))
}

/** Which wrong guess opens clue i (counting from 1): the one after the last club came out, and so on. */
export const hintOpensAfter = (player: WhoPlayer, i: number) => player.career.length - 1 + i

/** the level last chosen in this browser */
export const LEVEL_KEY = 'hver:level'
/** the first daily puzzle is number 1 */
export const LAUNCH_DAY = dayNumber(new Date('2026-09-16T00:00:00Z'))

export interface WhoState {
  v: 1
  /** the names guessed, as the list spells them */
  guesses: string[]
  status: 'playing' | 'won' | 'lost'
}

export const newState = (): WhoState => ({ v: 1, guesses: [], status: 'playing' })
export const storageKey = (player: WhoPlayer) => `hver:${player.id}`

/**
 * Every name the guess box knows, keyed by the spellings that find it. A name
 * is guessed from this list, so a typo costs nothing and a guess always names
 * a real footballer.
 */
export function nameIndex(names: string[], players: WhoPlayer[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const p of players) for (const key of p.accept) if (!index.has(key)) index.set(key, p.name)
  for (const name of names) for (const key of nameKeys(name)) if (!index.has(key)) index.set(key, name)
  return index
}

/** Names whose words start with what has been typed, best matches first. */
export function suggest(names: string[], typed: string, max = 8): string[] {
  const query = normalise(typed).split(' ').filter(Boolean)
  if (!query.length || query.join('').length < 2) return []
  const scored: { name: string; score: number }[] = []
  for (const name of names) {
    const words = normalise(name).split(' ')
    if (!query.every((q) => words.some((w) => w.startsWith(q)))) continue
    scored.push({ name, score: words[0].startsWith(query[0]) ? 0 : 1 })
  }
  return scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'is')).slice(0, max).map((s) => s.name)
}

export type GuessOutcome = 'right' | 'wrong' | 'empty' | 'unknown' | 'repeat' | 'over'

export function guess(player: WhoPlayer, state: WhoState, typed: string, index: Map<string, string>): { state: WhoState; outcome: GuessOutcome } {
  if (state.status !== 'playing') return { state, outcome: 'over' }
  const key = normalise(typed)
  if (!key) return { state, outcome: 'empty' }
  if (player.accept.includes(key)) return { state: { ...state, guesses: [...state.guesses, player.name], status: 'won' }, outcome: 'right' }
  const name = index.get(key)
  if (!name) return { state, outcome: 'unknown' }
  if (state.guesses.includes(name)) return { state, outcome: 'repeat' }
  const guesses = [...state.guesses, name]
  return { state: { ...state, guesses, status: guesses.length >= triesFor(player) ? 'lost' : 'playing' }, outcome: 'wrong' }
}

export const giveUp = (state: WhoState): WhoState => state.status === 'playing' ? { ...state, status: 'lost' } : state

export function hintValue(player: WhoPlayer, id: HintId): string {
  const h = player.hints
  if (id === 'born') return String(h.born)
  if (id === 'national') return h.national ?? 'Enginn A-landsleikur'
  return h[id]
}

export function restore(raw: string | null, player: WhoPlayer): WhoState | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as WhoState
    if (s?.v !== 1 || !Array.isArray(s.guesses) || !s.guesses.every((g) => typeof g === 'string') || s.guesses.length > triesFor(player)) return null
    const won = s.guesses[s.guesses.length - 1] === player.name
    const status = won ? 'won' : s.guesses.length >= triesFor(player) ? 'lost' : s.status === 'lost' ? 'lost' : 'playing'
    return s.status === status ? s : null
  } catch { return null }
}

const byLevel = new Map<string, WhoPlayer[]>()

/** The order the daily player walks through at a level, Icelanders and others spread evenly. */
export function playersAt(players: WhoPlayer[], level: Level): WhoPlayer[] {
  const key = `${level}:${players.length}`
  if (!byLevel.has(key)) byLevel.set(key, dailyOrder(players.filter((p) => p.level === level)))
  return byLevel.get(key)!
}

export interface Schedule { start: number; days: Partial<Record<Level, string[]>> }
const byId = new WeakMap<WhoPlayer[], Map<string, WhoPlayer>>()

/**
 * The same player for everyone on a given day and level: the written schedule
 * (scripts/hver/schedule.mts), so a deploy never changes a day's puzzle, and
 * the scrambled order for any day it does not cover.
 */
export function dailyPlayer(players: WhoPlayer[], day: number, level: Level, schedule: Schedule | null = null): WhoPlayer {
  if (schedule) {
    if (!byId.has(players)) byId.set(players, new Map(players.map((p) => [p.id, p])))
    const planned = schedule.days[level]?.[day - schedule.start]
    const player = planned && byId.get(players)!.get(planned)
    if (player) return player
  }
  const order = playersAt(players, level)
  const n = order.length
  return order[(((day - LAUNCH_DAY) % n) + n) % n]
}

/** Milliseconds until the next puzzle: midnight UTC, which is midnight in Iceland. */
export const untilMidnight = (now: Date) => 86_400_000 - (now.getTime() % 86_400_000)

export const puzzleNumber = (day: number) => day - LAUNCH_DAY + 1

/**
 * Squares for the guesses, never names: red for a wrong guess, green for the
 * right one, and how many clubs it took ("3 af 11 félögum").
 */
export function shareText(player: WhoPlayer, state: WhoState, day: number, levelLabel: string, url: string): string {
  const marks = state.guesses.map((g) => g === player.name ? '🟩' : '🟥').join('')
  const clubs = Math.min(player.career.length, state.guesses.length)
  const extra = state.guesses.length - clubs
  const score = state.status === 'won'
    ? `Rétt eftir ${clubs} af ${player.career.length} félögum${extra === 1 ? ' og 1 vísbendingu' : extra > 1 ? ` og ${extra} vísbendingum` : ''}`
    : `Náði honum ekki (${player.career.length} félög)`
  return `Hver er maðurinn? #${puzzleNumber(day)} · ${levelLabel}\n${marks || '⬛'} ${score}\n${url}`
}
