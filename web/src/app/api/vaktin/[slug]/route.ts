import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { type SlipLeg } from '@/lib/vaktin'
import { evaluateLegsLive } from '@/lib/vaktinLive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function loadSlip(slug: string) {
  const { data } = await db().from('bet_slips').select('*').eq('slug', slug).maybeSingle()
  return data as { slug: string; title: string | null; legs: SlipLeg[] } | null
}

/** Evaluate the slip with the live overlay (viewer polling). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const slip = await loadSlip(slug)
  if (!slip) return NextResponse.json({ error: 'fannst ekki' }, { status: 404 })

  const result = await evaluateLegsLive(slip.legs, { refreshFeedIfStale: true })
  return NextResponse.json({
    ok: true,
    title: slip.title,
    legs: result.legs,
    vann: result.vann,
    tapad: result.tapad,
    iGangi: result.iGangi,
    alive: result.alive,
    matches: Object.fromEntries(
      result.matches.map((m) => [m.id, { home: m.home, away: m.away, date: m.date, home_score: m.home_score, away_score: m.away_score }]),
    ),
  })
}

/** Toggle a manual leg. The slug is the capability — whoever has it may tick. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let body: { legId?: string; done?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const slip = await loadSlip(slug)
  if (!slip) return NextResponse.json({ error: 'fannst ekki' }, { status: 404 })
  const legs = slip.legs.map((l) => (l.id === body.legId ? { ...l, manualDone: !!body.done } : l))
  const { error } = await db().rpc('rpc_save_slip', {
    p_secret: process.env.CRON_SECRET!,
    p_slug: slug,
    p_title: slip.title ?? 'Seðillinn minn',
    p_legs: legs,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
