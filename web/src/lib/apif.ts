/**
 * API-Football (api-sports.io) live layer for the World Cup: fixture-id
 * mapping and in-play scores/events. Requires the paid plan for season 2026.
 * Display/tracking only — never feeds the prediction model.
 */
import type { ApifEvent } from './vaktin'

const BASE = 'https://v3.football.api-sports.io'
const KEY = () => process.env.API_FOOTBALL_KEY

export const WC_LEAGUE_ID = 1
export const WC_SEASON = 2026

/** Fixture statuses that mean the result is final. */
const FINAL = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])

async function apifGet(path: string): Promise<Record<string, unknown>[] | null> {
  const key = KEY()
  if (!key) return null
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const d = (await res.json()) as { errors: unknown; response: Record<string, unknown>[] }
  if (d.errors && Object.keys(d.errors).length) return null
  return d.response
}

export interface ApifFixtureLite {
  id: number
  date: string
  home: string
  away: string
}

/** All WC fixtures from API-Football (one call). */
export async function fetchWcFixtures(): Promise<ApifFixtureLite[]> {
  const rows = await apifGet(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`)
  if (!rows) return []
  return rows.map((r) => {
    const f = r as { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } } }
    return { id: f.fixture.id, date: f.fixture.date, home: f.teams.home.name, away: f.teams.away.name }
  })
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

/** Loose team-name equality across the two data sources. */
export function teamNamesMatch(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  return x === y || x.includes(y) || y.includes(x)
}

/** Pair a feed match (date + names) with an API-Football fixture. */
export function matchFixture(
  feedDate: string,
  home: string,
  away: string,
  fixtures: ApifFixtureLite[],
): number | null {
  const t = new Date(feedDate).getTime()
  const candidates = fixtures.filter((f) => Math.abs(new Date(f.date).getTime() - t) < 2 * 3600_000)
  const hit = candidates.find(
    (f) => teamNamesMatch(f.home, home) && teamNamesMatch(f.away, away),
  ) ?? candidates.find((f) => teamNamesMatch(f.home, home) || teamNamesMatch(f.away, away))
  return hit?.id ?? null
}

export interface LiveFixture {
  status: string
  finished: boolean
  elapsed: number | null
  goalsHome: number | null
  goalsAway: number | null
  events: ApifEvent[]
}

/** Live score + events for one fixture (single API call). */
export async function fetchLiveFixture(fixtureId: number): Promise<LiveFixture | null> {
  const rows = await apifGet(`/fixtures?id=${fixtureId}`)
  const f = rows?.[0] as
    | {
        fixture: { status: { short: string; elapsed: number | null } }
        goals: { home: number | null; away: number | null }
        events?: { type: string; detail: string; player: { name: string | null }; team: { name: string | null } }[]
      }
    | undefined
  if (!f) return null
  return {
    status: f.fixture.status.short,
    finished: FINAL.has(f.fixture.status.short),
    elapsed: f.fixture.status.elapsed ?? null,
    goalsHome: f.goals.home,
    goalsAway: f.goals.away,
    events: (f.events ?? []).map((e) => ({
      type: e.type,
      detail: e.detail,
      player: { name: e.player?.name ?? null },
      team: { name: e.team?.name ?? null },
    })),
  }
}

/** Module-level cache so many viewers of one match share a single API call. */
const liveCache = new Map<number, { at: number; data: LiveFixture | null }>()
const LIVE_TTL_MS = 45_000

export async function cachedLiveFixture(fixtureId: number): Promise<LiveFixture | null> {
  const hit = liveCache.get(fixtureId)
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.data
  const data = await fetchLiveFixture(fixtureId)
  liveCache.set(fixtureId, { at: Date.now(), data })
  return data
}
