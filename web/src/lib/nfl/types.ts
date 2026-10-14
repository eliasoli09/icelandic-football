export type GameType = 'REG' | 'WC' | 'DIV' | 'CON' | 'SB'
export type Conference = 'AFC' | 'NFC'
export type Division = 'East' | 'North' | 'South' | 'West'

export const CONFERENCES: Conference[] = ['AFC', 'NFC']
export const DIVISIONS: Division[] = ['East', 'North', 'South', 'West']

export interface NflTeam {
  abbr: string
  franchise: string
  name: string
  conference: Conference
  division: Division
  color: string
  color2: string
  logo: string
}

export interface NflGame {
  game_id: string
  season: number
  game_type: GameType
  week: number
  kickoff: string
  time_tbd: boolean
  away: string
  home: string
  away_score: number | null
  home_score: number | null
  overtime: boolean
  neutral: boolean
  spread_line: number | null
  total_line: number | null
  away_ml: number | null
  home_ml: number | null
  div_game: boolean
  stadium: string | null
  roof: string | null
  away_qb: string | null
  home_qb: string | null
}

/** Old abbreviations point at the club that carries the history today. */
export const FRANCHISE: Record<string, string> = { OAK: 'LV', SD: 'LAC', STL: 'LA', LAR: 'LA' }

export const isPlayed = (g: Pick<NflGame, 'home_score' | 'away_score'>) =>
  g.home_score !== null && g.away_score !== null
