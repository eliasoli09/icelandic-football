export const UEFA_COMPETITIONS = [
  { key: 'ucl', name: 'Meistaradeildin' },
  { key: 'uel', name: 'Evrópudeildin' },
  { key: 'uecl', name: 'Sambandsdeildin' },
] as const
export type UefaCompetition = typeof UEFA_COMPETITIONS[number]
export type UefaCompetitionKey = UefaCompetition['key']
export function getUefaCompetition(key?: string): UefaCompetition {
  return UEFA_COMPETITIONS.find(competition=>competition.key===key) ?? UEFA_COMPETITIONS[0]
}
