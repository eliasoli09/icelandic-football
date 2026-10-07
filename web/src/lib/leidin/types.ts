/** What a right answer is worth: the rarer, the further the player runs. */
export type Tier = 10 | 25 | 50 | 75 | 100

export const TIERS: Tier[] = [10, 25, 50, 75, 100]

/**
 * The kind of question a daily road draws from. Each day takes one from most
 * slots, so a road never asks three scorer questions in a row.
 */
export type Slot = 'felog' | 'ar' | 'markaskorarar' | 'lidid' | 'landslid' | 'serstakt' | 'utlond'

/** What an answer is, which decides the words used for it and the names suggested. */
export type Kind = 'club' | 'player' | 'year' | 'nation' | 'town'

export interface LeidAnswer {
  id: string
  label: string
  /** shown after the answer: "12 mörk", "27 titlar" */
  detail: string
  points: Tier
  /** every spelling that counts, already normalised; matched exactly */
  accept: string[]
}

export interface LeidQuestion {
  id: string
  slot: Slot
  kind: Kind
  /** "Nefndu leikmann sem skoraði fyrir KR í Bestu deildinni 2025" */
  prompt: string
  /** the small line under the prompt: what counts, and up to when */
  context: string
  /** every valid answer, most common first */
  answers: LeidAnswer[]
  /** how the points were decided, in one line */
  rarity: string
  sources: { name: string; url: string }[]
  verifiedAt: string
}
