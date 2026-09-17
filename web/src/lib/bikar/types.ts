export type Line = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface CupPlayer {
  /** KSÍ player id */
  id: number
  name: string
  line: Line
  /** Transfermarkt position (CB, CM, ST…) */
  position: string
  rating: number
  starts: number
  goals: number
}

export interface EuropeTie { season: string; club: string; round: string; opponent: string; aggregate: string; through: boolean }

export interface CupSide {
  id: string
  club: string
  label: string
  year: number
  /** place among the greatest sides, 1 the best */
  rank: number
  score: number
  champion: boolean
  position: number
  cupDouble: boolean
  record: { w: number; d: number; l: number; gf: number; ga: number; games: number; points: number }
  basis: string
  europe: { tiesWon: number; mainPhase: boolean; knockout: boolean }
  europeTies: EuropeTie[]
  /** the average rating of its best eleven, or null without a full eleven */
  strength: number | null
  players: CupPlayer[]
}
