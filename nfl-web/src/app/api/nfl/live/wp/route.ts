import { NextRequest, NextResponse } from 'next/server'
import { nflLiveWp } from '@/lib/nfl/queries'
import type { WpPoint } from '@/lib/nfl/winChart'

export const dynamic = 'force-dynamic'

export interface WpReply { games: Record<string, WpPoint[]> }

/** ?leikir=id1,id2: the stored win chances of up to 16 games, for the charts. */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('leikir') ?? '').split(',').filter((x) => /^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$/.test(x)).slice(0, 16)
  // localhost only: with NFL_LIVE_MOCK=1 every game gets a made-up seesaw, to see the charts without a game on
  if (process.env.NFL_LIVE_MOCK === '1' && process.env.NODE_ENV !== 'production') return NextResponse.json({ games: Object.fromEntries(ids.map((id) => [id, mock(id)])) } satisfies WpReply)
  const games = ids.length ? await nflLiveWp(ids).catch(() => ({})) : {}
  return NextResponse.json({ games } satisfies WpReply, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } })
}

function mock(id: string): WpPoint[] {
  const seed = [...id].reduce((h, c) => h + c.charCodeAt(0), 0)
  let p = 0.55, hs = 0, as = 0
  return Array.from({ length: 60 }, (_, i) => {
    const progress = i / 80
    if (i % 9 === 4) { if ((i + seed) % 2) hs += 7; else as += 7 }
    p = Math.min(0.97, Math.max(0.03, p + Math.sin(i / 5 + seed) * 0.06 + (hs - as) * 0.004))
    return { progress, p_home: p, home_score: hs, away_score: as, status: i < 20 ? 'Q1' : 'Q3' }
  })
}
