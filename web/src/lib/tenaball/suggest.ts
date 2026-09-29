import { normalise } from '../topp10/normalise'
import type { Kind } from '../topp10/types'
import type { Question } from './data'

/**
 * Every name of that kind the game knows, from all of its questions, and for
 * players the footballers Hver er maðurinn? knows as well. The pool is wide
 * and shared on purpose: a name appearing as you type must say only that it
 * belongs to Icelandic or European football, never that it answers the
 * question in front of you. Ten answers among a couple of hundred names would
 * be a hint; among a thousand they are not.
 */
export function namePool(questions: Question[], kind: Kind, extra: readonly string[] = []): string[] {
  const names = new Set<string>()
  const spelt = new Set<string>()
  for (const question of questions) {
    if (question.kind !== kind) continue
    for (const answer of question.answers) {
      names.add(answer.label)
      for (const key of answer.accept) spelt.add(key)
    }
  }
  // the other game spells some of the same men differently: one line each
  if (kind === 'player') for (const name of extra) if (!spelt.has(normalise(name))) names.add(name)
  return [...names].sort((a, b) => a.localeCompare(b, 'is'))
}

/**
 * Names whose words start with what has been typed, the ones starting at the
 * first word first. Nothing is offered for a single letter, which would only
 * be a list of everything.
 */
export function suggest(names: string[], typed: string, max = 8): string[] {
  const query = normalise(typed).split(' ').filter(Boolean)
  if (!query.length || query.join('').length < 2) return []
  const scored: { name: string; score: number }[] = []
  for (const name of names) {
    const words = normalise(name).split(' ')
    if (!query.every((q) => words.some((w) => w.startsWith(q)))) continue
    scored.push({ name, score: words[0].startsWith(query[0]) ? 0 : 1 })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'is'))
    .slice(0, max)
    .map((s) => s.name)
}
