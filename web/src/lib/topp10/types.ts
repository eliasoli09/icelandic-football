/** Where a list belongs, which is also the tab it shows under. */
export type Region = 'island' | 'enska' | 'evropa'

export interface Answer {
  /** 1-based place; players or clubs level on the deciding figure share one */
  rank: number
  /** shown once the slot opens */
  label: string
  /** the figure beside it: "27 titlar", "19 mörk" */
  detail: string
  /**
   * Every spelling that counts as this answer, already normalised when the
   * list was built. A guess is matched against these exactly, never as a
   * substring — "paris" must not open Paris SG.
   */
  accept: string[]
  /** what a hint reveals; the first letter of the label when absent */
  hint?: string
  /** when a slot stands for something other than its answer, such as a year */
  slot?: string
}

export interface Topp10List {
  id: string
  region: Region
  title: string
  question: string
  /** ties at the last place make a list longer than ten, never shorter */
  answers: Answer[]
  /** at least two, and independent of each other */
  sources: { name: string; url: string }[]
  /** the day both sources were last read and found to agree */
  verifiedAt: string
  note?: string
}
