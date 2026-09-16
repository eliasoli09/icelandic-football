/** How hard a puzzle is. Each game has its own daily puzzle at every level. */
export type Level = 'easy' | 'medium' | 'hard'

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'easy', label: 'Létt' },
  { id: 'medium', label: 'Miðlungs' },
  { id: 'hard', label: 'Erfitt' },
]

export const isLevel = (x: unknown): x is Level => x === 'easy' || x === 'medium' || x === 'hard'
