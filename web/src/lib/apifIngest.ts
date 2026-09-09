/**
 * Ingest a competition from API-Football into the same `matches`/`teams`
 * shape the KSÍ scraper produces, so the table, fixtures and model code do
 * not care where a league came from.
 */
import { db } from './db'
import { leagueConfig, toMatchId } from './leagues'
import type { League } from './types'

const BASE = 'https://v3.football.api-sports.io'
const SECRET = () => process.env.CRON_SECRET!

/** Statuses that mean the result is final; anything else has not been played. */
const FINAL = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])

interface ApifFixture {
  fixture: { id: number; date: string; status: { short: string }; venue: { name: string | null } }
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } }
  goals: { home: number | null; away: number | null }
}

async function apifGet(path: string) {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY vantar')
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': key }, cache: 'no-store' })
  if (!res.ok) throw new Error(`API-Football ${res.status} á ${path}`)
  const d = (await res.json()) as { errors: unknown; response: unknown[] }
  const errs = d.errors
  // the API reports plan/parameter problems in `errors` with HTTP 200
  if (errs && !Array.isArray(errs) && Object.keys(errs).length) {
    throw new Error(`API-Football: ${JSON.stringify(errs)}`)
  }
  return d.response ?? []
}

async function teamIdMap() {
  const { data, error } = await db().from('teams').select('id, name')
  if (error) throw error
  return new Map<string, number>((data ?? []).map((t) => [t.name, t.id]))
}

async function ensureTeam(name: string, ids: Map<string, number>) {
  if (ids.has(name)) return ids.get(name)!
  const { data, error } = await db().rpc('rpc_ensure_team', { p_secret: SECRET(), p_name: name })
  if (error) throw error
  ids.set(name, data as number)
  return data as number
}

export async function ingestApifLeague(league: League, season: number) {
  const cfg = leagueConfig(league)
  if (cfg.source !== 'apif' || !cfg.apifId) throw new Error(`${league} kemur ekki frá API-Football`)

  const fixtures = (await apifGet(`/fixtures?league=${cfg.apifId}&season=${season}`)) as ApifFixture[]
  const ids = await teamIdMap()
  const rows: Record<string, unknown>[] = []
  const crests = new Map<number, string>()

  for (const f of fixtures) {
    const homeId = await ensureTeam(f.teams.home.name, ids)
    const awayId = await ensureTeam(f.teams.away.name, ids)
    crests.set(homeId, f.teams.home.logo)
    crests.set(awayId, f.teams.away.logo)
    const played = FINAL.has(f.fixture.status.short) && f.goals.home !== null
    rows.push({
      id: toMatchId(f.fixture.id),
      season,
      league,
      phase: 'main',
      date: f.fixture.date,
      venue: f.fixture.venue?.name ?? null,
      home_team: homeId,
      away_team: awayId,
      home_goals: played ? f.goals.home : null,
      away_goals: played ? f.goals.away : null,
      status: played ? 'played' : 'upcoming',
    })
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().rpc('rpc_upsert_matches', {
      p_secret: SECRET(),
      p_rows: rows.slice(i, i + 500),
    })
    if (error) throw error
  }
  if (crests.size) {
    const { error } = await db().rpc('rpc_set_team_meta', {
      p_secret: SECRET(),
      p_rows: [...crests].map(([id, crest_url]) => ({ id, crest_url })),
    })
    if (error) throw error
  }

  const played = rows.filter((r) => r.status === 'played').length
  return { league, season, fixtures: rows.length, played, teams: crests.size }
}
