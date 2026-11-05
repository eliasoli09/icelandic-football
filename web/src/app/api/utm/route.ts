import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BOT_UA, parseUtm, referrerHost } from '@/lib/utm'

const SITE = 'fotbolti'

/** One UTM-tagged landing into utm_visit. UtmLogger sends the landing query, path and document.referrer. */
export async function POST(req: Request) {
  if (BOT_UA.test(req.headers.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 })
  const body = (await req.json().catch(() => null)) as { search?: unknown; path?: unknown; referrer?: unknown } | null
  const utm = typeof body?.search === 'string' ? parseUtm(body.search) : null
  if (!utm) return new NextResponse(null, { status: 204 })
  const path = typeof body?.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 300) : null
  const { error } = await db().rpc('rpc_utm_visit_add', {
    p_secret: process.env.CRON_SECRET,
    p_row: {
      site: SITE,
      ...utm,
      path,
      referrer_host: referrerHost(typeof body?.referrer === 'string' ? body.referrer : null),
      country: req.headers.get('x-vercel-ip-country')?.slice(0, 8) ?? null,
    },
  })
  if (error) return NextResponse.json({ ok: false }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
