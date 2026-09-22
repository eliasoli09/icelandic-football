import { dayNumber, dailyOrder } from '../topp10/daily'
import type { Level } from '../level'
import { letters } from './word'
import type { Side, XiMatch } from './types'

/** tries per player: the hard matches allow fewer */
export const TRIES_BY_LEVEL: Record<Level, number> = { easy: 6, medium: 6, hard: 4 }
export const triesFor = (match: XiMatch) => TRIES_BY_LEVEL[match.level]
/** on the easy matches every name shows its first letter */
export const showsFirstLetter = (match: XiMatch) => match.level === 'easy'
/** the level last chosen in this browser */
export const LEVEL_KEY = 'byrjunarlid:level'
/** the first daily puzzle is number 1 */
export const LAUNCH_DAY = dayNumber(new Date('2026-09-16T00:00:00Z'))
const DAY = 86_400_000

export interface Slot { guesses: string[]; done: 'solved' | 'failed' | null }
export interface XiState {
  v: 1
  /** the guessed result, locked once given */
  result: { home: number; away: number } | null
  teams: Record<Side, Record<string, Slot>>
  gaveUp: Record<Side, boolean>
}

export const newState = (): XiState => ({ v: 1, result: null, teams: { home: {}, away: {} }, gaveUp: { home: false, away: false } })
export const storageKey = (match: XiMatch) => `byrjunarlid:${match.id}:${match.verifiedAt}`

export function slot(state: XiState, side: Side, number: number): Slot {
  return state.teams[side][number] ?? { guesses: [], done: null }
}

export type GuessError = 'length' | 'done' | 'repeat' | 'unknown'

export function guessPlayer(match: XiMatch, state: XiState, side: Side, number: number, typed: string): { state: XiState; error?: GuessError } {
  const team = match[side]
  const player = team.players.find((p) => p.number === number)
  if (!player) return { state, error: 'unknown' }
  const current = slot(state, side, number)
  if (current.done || state.gaveUp[side]) return { state, error: 'done' }
  const guess = letters(typed, team.icelandic)
  if (guess.length !== player.word.length) return { state, error: 'length' }
  if (current.guesses.includes(guess)) return { state, error: 'repeat' }
  const guesses = [...current.guesses, guess]
  const done = guess === player.word ? 'solved' : guesses.length >= triesFor(match) ? 'failed' : null
  return { state: { ...state, teams: { ...state.teams, [side]: { ...state.teams[side], [number]: { guesses, done } } } } }
}

export const giveUp = (state: XiState, side: Side): XiState => ({ ...state, gaveUp: { ...state.gaveUp, [side]: true } })

export function solvedCount(match: XiMatch, state: XiState, side: Side): number {
  return match[side].players.filter((p) => slot(state, side, p.number).done === 'solved').length
}

export function teamOver(match: XiMatch, state: XiState, side: Side): boolean {
  return state.gaveUp[side] || match[side].players.every((p) => slot(state, side, p.number).done)
}

/** 3 for the exact score, 1 for the right winner or a draw, 0 otherwise. */
export function resultPoints(guess: { home: number; away: number }, score: { home: number; away: number }): 0 | 1 | 3 {
  if (guess.home === score.home && guess.away === score.away) return 3
  return Math.sign(guess.home - guess.away) === Math.sign(score.home - score.away) ? 1 : 0
}

export const guessResult = (state: XiState, home: number, away: number): XiState =>
  state.result || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20
    ? state : { ...state, result: { home, away } }

/** A saved game, or null if it does not fit this match. */
export function restore(raw: string | null, match: XiMatch): XiState | null {
  try {
    if (!raw) return null
    const s = JSON.parse(raw) as XiState
    if (s.v !== 1 || !s.teams || !s.gaveUp) return null
    for (const side of ['home', 'away'] as Side[]) {
      for (const [number, sl] of Object.entries(s.teams[side] ?? {})) {
        const p = match[side].players.find((x) => String(x.number) === number)
        if (!p || !Array.isArray(sl.guesses) || sl.guesses.length > triesFor(match)) return null
        if (sl.guesses.some((g) => typeof g !== 'string' || g.length !== p.word.length)) return null
        const done = sl.guesses.includes(p.word) ? 'solved' : sl.guesses.length >= triesFor(match) ? 'failed' : null
        if (sl.done !== done) return null
      }
    }
    return s
  } catch { return null }
}

export function puzzleNumber(day: number): number {
  return day - LAUNCH_DAY + 1
}

/**
 * The day the matches were spread by competition rather than by region (22
 * September 2026) and the match each level was showing that day. The order is
 * turned so that day keeps its match: an eleven half-remembered is not worth
 * losing to a change in the running order.
 */
const ANCHOR_DAY = 20718
const ANCHOR_MATCH: Record<Level, string> = {
  easy: 'realmadrid-liverpool-2018',
  medium: 'thyskaland-spann-2008',
  hard: 'bikar-2015',
}

const byLevel = new Map<Level, XiMatch[]>()
/** A level's matches in the order the daily match walks through them. */
export function matchesAt(matches: XiMatch[], level: Level): XiMatch[] {
  if (!byLevel.has(level)) {
    const order = dailyOrder(matches.filter((m) => m.level === level))
    const at = order.findIndex((m) => m.id === ANCHOR_MATCH[level])
    const n = order.length
    const shift = at < 0 || !n ? 0 : (((at - (ANCHOR_DAY % n)) % n) + n) % n
    byLevel.set(level, [...order.slice(shift), ...order.slice(0, shift)])
  }
  return byLevel.get(level)!
}

/** Everyone gets the same match at a level on a given day. */
export function dailyMatch(matches: XiMatch[], day: number, level: Level): XiMatch {
  const order = matchesAt(matches, level)
  return order[((day % order.length) + order.length) % order.length]
}

/** Spoiler-free: a square per player, left to right from the goalkeeper up. */
export function shareText(match: XiMatch, state: XiState, side: Side, number: number | null, url: string): string {
  const team = match[side]
  const squares = [...team.players].sort((a, b) => a.line - b.line || a.x - b.x).map((p) => {
    const s = slot(state, side, p.number)
    return s.done === 'solved' ? (s.guesses.length <= 2 ? '🟩' : '🟨') : '⬛'
  }).join('')
  const result = state.result ? ` · úrslit ${resultPoints(state.result, match.score)}/3` : ''
  return [
    `Byrjunarliðið${number ? ` #${number}` : ''}`,
    `${team.name}: ${solvedCount(match, state, side)}/11${result}`,
    squares,
    url,
  ].join('\n')
}
