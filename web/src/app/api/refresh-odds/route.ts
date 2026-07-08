import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { refreshOdds } from '@/lib/odds'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Light odds-only refresh (no ingest/recompute). POST with the secret. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const odds = await refreshOdds()
  revalidatePath('/leikir', 'layout')
  return NextResponse.json({ ok: true, odds })
}
