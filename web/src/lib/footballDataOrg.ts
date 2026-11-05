import { checkMapping, type MappingCheck } from './fixtureCalendar'

/**
 * football-data.org (v4 API, free tier with a personal token).
 *
 * The current season of the eight foreign leagues comes from here: results,
 * every remaining fixture with its kick-off, and postponements. It updates
 * within minutes of a final whistle, where the football-data.co.uk CSV only
 * refreshes twice a week - that CSV now contributes xG and nothing else.
 *
 * The decisive reason for the switch is the match id. The CSV carries none, so
 * one used to be derived from each club's alphabetical slot in the file; when
 * the set of names changed mid-season every slot shifted and old results stayed
 * behind under their old ids (the Championship ended up with Wrexham on 39
 * games after 15 rounds). football-data.org gives every match a permanent id.
 *
 * Free tier: 10 requests a minute, so one call per league and a wait on 429.
 */

/** football-data.org ids are ~5.6e5 today; lifted clear of every other range */
export const FDORG_ID_OFFSET = 4_000_000_000
export const fdMatchId = (id: number) => FDORG_ID_OFFSET + id

/** competition code -> our league */
export const FD_COMPETITIONS = [
  { code: 'PL', league: 'premier' },
  { code: 'PD', league: 'laliga' },
  { code: 'SA', league: 'seriea' },
  { code: 'BL1', league: 'bundesliga' },
  { code: 'FL1', league: 'ligue1' },
  { code: 'ELC', league: 'championship' },
  { code: 'DED', league: 'eredivisie' },
  { code: 'PPL', league: 'primeira' },
] as const

/**
 * football-data.org's full club names mostly follow openfootball's, so the
 * explicit table in fixtureCalendar covers them. These are the ones it spells
 * its own way. Written out, never guessed - see Lærdómur/Nafnavörpun.
 */
export const FD_NAMES: Record<string, string> = {
  'Vitória SC': 'Guimaraes',
}

export interface FdMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  stage: string
  homeTeam: { id: number | null; name: string | null }
  awayTeam: { id: number | null; name: string | null }
  score: { fullTime: { home: number | null; away: number | null } }
}

const BASE = 'https://api.football-data.org/v4'

/** One competition's season. Waits out the per-minute limit once if it hits it. */
export async function fetchFdSeason(
  code: string,
  season: number,
  token = process.env.FOOTBALL_DATA_TOKEN,
): Promise<FdMatch[]> {
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN vantar')
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/competitions/${code}/matches?season=${season}`, {
      headers: { 'X-Auth-Token': token },
      cache: 'no-store',
    })
    if (res.status === 429) {
      const wait = Number(res.headers.get('X-RequestCounter-Reset') ?? 60)
      await new Promise((r) => setTimeout(r, (Math.min(wait, 65) + 1) * 1000))
      continue
    }
    if (!res.ok) throw new Error(`football-data.org ${code}: HTTP ${res.status}`)
    const body = (await res.json()) as { matches?: FdMatch[] }
    if (!Array.isArray(body.matches)) throw new Error(`football-data.org ${code}: engir leikir í svari`)
    return body.matches
  }
  throw new Error(`football-data.org ${code}: 429 þrisvar`)
}

/** Map football-data.org club names onto ours; refused unless it is a bijection. */
export function mapFdClubs(fdNames: string[], ourClubs: string[]): MappingCheck {
  const pre = fdNames.map((n) => FD_NAMES[n] ?? n)
  const check = checkMapping(pre, ourClubs)
  // key the result by the original football-data.org name
  const mapped = new Map<string, string>()
  fdNames.forEach((n, i) => {
    const to = check.mapped.get(pre[i])
    if (to) mapped.set(n, to)
  })
  return { ...check, mapped }
}

export type FdRowStatus = 'played' | 'upcoming' | 'skip'

/**
 * How a football-data.org match lands in our two-state model. A match in
 * progress stays upcoming until it is over. Postponed, suspended and cancelled
 * league matches are almost always replayed, so they stay on the calendar
 * without a date - the same way the openfootball path treated "[postponed]".
 */
export function fdStatus(m: FdMatch): { status: FdRowStatus; dated: boolean } {
  const ft = m.score?.fullTime
  const hasScore = ft?.home != null && ft?.away != null
  switch (m.status) {
    case 'FINISHED':
    case 'AWARDED':
      return hasScore ? { status: 'played', dated: true } : { status: 'skip', dated: false }
    case 'SCHEDULED':
    case 'TIMED':
    case 'IN_PLAY':
    case 'PAUSED':
    case 'LIVE':
      return { status: 'upcoming', dated: true }
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return { status: 'upcoming', dated: false }
    default:
      return { status: 'skip', dated: false }
  }
}
