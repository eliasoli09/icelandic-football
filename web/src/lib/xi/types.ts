export type Side = 'home' | 'away'

export interface XiPlayer {
  number: number
  /** full name, shown once the player is found or revealed */
  name: string
  /** what is guessed, letters only: "OSKARSSON" */
  word: string
  /** 0 goalkeeper, 1 defence, 2 holding midfield, 3 midfield, 4 attacking midfield and wings, 5 attack */
  line: number
  /** left to right within the line */
  x: number
  /** set only when both sources name the same captain */
  captain?: true
  /** set only when both sources credit the same goals */
  goals?: number
}

export interface XiTeam {
  name: string
  /** shirt colour */
  color: string
  /** number colour on the shirt */
  ink: string
  /** Icelandic names keep Þ, Ð, Æ and Ö, and the keyboard offers them */
  icelandic: boolean
  players: XiPlayer[]
}

export interface XiMatch {
  id: string
  region: 'island' | 'enska' | 'evropa'
  competition: string
  stage: string
  date: string
  /** why the match is remembered, without naming anyone in either eleven */
  blurb: string
  score: { home: number; away: number; note?: string }
  home: XiTeam
  away: XiTeam
  /** where the positions on the pitch come from */
  layout: string
  sources: { name: string; url: string }[]
  verifiedAt: string
}
