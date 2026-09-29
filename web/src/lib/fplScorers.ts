import { db } from './db'
import { simulateScorerRace, type ScorerState } from './simulate'

/**
 * The Premier League scoring race, from the Fantasy Premier League API.
 *
 * It is the only player-level source for a foreign league we can use: it is
 * the league's own game, open without a key, and current to the last match.
 * Understat forbids crawling in robots.txt, FBref answers with a bot
 * challenge, and the API-Football plan we hold stops at the 2024 season.
 */
const BOOTSTRAP = 'https://fantasy.premierleague.com/api/bootstrap-static/'
const UA = 'BestaSpain/1.0 (https://islensk-fotbolti.vercel.app; league scorer projections)'

interface Element {
  first_name: string
  second_name: string
  web_name: string
  team: number
  goals_scored: number
  assists: number
  minutes: number
}

export interface FplPlayer { name: string; fullName: string; team: string; goals: number; assists: number; minutes: number }

/** Players with a goal or an assist, and the club each plays for. */
export async function fetchFplPlayers(): Promise<{ players: FplPlayer[]; teamNames: string[] }> {
  const res = await fetch(BOOTSTRAP, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`FPL svaraði ${res.status}`)
  const data = await res.json() as { elements: Element[]; teams: { id: number; name: string }[] }
  const clubs = new Map(data.teams.map((t) => [t.id, t.name]))
  return {
    teamNames: data.teams.map((t) => t.name),
    players: data.elements
      .filter((e) => e.goals_scored > 0 || e.assists > 0)
      .map((e) => ({
        // the shirt name is what a reader knows him by; the full name finds him in last season
        name: e.web_name,
        fullName: `${e.first_name} ${e.second_name}`.trim(),
        team: clubs.get(e.team) ?? '',
        goals: e.goals_scored,
        assists: e.assists,
        minutes: e.minutes,
      })),
  }
}

/** Fantasy Premier League spells a few clubs its own way. */
const ALIAS: Record<string, string> = {
  Spurs: 'Tottenham',
  "Nott'm Forest": "Nott'm Forest",
  Wolves: 'Wolves',
  'Man Utd': 'Man United',
}

/**
 * Five matches do not make a scoring rate either. Last season played out, the
 * rate after five rounds missed the rest of the season by 5.57 goals on
 * average; pulled toward what a scorer normally does, the miss falls to 4.15,
 * flattest between a prior worth ten and twenty matches. Twelve is that
 * minimum. Where the player's own last season is known it stands in for the
 * general prior - better evidence at the same weight - and a newcomer is
 * judged by what a listed scorer usually manages.
 */
export const PRIOR_MATCHES = 12
export const PRIOR_RATE = 0.25

/**
 * The race as the simulation wants it: what each player has, how often he
 * scores in his club's matches, and how many of those are left.
 */
export function scorerStates(
  players: FplPlayer[],
  kind: 'goals' | 'assists',
  teamId: (name: string) => number | undefined,
  gamesPlayed: Map<number, number>,
  gamesLeft: Map<number, number>,
  priorOf: (player: FplPlayer) => number | null = () => null,
  limit = 25,
): ScorerState[] {
  const rows: ScorerState[] = []
  for (const p of players) {
    const id = teamId(ALIAS[p.team] ?? p.team)
    const current = kind === 'goals' ? p.goals : p.assists
    if (!id || current <= 0) continue
    const played = Math.max(1, gamesPlayed.get(id) ?? 1)
    const prior = priorOf(p) ?? PRIOR_RATE
    rows.push({
      name: p.name,
      team: String(id),
      current,
      perGame: (current + PRIOR_MATCHES * prior) / (played + PRIOR_MATCHES),
      remainingTeamGames: gamesLeft.get(id) ?? 0,
      rateGames: played + PRIOR_MATCHES,
    })
  }
  return rows.sort((a, b) => b.current - a.current).slice(0, limit)
}

/** What each player did a season ago, per match he played, from the same feed. */
export async function lastSeasonRates(season: string): Promise<Map<string, { goals: number; assists: number }>> {
  const totals = new Map<string, { goals: number; assists: number; games: number }>()
  for (let from = 0; ; from += 1000) {
    const { data } = await db().from('fpl_gw')
      .select('name, goals_scored, assists, minutes').eq('season', season).range(from, from + 999)
    if (!data?.length) break
    for (const r of data) {
      const key = (r.name as string).toLowerCase()
      const cur = totals.get(key) ?? { goals: 0, assists: 0, games: 0 }
      cur.goals += (r.goals_scored as number) ?? 0
      cur.assists += (r.assists as number) ?? 0
      if (((r.minutes as number) ?? 0) > 0) cur.games++
      totals.set(key, cur)
    }
    if (data.length < 1000) break
  }
  const out = new Map<string, { goals: number; assists: number }>()
  // ten matches before a season counts as evidence about a player
  for (const [name, t] of totals) if (t.games >= 10) out.set(name, { goals: t.goals / t.games, assists: t.assists / t.games })
  return out
}

/** Rows for `scorer_sim`, or nothing at all if the feed cannot be reached. */
export async function premierScorerRace(
  season: number,
  teamIdByName: (name: string) => number | undefined,
  gamesPlayed: Map<number, number>,
  gamesLeft: Map<number, number>,
  lastSeason = '2025-26',
): Promise<Record<string, unknown>[]> {
  let players: FplPlayer[]
  try { ({ players } = await fetchFplPlayers()) }
  catch { return [] }
  const last = await lastSeasonRates(lastSeason).catch(() => new Map())
  const now = new Date().toISOString()
  const rows: Record<string, unknown>[] = []
  for (const kind of ['goals', 'assists'] as const) {
    const priorOf = (p: FplPlayer) => last.get(p.fullName.toLowerCase())?.[kind] ?? null
    const states = scorerStates(players, kind, teamIdByName, gamesPlayed, gamesLeft, priorOf)
    if (!states.length) continue
    rows.push(...simulateScorerRace(states).map((r) => ({
      season, league: 'premier', name: r.name, kind,
      current: r.current, projected: r.projected, p_win: r.pWin, run_at: now,
    })))
  }
  return rows
}

/** Which of our clubs the feed is naming, matched on the name alone. */
export async function premierTeamIds(): Promise<Map<string, number>> {
  const { data } = await db().from('teams').select('id, name')
  const out = new Map<string, number>()
  for (const t of data ?? []) out.set((t.name as string).toLowerCase(), t.id as number)
  return out
}
