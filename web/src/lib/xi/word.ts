/** Letters the Icelandic keyboard adds beyond A-Z. */
export const ICELANDIC_LETTERS = ['Þ', 'Ð', 'Æ', 'Ö']

const PARTICLES = new Set(['van', 'der', 'den', 'de', 'da', 'di', 'do', 'dos', 'das', 'du', 'le', 'la', 'von', 'ter', 'ten', 'el', 'al', 'mac', 'st'])

/** The part of a name a crowd would chant: "van der Sar", "Óskarsson", "Kaká". */
export function surname(name: string): string {
  const words = name.replace(/^(?:[A-ZÁÐÉÍÓÚÝÞÆÖ]\.\s*)+/, '').trim().split(/\s+/)
  if (words.length === 1) return words[0]
  const particle = words.findIndex((w, i) => i > 0 && i < words.length - 1 && PARTICLES.has(w.toLowerCase()))
  return particle > 0 ? words.slice(particle).join(' ') : words[words.length - 1]
}

/**
 * Upper-case letters only. Icelandic names keep Þ, Ð, Æ and Ö, which are
 * letters of their own; accents over vowels are dropped everywhere, so
 * "Óskarsson" is typed OSKARSSON.
 */
export function letters(text: string, icelandic: boolean): string {
  let s = text.toUpperCase()
  if (!icelandic) s = s.replace(/Þ/g, 'TH').replace(/Ð/g, 'D').replace(/Æ/g, 'AE').replace(/Ö/g, 'O')
  s = s.replace(/Ø/g, 'O').replace(/ß/g, 'SS').replace(/Œ/g, 'OE').replace(/Ł/g, 'L').replace(/Đ/g, 'D').replace(/İ/g, 'I').replace(/ẞ/g, 'SS')
  const keep = icelandic ? /[A-ZÞÐÆÖ]/ : /[A-Z]/
  return [...s].map((ch) => (keep.test(ch) ? ch : ch.normalize('NFD').replace(/[̀-ͯ]/g, '')))
    .join('').replace(icelandic ? /[^A-ZÞÐÆÖ]/g : /[^A-Z]/g, '')
}

export const targetWord = (name: string, icelandic: boolean) => letters(surname(name), icelandic)

/** Icelanders go by their first name: "Róbert Örn Óskarsson" is Róbert. */
export function firstName(name: string): string {
  return name.replace(/^(?:[A-ZÁÐÉÍÓÚÝÞÆÖ]\.\s*)+/, '').trim().split(/\s+/)[0]
}

export type Mark = 'hit' | 'near' | 'miss'

/** Wordle's marking: right place, elsewhere in the word, or not there, counting repeats. */
export function markGuess(guess: string, target: string): Mark[] {
  const g = [...guess], t = [...target]
  const marks: Mark[] = g.map(() => 'miss')
  const left = new Map<string, number>()
  g.forEach((ch, i) => {
    if (t[i] === ch) marks[i] = 'hit'
    else left.set(t[i], (left.get(t[i]) ?? 0) + 1)
  })
  g.forEach((ch, i) => {
    if (marks[i] === 'hit') return
    const n = left.get(ch) ?? 0
    if (n > 0) { marks[i] = 'near'; left.set(ch, n - 1) }
  })
  return marks
}
