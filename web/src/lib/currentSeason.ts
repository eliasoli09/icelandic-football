import { db } from './db'
import { FD_COMPETITIONS, fdMatchId, fdStatus, fetchFdSeason, mapFdClubs } from './footballDataOrg'

/**
 * The season being played right now for the eight foreign leagues.
 *
 * Results and the whole remaining calendar come from football-data.org (see
 * footballDataOrg.ts), keyed on its permanent match ids. football-data.co.uk's
 * CSV refreshes only twice a week and carries no id, so it now contributes one
 * thing: xG, which it has published since 2026/27 and nothing else does.
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

export interface CurrentSeasonResult {
  season: number
  leagues: {
    league: string
    played?: number
    upcoming?: number
    /** of the played matches, how many the xG feed has caught up with */
    withXg?: number
    newTeams?: string[]
    /** CSV and football-data.org disagree on a score (football-data.org wins) */
    mismatches?: string[]
    error?: string
  }[]
}

/**
 * The CSV occasionally spells a club differently for a single row - "Sheffield
 * Utd" once on 3 Nov 2026 among thirteen "Sheffield United". That one row gave
 * the Championship a 25th club, shifted every slot-derived id and left 67
 * phantom results behind. Known variants fold onto the canonical name here.
 */
const CSV_ALIASES: Record<string, string> = {
  'Sheffield Utd': 'Sheffield United',
}
const csvName = (n: string) => CSV_ALIASES[n] ?? n

interface CsvResult { hg: number; ag: number; hxg: number | null; axg: number | null }

/** football-data.co.uk's CSV for one division: pairing -> result and xG */
async function fetchCsv(code: string, div: string): Promise<Map<string, CsvResult> | null> {
  try {
    const res = await fetch(`https://www.football-data.co.uk/mmz4281/${code}/${div}.csv`, {
      redirect: 'follow',
    })
    if (!res.ok) return null
    const lines = (await res.text()).replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim())
    const head = lines.shift()?.split(',') ?? []
    const at = (r: string[], name: string) => (r[head.indexOf(name)] ?? '').trim()
    const out = new Map<string, CsvResult>()
    for (const l of lines) {
      const r = l.split(',')
      if (!at(r, 'HomeTeam') || !at(r, 'AwayTeam') || at(r, 'FTHG') === '' || at(r, 'FTAG') === '') continue
      out.set(`${csvName(at(r, 'HomeTeam'))}|${csvName(at(r, 'AwayTeam'))}`, {
        hg: Number(at(r, 'FTHG')),
        ag: Number(at(r, 'FTAG')),
        hxg: at(r, 'HxG') === '' ? null : Number(at(r, 'HxG')),
        axg: at(r, 'AxG') === '' ? null : Number(at(r, 'AxG')),
      })
    }
    return out
  } catch {
    return null
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
  for (const { code: fdCode, league } of FD_COMPETITIONS) {
    const div = DIVISIONS.find((d) => d.league === league)!.div
    let fd
    try {
      fd = await fetchFdSeason(fdCode, season)
    } catch (err) {
      leagues.push({ league, error: err instanceof Error ? err.message : String(err) })
      continue
    }
    const fdClubs = [
      ...new Set(fd.flatMap((m) => [m.homeTeam.name, m.awayTeam.name]).filter((n): n is string => !!n)),
    ].sort()
    if (!fdClubs.length) { leagues.push({ league, played: 0, upcoming: 0 }); continue }

    // Whose names do we map onto? First the CSV's clubs, then the clubs this
    // league already has rows for this season - both are spelt our way. Last,
    // every club we know, where each football-data.org name must land on an
    // existing club by exact normalised match (never a substring). Anything
    // short of a bijection leaves the league untouched tonight.
    const csv = await fetchCsv(code, div)
    const candidates: string[][] = []
    if (csv) candidates.push([...new Set([...csv.keys()].flatMap((k) => k.split('|')))])
    const { data: seasonRows, error: seasonErr } = await db()
      .from('matches').select('home_team, away_team')
      .eq('league', league).eq('season', season)
    if (seasonErr) throw seasonErr
    const byId = new Map([...ids].map(([n, i]) => [i, n]))
    candidates.push([...new Set(((seasonRows ?? []) as { home_team: number; away_team: number }[])
      .flatMap((r) => [byId.get(r.home_team), byId.get(r.away_team)])
      .filter((n): n is string => !!n))])
    let check = null as ReturnType<typeof mapFdClubs> | null
    for (const ours of candidates) {
      if (ours.length !== fdClubs.length) continue
      check = mapFdClubs(fdClubs, ours)
      if (check.ok) break
    }
    if (!check?.ok) {
      const all = mapFdClubs(fdClubs, [...ids.keys()])
      const mapped = new Map([...all.mapped].filter(([from]) => fdClubs.includes(from)))
      const unmapped = fdClubs.filter((c) => !mapped.has(c))
      const targets = [...mapped.values()]
      const collisions = targets.filter((t, i) => targets.indexOf(t) !== i)
      check = { ok: !unmapped.length && !collisions.length, mapped, unmapped, unused: [], collisions }
    }
    if (!check.ok) {
      leagues.push({
        league,
        error: [
          check.unmapped.length ? `óþekkt: ${check.unmapped.join(', ')}` : '',
          ...check.collisions,
        ].filter(Boolean).join('; ') || 'vörpun ekki gagntæk',
      })
      continue
    }

    const rows: Record<string, unknown>[] = []
    const mismatches: string[] = []
    let played = 0, upcoming = 0, withXg = 0
    for (const m of fd) {
      const { status, dated } = fdStatus(m)
      if (status === 'skip' || !m.homeTeam.name || !m.awayTeam.name) continue
      const home = check.mapped.get(m.homeTeam.name)!
      const away = check.mapped.get(m.awayTeam.name)!
      const ft = m.score.fullTime
      const x = status === 'played' ? csv?.get(`${home}|${away}`) : undefined
      if (x && (x.hg !== ft.home || x.ag !== ft.away)) {
        mismatches.push(`${home}-${away}: ${ft.home}-${ft.away} / csv ${x.hg}-${x.ag}`)
      }
      if (status === 'played') played++; else upcoming++
      if (x?.hxg != null) withXg++
      rows.push({
        id: fdMatchId(m.id),
        season,
        league,
        phase: 'main',
        date: dated ? m.utcDate : null,
        venue: null,
        home_team: opts.dryRun ? 0 : await ensureTeam(home),
        away_team: opts.dryRun ? 0 : await ensureTeam(away),
        home_goals: status === 'played' ? ft.home : null,
        away_goals: status === 'played' ? ft.away : null,
        status,
        home_xg: x?.hxg ?? null,
        away_xg: x?.axg ?? null,
      })
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
    const newTeams = [...check.mapped.values()].filter((n) => !ids.has(n))
    leagues.push({
      league, played, upcoming, withXg,
      newTeams: newTeams.length ? newTeams : undefined,
      mismatches: mismatches.length ? mismatches : undefined,
    })
  }

  // The registry says which season each competition is playing, and the
  // dashboard reads it. Nothing used to write it, so it stayed on whatever the
  // last manual edit said and the site served a season that had finished.
  const loaded = leagues.filter((l) => l.played).map((l) => ({ key: l.league, season }))
  if (!opts.dryRun && loaded.length) {
    const { error } = await db().rpc('rpc_set_league_seasons', {
      p_secret: SECRET(),
      p_rows: loaded,
    })
    if (error) throw error
  }
  return { season, leagues }
}
