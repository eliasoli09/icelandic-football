import { dailyOrder, dayNumber } from '../topp10/daily'
import { normalise } from '../topp10/normalise'
import type { Level } from '../level'
import { nameKeys } from './names'
import type { WhoPlayer } from './types'

/** guesses per player; every wrong one opens the next clue */
export const TRIES = 5
export const HINTS = [
  { id: 'position', label: 'Staða' },
  { id: 'born', label: 'Fæddur' },
  { id: 'national', label: 'A-landslið' },
  { id: 'initials', label: 'Upphafsstafir' },
] as const
export type HintId = (typeof HINTS)[number]['id']

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
  return { state: { ...state, guesses, status: guesses.length >= TRIES ? 'lost' : 'playing' }, outcome: 'wrong' }
}

export const giveUp = (state: WhoState): WhoState => state.status === 'playing' ? { ...state, status: 'lost' } : state

/** Clues open one per wrong guess; all of them once the puzzle is over. */
export function hintsOpen(state: WhoState): number {
  if (state.status !== 'playing') return HINTS.length
  return Math.min(state.guesses.length, HINTS.length)
}

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
    if (s?.v !== 1 || !Array.isArray(s.guesses) || !s.guesses.every((g) => typeof g === 'string') || s.guesses.length > TRIES) return null
    const won = s.guesses[s.guesses.length - 1] === player.name
    const status = won ? 'won' : s.guesses.length >= TRIES ? 'lost' : s.status === 'lost' ? 'lost' : 'playing'
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

/** The same player for everyone on a given day and level. */
export function dailyPlayer(players: WhoPlayer[], day: number, level: Level): WhoPlayer {
  const order = playersAt(players, level)
  const n = order.length
  return order[(((day - LAUNCH_DAY) % n) + n) % n]
}

export const puzzleNumber = (day: number) => day - LAUNCH_DAY + 1

const SQUARE = { wrong: '🟥', right: '🟩', unused: '⬛' }

export function shareText(player: WhoPlayer, state: WhoState, day: number, levelLabel: string, url: string): string {
  const marks = state.guesses.map((g) => g === player.name ? SQUARE.right : SQUARE.wrong)
  while (marks.length < TRIES) marks.push(SQUARE.unused)
  const score = state.status === 'won' ? `${state.guesses.length}/${TRIES}` : `X/${TRIES}`
  return `Hver er maðurinn? #${puzzleNumber(day)} · ${levelLabel}\n${marks.join('')} ${score}\n${url}`
}
