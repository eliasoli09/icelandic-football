import { db } from './db'
import { feedMatchId } from './leagues'

/**
 * The season being played right now, from football-data.co.uk.
 *
 * The historical feeds only publish a season once it has finished, so on its
 * own the site would show last season's table from August until May. This
 * fills that gap: the source refreshes twice a week, needs no key and is not
 * scraped.
 */

const SECRET = () => process.env.CRON_SECRET!

/** football-data.co.uk division code -> our league, and its slot in the id scheme */
export const DIVISIONS = [
  { div: 'E0', league: 'premier', idx: 0 },
  { div: 'SP1', league: 'laliga', idx: 1 },
  { div: 'I1', league: 'seriea', idx: 2 },
  { div: 'D1', league: 'bundesliga', idx: 3 },
  { div: 'F1', league: 'ligue1', idx: 4 },
  { div: 'E1', league: 'championship', idx: 5 },
  { div: 'N1', league: 'eredivisie', idx: 6 },
  { div: 'P1', league: 'primeira', idx: 7 },
] as const

/**
 * Which season a date belongs to, named for the year it started. A European
 * season runs into May, so anything before July is still the season that
 * started the previous year.
 */
export const seasonForDate = (d = new Date()) =>
  d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1

/** 05/09/2026 + 17:30 -> 2026-09-05T17:30:00Z */
const stamp = (date: string, time: string) => {
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '00:00'
  return `${m[3]}-${m[2]}-${m[1]}T${t}:00Z`
}

export interface CurrentSeasonResult {
  season: number
  leagues: { league: string; matches?: number; newTeams?: string[]; error?: string }[]
}

export async function ingestCurrentSeason(
  season = seasonForDate(),
  opts: { dryRun?: boolean } = {},
): Promise<CurrentSeasonResult> {
  const code =
    String(season % 100).padStart(2, '0') + String((season + 1) % 100).padStart(2, '0')

  const ids = new Map<string, number>()
  const { data: teamRows, error: teamErr } = await db().from('teams').select('id, name')
  if (teamErr) throw teamErr
  for (const t of (teamRows ?? []) as { id: number; name: string }[]) ids.set(t.name, t.id)

  const ensureTeam = async (name: string) => {
    const known = ids.get(name)
    if (known) return known
    const { data, error } = await db().rpc('rpc_ensure_team', {
      p_secret: SECRET(),
      p_name: name,
    })
    if (error) throw error
    ids.set(name, data as number)
    return data as number
  }

  const leagues: CurrentSeasonResult['leagues'] = []
  for (const { div, league, idx } of DIVISIONS) {
    let text: string
    try {
      const res = await fetch(`https://www.football-data.co.uk/mmz4281/${code}/${div}.csv`, {
        redirect: 'follow',
      })
      if (!res.ok) {
        leagues.push({ league, error: `HTTP ${res.status}` })
        continue
      }
      text = (await res.text()).replace(/^﻿/, '')
    } catch (err) {
      leagues.push({ league, error: err instanceof Error ? err.message : String(err) })
      continue
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const head = lines.shift()?.split(',') ?? []
    const at = (r: string[], name: string) => (r[head.indexOf(name)] ?? '').trim()
    const played = lines
      .map((l) => l.split(','))
      .filter(
        (r) =>
          at(r, 'HomeTeam') && at(r, 'AwayTeam') && at(r, 'FTHG') !== '' && at(r, 'FTAG') !== '',
      )
    if (!played.length) {
      leagues.push({ league, matches: 0 })
      continue
    }

    // A row's position in the file shifts as the season fills in, so the id
    // comes from the pairing instead. Each pairing happens once a season, so
    // re-running updates the row it wrote last time rather than duplicating it.
    const clubs = [
      ...new Set(played.flatMap((r) => [at(r, 'HomeTeam'), at(r, 'AwayTeam')])),
    ].sort()
    const slot = new Map(clubs.map((c, i) => [c, i]))
    const newTeams = clubs.filter((c) => !ids.has(c))

    const rows: Record<string, unknown>[] = []
    for (const r of played) {
      const home = at(r, 'HomeTeam')
      const away = at(r, 'AwayTeam')
      rows.push({
        id: feedMatchId(season, idx, slot.get(home)! * 1000 + slot.get(away)!),
        season,
        league,
        phase: 'main',
        date: stamp(at(r, 'Date'), at(r, 'Time')),
        venue: null,
        home_team: opts.dryRun ? 0 : await ensureTeam(home),
        away_team: opts.dryRun ? 0 : await ensureTeam(away),
        home_goals: Number(at(r, 'FTHG')),
        away_goals: Number(at(r, 'FTAG')),
        status: 'played',
      })
    }
    if (new Set(rows.map((r) => r.id)).size !== rows.length) {
      throw new Error(`${league}: tvö leikjanúmer rákust á`)
    }

    if (!opts.dryRun) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db().rpc('rpc_upsert_matches', {
          p_secret: SECRET(),
          p_rows: rows.slice(i, i + 500),
        })
        if (error) throw error
      }
    }
    leagues.push({ league, matches: rows.length, newTeams: newTeams.length ? newTeams : undefined })
  }

  // The registry says which season each competition is playing, and the
  // dashboard reads it. Nothing used to write it, so it stayed on whatever the
  // last manual edit said and the site served a season that had finished.
  const loaded = leagues.filter((l) => l.matches).map((l) => ({ key: l.league, season }))
  if (!opts.dryRun && loaded.length) {
    const { error } = await db().rpc('rpc_set_league_seasons', {
      p_secret: SECRET(),
      p_rows: loaded,
    })
    if (error) throw error
  }
  return { season, leagues }
}
