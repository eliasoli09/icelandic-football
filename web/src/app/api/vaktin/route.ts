import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import type { SlipLeg } from '@/lib/vaktin'

export const dynamic = 'force-dynamic'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const MARKETS = new Set(['urslit', 'mork_yfir', 'mork_undir', 'baedi_skora', 'markaskorari', 'handvirkt'])

/** Create a bet slip. Public endpoint — validated and size-capped. */
export async function POST(req: NextRequest) {
  let body: { title?: string; legs?: SlipLeg[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const legs = (body.legs ?? []).slice(0, 20)
  if (!legs.length) return NextResponse.json({ error: 'engir leggir' }, { status: 400 })
  for (const l of legs) {
    if (!MARKETS.has(l.market) || typeof l.match_id !== 'number' || typeof l.label !== 'string' || l.label.length > 120) {
      return NextResponse.json({ error: 'ógildur leggur' }, { status: 400 })
    }
  }
  const slug = randomUUID().replace(/-/g, '').slice(0, 10)
  const clean = legs.map((l, i) => ({
    id: String(i + 1),
    match_id: l.match_id,
    market: l.market,
    pick: l.pick,
    line: typeof l.line === 'number' ? l.line : undefined,
    player: typeof l.player === 'string' ? l.player.slice(0, 60) : undefined,
    label: l.label,
    manualDone: false,
  }))
  const { error } = await db().rpc('rpc_save_slip', {
    p_secret: process.env.CRON_SECRET!,
    p_slug: slug,
    p_title: (body.title ?? 'Seðillinn minn').slice(0, 80),
    p_legs: clean,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, slug })
}
