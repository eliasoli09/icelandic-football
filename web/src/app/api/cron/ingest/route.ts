import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ingestSeason, recomputeAll } from '@/lib/recompute'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') !== null
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const ingest = await ingestSeason()
    const recompute = await recomputeAll()
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, ingest, recompute })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) },
      { status: 500 },
    )
  }
}
