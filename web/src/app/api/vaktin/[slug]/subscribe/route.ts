import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

/** Register a web-push subscription for this slip (slug = capability). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.endpoint?.startsWith('https://') || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'ógild áskrift' }, { status: 400 })
  }
  const { data: slip } = await db().from('bet_slips').select('slug').eq('slug', slug).maybeSingle()
  if (!slip) return NextResponse.json({ error: 'seðill fannst ekki' }, { status: 404 })

  const { error } = await db().rpc('rpc_push_subscribe', {
    p_secret: process.env.CRON_SECRET!,
    p_slug: slug,
    p_endpoint: body.endpoint,
    p_p256dh: body.keys.p256dh,
    p_auth: body.keys.auth,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Remove a subscription. */
export async function DELETE(req: NextRequest) {
  let body: { endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.endpoint) return NextResponse.json({ error: 'vantar endpoint' }, { status: 400 })
  await db().rpc('rpc_push_unsubscribe', { p_secret: process.env.CRON_SECRET!, p_endpoint: body.endpoint })
  return NextResponse.json({ ok: true })
}
