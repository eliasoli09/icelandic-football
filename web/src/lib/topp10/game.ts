import { matchGuess } from './match'
import { normalise } from './normalise'
import type { Topp10List } from './types'

export const LIVES = 3

export interface GameState {
  listId: string
  /** answer indices already opened, in order */
  found: number[]
  /** wrong guesses, normalised, so the same miss is not charged twice */
  wrong: string[]
  lives: number
  /** answer indices a hint has been spent on */
  hinted: number[]
  status: 'playing' | 'won' | 'lost'
}

export type Outcome = 'correct' | 'wrong' | 'repeat' | 'empty' | 'over'

export const newGame = (list: Topp10List): GameState => ({
  listId: list.id, found: [], wrong: [], lives: LIVES, hinted: [], status: 'playing',
})

export function guess(
  list: Topp10List,
  state: GameState,
  text: string,
): { state: GameState; outcome: Outcome; revealed: number[] } {
  if (state.status !== 'playing') return { state, outcome: 'over', revealed: [] }
  const key = normalise(text)
  if (!key) return { state, outcome: 'empty', revealed: [] }

  const hits = matchGuess(list, key)
  const fresh = hits.filter((i) => !state.found.includes(i))
  // a right answer typed again costs nothing, and neither does a repeated miss
  if (hits.length && !fresh.length) return { state, outcome: 'repeat', revealed: [] }
  if (fresh.length) {
    const found = [...state.found, ...fresh].sort((a, b) => a - b)
    const status = found.length === list.answers.length ? 'won' : 'playing'
    return { state: { ...state, found, status }, outcome: 'correct', revealed: fresh }
  }
  if (state.wrong.includes(key)) return { state, outcome: 'repeat', revealed: [] }

  const lives = state.lives - 1
  return {
    state: { ...state, wrong: [...state.wrong, key], lives, status: lives <= 0 ? 'lost' : 'playing' },
    outcome: 'wrong',
    revealed: [],
  }
}

/**
 * Spend a life to see a clue for one unopened answer. A hint is refused on the
 * last life: it should never be the thing that ends a game.
 */
export function hint(list: Topp10List, state: GameState, index: number): GameState {
  if (state.status !== 'playing' || state.lives <= 1) return state
  if (index < 0 || index >= list.answers.length) return state
  if (state.found.includes(index) || state.hinted.includes(index)) return state
  return { ...state, lives: state.lives - 1, hinted: [...state.hinted, index] }
}

export const hintFor = (list: Topp10List, index: number): string => {
  const answer = list.answers[index]
  return answer.hint ?? `${answer.label.charAt(0)}…`
}
