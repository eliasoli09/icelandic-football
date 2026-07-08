import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ingestSeason, recomputeAll } from '@/lib/recompute'
import { refreshOdds } from '@/lib/odds'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Manual refresh (Vercel hobby cron only runs daily). POST with the secret. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const ingest = await ingestSeason()
    const recompute = await recomputeAll()
    const odds = await refreshOdds()
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, ingest, recompute, odds })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, { status: 500 })
  }
}
