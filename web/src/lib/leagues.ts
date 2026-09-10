import type { League } from './types'

/**
 * Per-league rules. Everything that used to be an `if (league === 'besta')`
 * lives here, so adding a competition is a config entry rather than a sweep
 * through the components.
 */
export interface LeagueConfig {
  id: League
  /** Shown in headings and the switcher. */
  name: string
  short: string
  /** Where matches come from. */
  source: 'ksi' | 'apif'
  /** API-Football league id (source 'apif' only). */
  apifId?: number
  /** Clubs in the league phase; null when the format is not a fixed table. */
  size: number | null
  /** Besta deild splits into halves after the regular rounds. */
  split: boolean
  /**
   * Places counted as continental qualification in the sim. For England this
   * is NOT fixed: the fifth place exists only while the association is in the
   * top two of UEFA's seasonal coefficient. Kept as the current allocation
   * until the coefficient tracker can supply it (scripts/uefa-coeff.mts).
   */
  europeSlots: number
  /** Places relegated. */
  relegationSlots: number
  /**
   * Elo is only comparable inside a pool of clubs that actually play each
   * other. Icelandic and English clubs never meet, so they are rated apart.
   */
  eloPool: string
}

export const LEAGUES: Record<League, LeagueConfig> = {
  besta: {
    id: 'besta', name: 'Besta deildin', short: 'Besta', source: 'ksi',
    size: 12, split: true, europeSlots: 3, relegationSlots: 2, eloPool: 'is',
  },
  lengjudeild: {
    id: 'lengjudeild', name: 'Lengjudeildin', short: 'Lengju', source: 'ksi',
    size: 12, split: false, europeSlots: 2, relegationSlots: 2, eloPool: 'is',
  },
  premier: {
    id: 'premier', name: 'Enska úrvalsdeildin', short: 'Enska', source: 'apif',
    apifId: 39, size: 20, split: false, europeSlots: 5, relegationSlots: 3, eloPool: 'eng',
  },
}

export const leagueConfig = (l: League) => LEAGUES[l]

/**
 * API-Football fixture ids overlap the KSÍ id range (both run into the
 * millions), so they are stored shifted clear of it and can be shifted back.
 */
export const APIF_ID_OFFSET = 1_000_000_000
export const toMatchId = (fixtureId: number) => APIF_ID_OFFSET + fixtureId
export const toFixtureId = (matchId: number) => matchId - APIF_ID_OFFSET
export const isApifMatch = (matchId: number) =>
  matchId >= APIF_ID_OFFSET && matchId < FEED_ID_OFFSET

/**
 * Flat-file feeds (datasets/football-datasets) carry no match id, so one is
 * built from the parts that identify the row. Composed rather than hashed —
 * 12k+ matches in a hashed space collide often enough to matter.
 */
export const FEED_ID_OFFSET = 2_000_000_000
export const feedMatchId = (season: number, leagueIndex: number, row: number) =>
  FEED_ID_OFFSET + (season - 1900) * 1_000_000 + leagueIndex * 100_000 + row
