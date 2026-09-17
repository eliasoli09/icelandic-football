import type { Level } from '../level'

export interface CareerRow {
  /** the season the spell began, as Wikipedia gives it */
  from: number
  /** the last season, null while he is still there */
  to: number | null
  club: string
  loan: boolean
}

export interface WhoPlayer {
  /** Wikidata item */
  id: string
  level: Level
  region: 'island' | 'erlendis'
  name: string
  /** normalised names that count as the right answer */
  accept: string[]
  career: CareerRow[]
  hints: {
    position: string
    born: number
    /** the senior national team, in Icelandic, or null if he never played for one */
    national: string | null
    initials: string
  }
  sources: { name: string; url: string }[]
  verifiedAt: string
}
