import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ingestNfl } from '@/lib/nfl/ingest'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Separate from /api/cron/ingest so a KSÍ failure cannot take NFL down, or the reverse.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') !== null
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await ingestNfl()
    revalidatePath('/nfl', 'layout')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, { status: 500 })
  }
}
