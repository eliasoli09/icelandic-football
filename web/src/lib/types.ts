export type League = 'besta' | 'lengjudeild'
export type Phase = 'main' | 'efri' | 'nedri' | 'umspil'

export interface ParsedMatch {
  /** KSÍ leikur id; null for future fixtures KSÍ hasn't linked yet */
  ksiId: number | null
  home: string
  away: string
  homeGoals: number | null
  awayGoals: number | null
  status: 'played' | 'upcoming'
  date: string | null // ISO, Iceland is UTC year-round
  venue: string | null
}

export type EventType =
  | 'goal'
  | 'owngoal'
  | 'penalty'
  | 'yellow'
  | 'red'
  | 'sub_in'
  | 'sub_out'

export interface MatchEvent {
  eventId: number
  minute: number
  type: EventType
  playerKsiId: number | null
  playerName: string
  side: 'home' | 'away'
}

export interface DbMatch {
  id: number
  season: number
  league: League
  phase: Phase
  date: string | null
  venue: string | null
  home_team: number
  away_team: number
  home_goals: number | null
  away_goals: number | null
  status: 'played' | 'upcoming'
}

export interface EloRecord {
  teamId: number
  matchId: number
  date: string | null
  eloBefore: number
  eloAfter: number
}

export interface PredictionFactors {
  eloHome: number
  eloAway: number
  eloDiff: number
  formHome: string
  formAway: string
  gfHome: number
  gaHome: number
  gfAway: number
  gaAway: number
  h2h: { homeWins: number; draws: number; awayWins: number }
  homeAdvantage: number
}

export interface Prediction {
  pHome: number
  pDraw: number
  pAway: number
  lambdaHome: number
  lambdaAway: number
  topScorelines: { home: number; away: number; p: number }[]
  factors: PredictionFactors
}
