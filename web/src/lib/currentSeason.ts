import { db } from './db'
import { feedMatchId } from './leagues'
import { CALENDAR_SOURCES, parseCalendar, checkMapping } from './fixtureCalendar'

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
/** the Premier League's own API writes names the results feed spells differently */
const FPL_ALIAS: Record<string, string> = {
  'Man Utd': 'Man United', Spurs: 'Tottenham',
  'Hull City': 'Hull', 'Ipswich Town': 'Ipswich', 'Coventry City': 'Coventry',
}

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
  /** fixtures still to play, written so the site has something to show ahead */
  fixtures?: {
    written: number
    byLeague: Record<string, number>
    /** what the full-season calendar contributed, or why it did not */
    calendars?: Record<string, string>
    error?: string
  }
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
  /** league -> its club slots, so a fixture and the result it becomes share an id */
  const slots = new Map<string, { idx: number; slot: Map<string, number> }>()
  /** ids that already carry a result, and must never be overwritten by a fixture */
  const settled = new Set<number>()
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
    slots.set(league, { idx, slot })
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
        // carried since 2026/27; a better read on the next match than the
        // goals actually scored, so it is stored as it arrives
        home_xg: at(r, 'HxG') === '' ? null : Number(at(r, 'HxG')),
        away_xg: at(r, 'AxG') === '' ? null : Number(at(r, 'AxG')),
      })
    }
    if (new Set(rows.map((r) => r.id)).size !== rows.length) {
      throw new Error(`${league}: tvö leikjanúmer rákust á`)
    }
    for (const r of rows) settled.add(r.id as number)

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

  // ── fixtures still to play ────────────────────────────────────────
  // Results alone leave the site with nothing to show ahead of a match. These
  // rows carry the same pairing-derived id as the result they will become, so
  // the next ingest overwrites the fixture in place instead of adding a second
  // copy of the match.
  const fixtures: Record<string, unknown>[] = []
  const seenFixture = new Set<number>()
  const addFixture = async (
    league: string, home: string, away: string, date: string | null,
  ) => {
    const s = slots.get(league)
    const h = s?.slot.get(home)
    const a = s?.slot.get(away)
    // a club that has not played yet has no slot, and inventing one would
    // collide with the id the result gets later — skip rather than guess
    if (s === undefined || h === undefined || a === undefined) return false
    const id = feedMatchId(season, s.idx, h * 1000 + a)
    // The upsert would write null goals and status 'upcoming' straight over a
    // finished match, so a pairing that already has a result is never a fixture.
    if (settled.has(id) || seenFixture.has(id)) return false
    seenFixture.add(id)
    fixtures.push({
      id, season, league, phase: 'main', date, venue: null,
      home_team: opts.dryRun ? 0 : await ensureTeam(home),
      away_team: opts.dryRun ? 0 : await ensureTeam(away),
      home_goals: null, away_goals: null, status: 'upcoming',
    })
    return true
  }

  let fixtureError: string | undefined
  try {
    const res = await fetch('https://www.football-data.co.uk/fixtures.csv', { redirect: 'follow' })
    if (res.ok) {
      const text = (await res.text()).replace(/^\ufeff/, '')
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const head = lines.shift()?.split(',') ?? []
      const at = (r: string[], n: string) => (r[head.indexOf(n)] ?? '').trim()
      const byDiv = new Map<string, string>(DIVISIONS.map((d) => [d.div, d.league]))
      for (const line of lines) {
        const r = line.split(',')
        const league = byDiv.get(at(r, 'Div'))
        if (!league) continue
        await addFixture(league, at(r, 'HomeTeam'), at(r, 'AwayTeam'), stamp(at(r, 'Date'), at(r, 'Time')))
      }
    }
  } catch (err) {
    fixtureError = err instanceof Error ? err.message : String(err)
  }

  // England publishes its whole season, so it is the one league that can show
  // every remaining fixture rather than the next few days.
  try {
    const [fxRes, teamRes] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/fixtures/'),
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/'),
    ])
    if (fxRes.ok && teamRes.ok) {
      const boot = (await teamRes.json()) as { teams: { id: number; name: string }[] }
      const club = new Map(boot.teams.map((t) => [t.id, FPL_ALIAS[t.name] ?? t.name]))
      for (const f of (await fxRes.json()) as {
        finished: boolean; kickoff_time: string | null; team_h: number; team_a: number
      }[]) {
        if (f.finished) continue
        const home = club.get(f.team_h), away = club.get(f.team_a)
        if (!home || !away) continue
        await addFixture('premier', home, away, f.kickoff_time)
      }
    }
  } catch (err) {
    fixtureError ??= err instanceof Error ? err.message : String(err)
  }

  // The results feed publishes only the next few days. openfootball carries a
  // date and a kick-off time for every match of the season, so the rest of the
  // calendar comes from there — but only for a league whose clubs pair up with
  // ours exactly, since a near-miss would hand one club's season to another.
  const calendars: Record<string, string> = {}
  for (const [league, url] of Object.entries(CALENDAR_SOURCES)) {
    const s = slots.get(league)
    if (!s) continue
    try {
      const res = await fetch(url)
      if (!res.ok) { calendars[league] = `HTTP ${res.status}`; continue }
      const parsed = parseCalendar(await res.text())
      const theirs = [...new Set(parsed.flatMap((m) => [m.home, m.away]))]
      const check = checkMapping(theirs, [...s.slot.keys()])
      if (!check.ok) {
        calendars[league] = [
          check.unmapped.length ? `óþekkt: ${check.unmapped.join(', ')}` : '',
          check.unused.length ? `vantar: ${check.unused.join(', ')}` : '',
          ...check.collisions,
        ].filter(Boolean).join('; ')
        continue
      }
      let added = 0
      for (const m of parsed) {
        if (m.played) continue
        const home = check.mapped.get(m.home)!
        const away = check.mapped.get(m.away)!
        const when = m.date ? `${m.date}T${m.time ?? '00:00'}:00Z` : null
        if (await addFixture(league, home, away, when)) added++
      }
      calendars[league] = `${added} leikir`
    } catch (err) {
      calendars[league] = err instanceof Error ? err.message : String(err)
    }
  }

  if (!opts.dryRun && fixtures.length) {
    for (let i = 0; i < fixtures.length; i += 500) {
      const { error } = await db().rpc('rpc_upsert_matches', {
        p_secret: SECRET(),
        p_rows: fixtures.slice(i, i + 500),
      })
      if (error) throw error
    }
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
  const byLeague: Record<string, number> = {}
  for (const f of fixtures) byLeague[f.league as string] = (byLeague[f.league as string] ?? 0) + 1
  return {
    season, leagues,
    fixtures: { written: fixtures.length, byLeague, calendars, error: fixtureError },
  }
}
