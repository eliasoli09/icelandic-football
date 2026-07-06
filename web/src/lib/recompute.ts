import { db } from './db'
import { fetchTournamentMatches } from './ksi'
import { fetchMatchEvents, validateEvents } from './ksiEvents'
import { runElo, currentRatings, type EloMatch } from './elo'
import { runPlayerElo, type PlayerMatchInput } from './playerElo'
import { predictMatch, type TeamSeasonRates } from './predict'
import {
  simulateSeason,
  simulateScorerRace,
  type SimTeamState,
  type SimFixture,
  type ScorerState,
} from './simulate'
import type { League, Phase, MatchEvent } from './types'
import { runBelt, computeH2H, computeAllTime, type BeltMatch } from './belt'

export const CURRENT_SEASON = 2026
export const TOURNAMENTS_2026: { id: number; league: League; phase: Phase }[] = [
  { id: 7025510, league: 'besta', phase: 'main' },
  { id: 7025527, league: 'besta', phase: 'efri' },
  { id: 7025532, league: 'besta', phase: 'nedri' },
  { id: 7025540, league: 'lengjudeild', phase: 'main' },
  { id: 7025545, league: 'lengjudeild', phase: 'umspil' },
]

const SECRET = () => process.env.CRON_SECRET!

/** Stable negative id for future fixtures KSÍ hasn't assigned a match id yet. */
export function syntheticId(
  season: number,
  league: string,
  phase: string,
  homeTeam: number,
  awayTeam: number,
) {
  const s = `${season}|${league}|${phase}|${homeTeam}|${awayTeam}`
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return -(h + 1000)
}

async function teamIdMap() {
  const { data, error } = await db().from('teams').select('id, name')
  if (error) throw error
  return new Map<string, number>(data.map((t) => [t.name, t.id]))
}

async function ensureTeam(name: string, ids: Map<string, number>) {
  if (ids.has(name)) return ids.get(name)!
  const { data, error } = await db().rpc('rpc_ensure_team', {
    p_secret: SECRET(),
    p_name: name,
  })
  if (error) throw error
  ids.set(name, data as number)
  return data as number
}

/** Scrape KSÍ for the current season and upsert matches + events. */
export async function ingestSeason(season = CURRENT_SEASON) {
  const ids = await teamIdMap()
  const warnings: string[] = []
  let newMatches = 0
  let newEvents = 0

  const { data: existing, error: exErr } = await db()
    .from('matches')
    .select('id, status')
    .eq('season', season)
  if (exErr) throw exErr
  const known = new Map(existing.map((m) => [m.id, m.status]))

  const withEvents = await fetchAll<{ match_id: number }>(
    'match_events',
    'match_id',
  )
  const hasEvents = new Set(withEvents.map((e) => e.match_id))

  for (const t of TOURNAMENTS_2026) {
    const cards = await fetchTournamentMatches(t.id, season)
    const rows = []
    const playerRows = new Map<number, string>()
    const eventRows: Record<string, unknown>[] = []
    for (const c of cards) {
      const homeId = await ensureTeam(c.home, ids)
      const awayId = await ensureTeam(c.away, ids)
      const matchId =
        c.ksiId ?? syntheticId(season, t.league, t.phase, homeId, awayId)
      const prev = known.get(matchId)
      if (prev === undefined || prev === 'upcoming') {
        rows.push({
          id: matchId,
          season,
          league: t.league,
          phase: t.phase,
          date: c.date,
          venue: c.venue,
          home_team: homeId,
          away_team: awayId,
          home_goals: c.homeGoals,
          away_goals: c.awayGoals,
          status: c.status,
        })
        if (prev === undefined) newMatches++
      }

      if (c.status === 'played' && c.ksiId !== null && !hasEvents.has(c.ksiId)) {
        try {
          const events = await fetchMatchEvents(c.ksiId)
          const evWarnings = validateEvents(events, {
            homeGoals: c.homeGoals!,
            awayGoals: c.awayGoals!,
          })
          warnings.push(...evWarnings.map((w) => `match ${c.ksiId}: ${w}`))
          for (const e of events) {
            eventRows.push({
              event_id: e.eventId,
              match_id: c.ksiId,
              minute: e.minute,
              type: e.type,
              player_ksi_id: e.playerKsiId,
              player_name: e.playerName,
              side: e.side,
            })
            if (e.playerKsiId) playerRows.set(e.playerKsiId, e.playerName)
          }
          newEvents += events.length
          await new Promise((r) => setTimeout(r, 400))
        } catch (err) {
          warnings.push(`match ${c.ksiId}: events failed: ${String(err)}`)
        }
      }
    }
    if (rows.length) {
      const { error } = await db().rpc('rpc_upsert_matches', {
        p_secret: SECRET(),
        p_rows: rows,
      })
      if (error) throw error
    }
    if (playerRows.size) {
      const { error } = await db().rpc('rpc_upsert_players', {
        p_secret: SECRET(),
        p_rows: [...playerRows].map(([ksi_id, name]) => ({ ksi_id, name })),
      })
      if (error) throw error
    }
    if (eventRows.length) {
      const { error } = await db().rpc('rpc_upsert_events', {
        p_secret: SECRET(),
        p_rows: eventRows,
      })
      if (error) throw error
    }
  }

  const { error: logErr } = await db().rpc('rpc_log_ingest', {
    p_secret: SECRET(),
    p_new_matches: newMatches,
    p_new_events: newEvents,
    p_warnings: warnings.length ? warnings : null,
  })
  if (logErr) throw logErr
  return { newMatches, newEvents, warnings }
}

interface MatchRow {
  id: number
  season: number
  league: League
  phase: Phase
  date: string | null
  home_team: number
  away_team: number
  home_goals: number | null
  away_goals: number | null
  status: 'played' | 'upcoming'
}

async function allMatches(): Promise<MatchRow[]> {
  const out: MatchRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('matches')
      .select(
        'id, season, league, phase, date, home_team, away_team, home_goals, away_goals, status',
      )
      .order('season')
      .order('date', { nullsFirst: true })
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data as MatchRow[]))
    if (data.length < 1000) break
  }
  return out
}

function seasonRates(
  matches: MatchRow[],
  season: number,
  league: League,
): Map<number, TeamSeasonRates> {
  const per = new Map<number, { gf: number; ga: number; res: string[] }>()
  const played = matches
    .filter(
      (m) =>
        m.season === season &&
        m.league === league &&
        m.status === 'played' &&
        m.home_goals !== null,
    )
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  for (const m of played) {
    const h = per.get(m.home_team) ?? { gf: 0, ga: 0, res: [] }
    const a = per.get(m.away_team) ?? { gf: 0, ga: 0, res: [] }
    h.gf += m.home_goals!; h.ga += m.away_goals!
    a.gf += m.away_goals!; a.ga += m.home_goals!
    const r = Math.sign(m.home_goals! - m.away_goals!)
    h.res.push(r > 0 ? 'W' : r < 0 ? 'L' : 'D')
    a.res.push(r < 0 ? 'W' : r > 0 ? 'L' : 'D')
    per.set(m.home_team, h)
    per.set(m.away_team, a)
  }
  const out = new Map<number, TeamSeasonRates>()
  for (const [team, s] of per) {
    const games = s.res.length
    out.set(team, {
      gfPerGame: s.gf / games,
      gaPerGame: s.ga / games,
      games,
      form: s.res.slice(-5).reverse().join(''),
    })
  }
  return out
}

/** Recompute Elo, predictions and simulations from the full match table. */
export async function recomputeAll() {
  const matches = await allMatches()
  const played = matches.filter((m) => m.status === 'played' && m.home_goals !== null)

  // --- team Elo ---
  const eloInput: EloMatch[] = played.map((m, i) => ({
    matchId: m.id,
    order: i, // allMatches is season+date ordered
    date: m.date,
    league: m.league,
    home: String(m.home_team),
    away: String(m.away_team),
    homeGoals: m.home_goals!,
    awayGoals: m.away_goals!,
  }))
  const eloRecords = runElo(eloInput)
  await replaceTable(
    'team_elo',
    eloRecords.map((r) => ({
      team_id: Number(r.team),
      match_id: r.matchId,
      date: r.date,
      elo_before: r.eloBefore,
      elo_after: r.eloAfter,
    })),
  )
  const ratings = currentRatings(eloRecords)

  // --- player Elo (current season, event-observable) ---
  const evRows = await fetchAll<{
    event_id: number
    match_id: number
    minute: number
    type: MatchEvent['type']
    player_ksi_id: number | null
    player_name: string
    side: 'home' | 'away'
  }>('match_events', 'event_id, match_id, minute, type, player_ksi_id, player_name, side')
  const evByMatch = new Map<number, MatchEvent[]>()
  for (const e of evRows) {
    const list = evByMatch.get(e.match_id) ?? []
    list.push({
      eventId: e.event_id,
      minute: e.minute,
      type: e.type,
      playerKsiId: e.player_ksi_id,
      playerName: e.player_name,
      side: e.side,
    })
    evByMatch.set(e.match_id, list)
  }
  const playerInput: PlayerMatchInput[] = played
    .filter((m) => evByMatch.has(m.id))
    .map((m, i) => ({
      matchId: m.id,
      order: i,
      homeGoals: m.home_goals!,
      awayGoals: m.away_goals!,
      events: evByMatch.get(m.id)!,
    }))
  const playerRecords = runPlayerElo(playerInput)
  await replaceTable(
    'player_elo',
    playerRecords.map((r) => ({
      player_ksi_id: r.playerKsiId,
      match_id: r.matchId,
      elo_before: r.eloBefore,
      elo_after: r.eloAfter,
    })),
  )

  // --- predictions for upcoming current-season matches ---
  const rates = {
    besta: seasonRates(matches, CURRENT_SEASON, 'besta'),
    lengjudeild: seasonRates(matches, CURRENT_SEASON, 'lengjudeild'),
  }
  const h2hOf = (home: number, away: number) => {
    let homeWins = 0, draws = 0, awayWins = 0
    for (const m of played) {
      const pair =
        (m.home_team === home && m.away_team === away) ||
        (m.home_team === away && m.away_team === home)
      if (!pair) continue
      const homePerspective =
        m.home_team === home ? m.home_goals! - m.away_goals! : m.away_goals! - m.home_goals!
      if (homePerspective > 0) homeWins++
      else if (homePerspective < 0) awayWins++
      else draws++
    }
    return { homeWins, draws, awayWins }
  }
  const upcoming = matches.filter(
    (m) => m.status === 'upcoming' && m.season === CURRENT_SEASON,
  )
  const predRows = upcoming.map((m) => {
    const p = predictMatch({
      eloHome: ratings.get(String(m.home_team)) ?? 1500,
      eloAway: ratings.get(String(m.away_team)) ?? 1500,
      home: rates[m.league].get(m.home_team) ?? null,
      away: rates[m.league].get(m.away_team) ?? null,
      h2h: h2hOf(m.home_team, m.away_team),
    })
    return {
      match_id: m.id,
      p_home: p.pHome,
      p_draw: p.pDraw,
      p_away: p.pAway,
      lambda_home: p.lambdaHome,
      lambda_away: p.lambdaAway,
      factors: { ...p.factors, topScorelines: p.topScorelines },
      computed_at: new Date().toISOString(),
    }
  })
  await replaceTable('predictions', predRows)

  // --- season simulation (Besta deild) ---
  const standings = new Map<number, { pts: number; gf: number; ga: number; p: number }>()
  for (const m of played.filter(
    (m) => m.season === CURRENT_SEASON && m.league === 'besta',
  )) {
    const h = standings.get(m.home_team) ?? { pts: 0, gf: 0, ga: 0, p: 0 }
    const a = standings.get(m.away_team) ?? { pts: 0, gf: 0, ga: 0, p: 0 }
    h.gf += m.home_goals!; h.ga += m.away_goals!; h.p++
    a.gf += m.away_goals!; a.ga += m.home_goals!; a.p++
    if (m.home_goals! > m.away_goals!) h.pts += 3
    else if (m.home_goals! < m.away_goals!) a.pts += 3
    else { h.pts++; a.pts++ }
    standings.set(m.home_team, h)
    standings.set(m.away_team, a)
  }
  const simTeams: SimTeamState[] = [...standings].map(([teamId, s]) => ({
    team: String(teamId),
    elo: ratings.get(String(teamId)) ?? 1500,
    rates: rates.besta.get(teamId) ?? null,
    points: s.pts,
    goalsFor: s.gf,
    goalsAgainst: s.ga,
    played: s.p,
  }))
  const remaining: SimFixture[] = upcoming
    .filter((m) => m.league === 'besta' && m.phase === 'main')
    .map((m) => ({ home: String(m.home_team), away: String(m.away_team) }))
  if (simTeams.length === 12) {
    const sim = simulateSeason(simTeams, remaining, 10000)
    await replaceTable(
      'season_sim',
      sim.map((r) => ({
        season: CURRENT_SEASON,
        league: 'besta',
        team_id: Number(r.team),
        pos_probs: r.posProbs,
        p_title: r.pTitle,
        p_europe: r.pEurope,
        p_relegation: r.pRelegation,
      })),
    )
  }

  // --- scorer races ---
  const teamGamesLeft = new Map<number, number>()
  for (const m of upcoming.filter((m) => m.league === 'besta')) {
    teamGamesLeft.set(m.home_team, (teamGamesLeft.get(m.home_team) ?? 0) + 1)
    teamGamesLeft.set(m.away_team, (teamGamesLeft.get(m.away_team) ?? 0) + 1)
  }
  const avgLeft =
    [...teamGamesLeft.values()].reduce((a, b) => a + b, 0) /
    Math.max(1, teamGamesLeft.size)

  const teamGamesPlayed = new Map<number, number>()
  for (const [teamId, s] of standings) teamGamesPlayed.set(teamId, s.p)
  const goalsByPlayer = new Map<string, { goals: number; teamId: number }>()
  for (const m of played.filter(
    (m) => m.season === CURRENT_SEASON && m.league === 'besta',
  )) {
    for (const e of evByMatch.get(m.id) ?? []) {
      if (e.type === 'goal' || e.type === 'penalty') {
        const teamId = e.side === 'home' ? m.home_team : m.away_team
        const cur = goalsByPlayer.get(e.playerName) ?? { goals: 0, teamId }
        cur.goals++
        cur.teamId = teamId
        goalsByPlayer.set(e.playerName, cur)
      }
    }
  }
  const goalRace: ScorerState[] = [...goalsByPlayer]
    .sort((a, b) => b[1].goals - a[1].goals)
    .slice(0, 25)
    .map(([name, g]) => ({
      name,
      team: String(g.teamId),
      current: g.goals,
      perGame: g.goals / Math.max(1, teamGamesPlayed.get(g.teamId) ?? 13),
      remainingTeamGames: teamGamesLeft.get(g.teamId) ?? avgLeft,
    }))
  const scorerRows = simulateScorerRace(goalRace).map((r) => ({
    season: CURRENT_SEASON,
    name: r.name,
    kind: 'goals' as const,
    current: r.current,
    projected: r.projected,
    p_win: r.pWin,
  }))

  // assists race from the SofaScore snapshot (no per-match assist data at KSÍ)
  const { data: sofa } = await db()
    .from('sofascore_players')
    .select('name, assists, appearances')
    .eq('season', CURRENT_SEASON)
    .order('assists', { ascending: false })
    .limit(25)
  const assistRace: ScorerState[] = (sofa ?? [])
    .filter((p) => p.assists && p.appearances)
    .map((p) => ({
      name: p.name,
      team: '',
      current: p.assists,
      perGame: p.assists / p.appearances,
      remainingTeamGames: avgLeft,
    }))
  const assistRows = simulateScorerRace(assistRace).map((r) => ({
    season: CURRENT_SEASON,
    name: r.name,
    kind: 'assists' as const,
    current: r.current,
    projected: r.projected,
    p_win: r.pWin,
  }))
  await replaceTable('scorer_sim', [...scorerRows, ...assistRows])

  // --- history: belt lineage, all-time H2H and all-time table (top flight) ---
  const bestaPlayed: BeltMatch[] = played
    .filter((m) => m.league === 'besta')
    .map((m) => ({
      matchId: m.id,
      season: m.season,
      date: m.date,
      order: 0,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeGoals: m.home_goals!,
      awayGoals: m.away_goals!,
    }))
    .sort(
      (a, b) =>
        a.season - b.season ||
        (a.date ?? '~').localeCompare(b.date ?? '~') || // undated last within season
        a.matchId - b.matchId,
    )
    .map((m, i) => ({ ...m, order: i }))

  // the champion of the last table-only season carries the belt into match play
  const firstMatchSeason = bestaPlayed[0]?.season
  let initialHolder: number | undefined
  if (firstMatchSeason) {
    const { data: champ } = await db()
      .from('champions')
      .select('team_id')
      .eq('season', firstMatchSeason - 1)
      .maybeSingle()
    initialHolder = champ?.team_id
  }
  const belt = runBelt(bestaPlayed, initialHolder)
  await replaceHistoryTable(
    'belt_history',
    belt.history.map((h) => ({
      match_id: h.matchId,
      season: h.season,
      date: h.date,
      holder_before: h.holderBefore,
      challenger: h.challenger,
      holder_after: h.holderAfter,
      taken: h.taken,
    })),
  )
  await replaceHistoryTable(
    'h2h_cache',
    computeH2H(bestaPlayed).map((p) => ({
      team_a: p.teamA,
      team_b: p.teamB,
      stats: p,
    })),
  )
  // all-time table: official season standings for the table-only era
  // (pre-1985) + per-match data from 1985 onwards
  const alltimeRows = computeAllTime(bestaPlayed)
  const { data: oldStandings } = await db()
    .from('season_standings')
    .select('season, team_id, played, won, drawn, lost, gf, ga')
    .lt('season', firstMatchSeason ?? 1985)
  const byTeam = new Map(alltimeRows.map((r) => [r.teamId, r]))
  for (const s of oldStandings ?? []) {
    let r = byTeam.get(s.team_id)
    if (!r) {
      r = { teamId: s.team_id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
            points3: 0, seasons: 0, firstSeason: s.season, lastSeason: s.season }
      byTeam.set(s.team_id, r)
      alltimeRows.push(r)
    }
    r.played += s.played; r.won += s.won; r.drawn += s.drawn; r.lost += s.lost
    r.gf += s.gf; r.ga += s.ga
    r.points3 += 3 * s.won + s.drawn
    r.seasons += 1
    r.firstSeason = Math.min(r.firstSeason, s.season)
    r.lastSeason = Math.max(r.lastSeason, s.season)
  }
  alltimeRows.sort((a, b) => b.points3 - a.points3)
  await replaceHistoryTable(
    'alltime_cache',
    alltimeRows.map((r) => ({ team_id: r.teamId, stats: r })),
  )

  return {
    eloRecords: eloRecords.length,
    playerRecords: playerRecords.length,
    predictions: predRows.length,
    beltEvents: belt.history.length,
  }
}

async function replaceHistoryTable(table: string, rows: Record<string, unknown>[]) {
  const { error } = await db().rpc('rpc_replace_history', {
    p_secret: SECRET(),
    p_table: table,
    p_rows: rows,
  })
  if (error) throw error
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from(table)
      .select(select)
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return out
}

async function replaceTable(table: string, rows: Record<string, unknown>[]) {
  const { error } = await db().rpc('rpc_replace', {
    p_secret: SECRET(),
    p_table: table,
    p_rows: rows,
  })
  if (error) throw error
}
