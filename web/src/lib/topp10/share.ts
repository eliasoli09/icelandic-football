import { LIVES, type GameState } from './game'
import type { Topp10List } from './types'

/** Spoiler-free: which slots were found, never what was in them. */
export function shareText(list: Topp10List, state: GameState, url: string): string {
  const slots = list.answers.map((_, i) => (state.found.includes(i) ? '🟩' : '⬛')).join('')
  const hearts = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, LIVES - state.lives))
  return [
    `Topp 10 · ${list.title}`,
    `${state.found.length}/${list.answers.length}  ${hearts}`,
    slots,
    url,
  ].join('\n')
}
