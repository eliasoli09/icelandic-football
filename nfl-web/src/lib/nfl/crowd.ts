/**
 * Hvað velja Íslendingar? How many readers chose each side of a game, from the
 * pick'em and the game polls together; shown from five choices up.
 */
export interface Crowd { home: number; away: number }

export const CROWD_MIN = 5

/** The home side's share and the count, or null below the minimum. */
export function crowdShare(c: Crowd | undefined): { n: number; pHome: number } | null {
  const n = c ? c.home + c.away : 0
  return c && n >= CROWD_MIN ? { n, pHome: c.home / n } : null
}
