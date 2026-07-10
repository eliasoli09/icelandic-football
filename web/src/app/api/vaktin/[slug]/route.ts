import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateSlip, type SlipLeg } from '@/lib/vaktin'
import { refreshWcScores } from '@/lib/worldcup'
import type { WcMatchRow } from '@/lib/queries'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function loadSlip(slug: string) {
  const { data } = await db().from('bet_slips').select('*').eq('slug', slug).maybeSingle()
  return data as { slug: string; title: string | null; legs: SlipLeg[] } | null
}

/** Evaluate the slip. Refreshes WC scores when a leg's match is live and data is stale. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const slip = await loadSlip(slug)
  if (!slip) return NextResponse.json({ error: 'fannst ekki' }, { status: 404 })

  const ids = [...new Set(slip.legs.map((l) => l.match_id))]
  let { data: rows } = await db().from('wc_matches').select('*').in('id', ids)
  let matches = (rows ?? []) as (WcMatchRow & { updated_at?: string })[]

  const now = Date.now()
  const needsFresh = matches.some(
    (m) =>
      new Date(m.date).getTime() < now &&
      (m.home_score === null || now - new Date(m.date).getTime() < 3 * 3600_000) &&
      now - new Date(m.updated_at ?? 0).getTime() > 4 * 60_000,
  )
  if (needsFresh) {
    try {
      await refreshWcScores()
      const again = await db().from('wc_matches').select('*').in('id', ids)
      matches = (again.data ?? []) as typeof matches
    } catch {
      // stale data is better than an error — evaluation continues
    }
  }

  const status = evaluateSlip(slip.legs, new Map(matches.map((m) => [m.id, m])))
  return NextResponse.json({
    ok: true,
    title: slip.title,
    ...status,
    matches: Object.fromEntries(matches.map((m) => [m.id, { home: m.home, away: m.away, date: m.date, home_score: m.home_score, away_score: m.away_score }])),
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
    p_title: slip.title ?? 'Miðinn minn',
    p_legs: legs,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
