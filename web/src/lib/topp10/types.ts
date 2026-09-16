import type { Level } from '../level'

/** Where a question belongs. */
export type Region = 'island' | 'enska' | 'evropa'

/** What an answer is, which decides the words the game uses for it. */
export type Kind = 'club' | 'player'

export interface Answer {
  /** one club or one player, the same id on every question it appears in */
  id: string
  label: string
  /** shown when the answers are revealed: "27 titlar", "3. sæti, 64 stig" */
  detail: string
  /**
   * Every spelling that counts as this answer, already normalised. A guess is
   * matched against these exactly, never as a substring: "paris" must not
   * open Paris Saint-Germain.
   */
  accept: string[]
}

/**
 * One Tenaball question: name any ten different answers from `answers`, which
 * holds every valid one. Two independent sources agreed on the whole set.
 */
export interface Topp10List {
  id: string
  region: Region
  level: Level
  kind: Kind
  /** the competition, above the game title */
  competition: string
  title: string
  question: string
  /** the point in time the answers hold for */
  context: string
  /** at least ten */
  answers: Answer[]
  sources: { name: string; url: string }[]
  /** the day both sources were last read and found to agree */
  verifiedAt: string
  note?: string
}
