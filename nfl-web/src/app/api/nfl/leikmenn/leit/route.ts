import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nflTeams } from '@/lib/nfl/queries'

export const dynamic = 'force-dynamic'

const FANTASY = ['QB', 'RB', 'WR', 'TE', 'K', 'FB']

/** Players on a club now whose name contains `q`, and defences whose club name does, for picking a fantasy team. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  if (q.length < 2) return NextResponse.json({ players: [] })
  const like = `%${q.replace(/[%_]/g, '')}%`
  const [{ data }, teams] = await Promise.all([
    db().from('nfl_players').select('player_id, name, team, position, headshot').ilike('name', like).in('position', FANTASY).not('team', 'is', null).order('name').limit(12),
    nflTeams(),
  ])
  const dst = teams.filter((t) => t.franchise === t.abbr && t.name.toLowerCase().includes(q.toLowerCase()))
    .map((t) => ({ player_id: `DST:${t.abbr}`, name: `${t.name} (vörn)`, team: t.abbr, position: 'DST', headshot: null }))
  return NextResponse.json({ players: [...dst, ...(data ?? [])] })
}
