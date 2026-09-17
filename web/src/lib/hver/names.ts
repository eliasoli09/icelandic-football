import { normalise } from '../topp10/normalise'

/** A name as a reader writes it: no "(footballer, born 1990)", no quoted nickname. */
export function cleanName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*["“„][^"”“]*["”“]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The spellings that count for a name: all of it, or the first and last name
 * without the middle ones, so "Gylfi Sigurðsson" finds Gylfi Þór Sigurðsson.
 */
export function nameKeys(name: string): string[] {
  const full = normalise(name)
  const words = full.split(' ').filter(Boolean)
  const keys = [full]
  if (words.length > 2) keys.push(`${words[0]} ${words[words.length - 1]}`)
  return keys.filter(Boolean)
}

/** "Gylfi Þór Sigurðsson" → "G. Þ. S." */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => `${Array.from(w)[0].toUpperCase()}.`).join(' ')
}
