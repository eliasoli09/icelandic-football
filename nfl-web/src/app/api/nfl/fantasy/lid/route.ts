import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { franchiseOf } from '@/lib/nfl/elo'
import { nflCurrentSeason, nflInjuries, nflSeasonGames } from '@/lib/nfl/queries'
import { isPlayed } from '@/lib/nfl/types'

export const dynamic = 'force-dynamic'

const pts = (r: Record<string, number>, catch_: number) =>
  r.passing_yards / 25 + 4 * r.passing_tds - 2 * r.interceptions + (r.rushing_yards + r.receiving_yards) / 10
  + 6 * (r.rushing_tds + r.receiving_tds) - 2 * r.fumbles_lost + catch_ * r.receptions

/**
 * What the dashboard shows next to a fantasy roster: each player's average
 * points a game this season (the projection for a game not yet played), his
 * injury status for the coming round and his club's next game.
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return NextResponse.json({ players: {} })
  const people = ids.filter((i) => !i.startsWith('DST:'))
  const games = await nflSeasonGames(season)
  const now = Date.now()
  const upcoming = games.filter((g) => !isPlayed(g) && new Date(g.kickoff).getTime() > now - 4 * 3600_000).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const round = upcoming[0]?.week ?? null
  const [{ data: who }, { data: weeks }, inj] = await Promise.all([
    people.length ? db().from('nfl_players').select('player_id, name, team, position, headshot').in('player_id', people) : Promise.resolve({ data: [] }),
    people.length ? db().from('nfl_player_weeks').select('player_id, passing_yards, passing_tds, interceptions, rushing_yards, rushing_tds, receptions, receiving_yards, receiving_tds, fumbles_lost').eq('season', season).eq('season_type', 'REG').in('player_id', people).range(0, 999) : Promise.resolve({ data: [] }),
    round ? nflInjuries(season, round).catch(() => ({ week: null, rows: [] })) : Promise.resolve({ week: null, rows: [] }),
  ])
  const sums = new Map<string, { n: number; std: number; half: number; ppr: number }>()
  for (const w of (weeks ?? []) as unknown as (Record<string, number> & { player_id: string })[]) {
    const r = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Number(v)])) as Record<string, number>
    const s = sums.get(w.player_id) ?? { n: 0, std: 0, half: 0, ppr: 0 }
    s.n++; s.std += pts(r, 0); s.half += pts(r, 0.5); s.ppr += pts(r, 1)
    sums.set(w.player_id, s)
  }
  const status = new Map(inj.rows.filter((r) => inj.week === round || r.source === 'roster').map((r) => [r.player_id, r.status]))
  const next = (team: string) => {
    const g = upcoming.find((x) => franchiseOf(x.home) === franchiseOf(team) || franchiseOf(x.away) === franchiseOf(team))
    return g ? { game_id: g.game_id, kickoff: g.kickoff, home: franchiseOf(g.home) === franchiseOf(team), opp: franchiseOf(g.home) === franchiseOf(team) ? g.away : g.home, week: g.week } : null
  }
  const out: Record<string, unknown> = {}
  for (const p of (who ?? []) as { player_id: string; name: string; team: string | null; position: string | null; headshot: string | null }[]) {
    const s = sums.get(p.player_id)
    out[p.player_id] = { ...p, games: s?.n ?? 0, avg: s ? { std: s.std / s.n, half: s.half / s.n, ppr: s.ppr / s.n } : null, injury: status.get(p.player_id) ?? null, next: p.team ? next(p.team) : null }
  }
  for (const id of ids.filter((i) => i.startsWith('DST:'))) out[id] = { player_id: id, team: id.slice(4), position: 'DST', games: 0, avg: null, injury: null, next: next(id.slice(4)) }
  return NextResponse.json({ round, players: out })
}
