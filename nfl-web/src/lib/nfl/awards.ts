export type Award = 'MVP' | 'OPOY' | 'DPOY' | 'OROY' | 'DROY' | 'CPOY'
export const AWARDS: Award[] = ['MVP', 'OPOY', 'DPOY', 'OROY', 'DROY', 'CPOY']

/** Icelandic names from the glossary (NFL/Orðasafn); the English short form stays as the badge. */
export const AWARD_LABEL: Record<Award, string> = {
  MVP: 'Verðmætasti leikmaðurinn',
  OPOY: 'Sóknarmaður ársins',
  DPOY: 'Varnarmaður ársins',
  OROY: 'Sóknarnýliði ársins',
  DROY: 'Varnarnýliði ársins',
  CPOY: 'Endurkoma ársins',
}

export interface AwardWinner {
  season: number
  award: Award
  name: string
  position: string | null
  team: string | null
  /** Linked only on an exact, unambiguous name match among players of that season (1999 on). */
  player_id: string | null
}
