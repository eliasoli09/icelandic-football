import { normalise } from './normalise'
import type { Topp10List } from './types'

/**
 * Indices of every answer the guess is exactly one of.
 *
 * More than one index is legitimate when a list has a slot per year and the
 * same player won twice. It is never a substring match: a loose match once put
 * Paris Saint-Germain on Paris FC elsewhere on this site without complaint, and
 * in a game a wrong acceptance is as damaging as a wrong refusal.
 */
export function matchGuess(list: Topp10List, guess: string): number[] {
  const key = normalise(guess)
  if (!key) return []
  const hits: number[] = []
  list.answers.forEach((answer, i) => {
    if (answer.accept.includes(key)) hits.push(i)
  })
  return hits
}

/**
 * Spellings accepted by two answers that are different people or clubs. Any
 * one of these would make a guess ambiguous, so a list containing one is not
 * allowed to ship.
 */
export function ambiguousAliases(list: Topp10List): string[] {
  const owner = new Map<string, string>()
  const clash = new Set<string>()
  for (const answer of list.answers) {
    for (const key of answer.accept) {
      const previous = owner.get(key)
      if (previous !== undefined && previous !== answer.label) clash.add(key)
      else owner.set(key, answer.label)
    }
  }
  return [...clash]
}
