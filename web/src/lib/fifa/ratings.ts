import data from './ratings.json'

export interface FifaPlayer {
  id: number
  name: string
  team: string
  /** FIFA code (ST, CB…) from Transfermarkt, or a broad DEF/MID/FWD from the statistics, or null */
  position: string | null
  nation: string | null
  born: number | null
  basis: 'sofascore' | 'líkan' | 'líkan undir línu'
  apps: number
  starts: number
  minutes: number
  goals: number
  rating: number
}

export const FIFA = data as unknown as {
  season: number
  updated: string
  matches: number
  sofascoreSnapshot: string
  line: number
  model: { weights: Record<string, number>; sigma: number; crossValidation: { correlation: number; auc: number; players: number } }
  players: FifaPlayer[]
}

export type Line = 'GK' | 'DEF' | 'MID' | 'FWD'
const LINES: Record<string, Line> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DEF: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID', MID: 'MID',
  LW: 'FWD', RW: 'FWD', CF: 'FWD', ST: 'FWD', FWD: 'FWD',
}
export const lineOf = (position: string | null): Line | null => (position ? LINES[position] ?? null : null)

/** FIFA's card colours: gold from 75, silver from 65, bronze below. */
export const tier = (rating: number) => (rating >= 75 ? 'gold' : rating >= 65 ? 'silver' : 'bronze')
