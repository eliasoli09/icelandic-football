import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { type LegStatus, type SlipLeg } from '@/lib/vaktin'
import { evaluateLegsLive } from '@/lib/vaktinLive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface SubRow { endpoint: string; p256dh: string; auth: string }
interface SlipRow {
  slug: string
  title: string | null
  legs: SlipLeg[]
  prev: Record<string, LegStatus> | null
  subs: SubRow[] | null
}

/**
 * Minute pulse (pg_cron → here): evaluate every slip that has push
 * subscribers, diff against the last known leg statuses, notify changes.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ ok: false, error: 'vantar VAPID-lykla' }, { status: 503 })
  }
  webpush.setVapidDetails(
    'mailto:ellithegamer00@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const { data, error } = await db().rpc('rpc_push_slips', { p_secret: process.env.CRON_SECRET! })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const slips = (data ?? []) as SlipRow[]
  if (!slips.length) return NextResponse.json({ ok: true, slips: 0, sent: 0 })

  let sent = 0
  let checked = 0
  const dead: string[] = []

  for (const slip of slips) {
    if (!slip.subs?.length) continue
    const result = await evaluateLegsLive(slip.legs)
    checked++

    const current: Record<string, LegStatus> = Object.fromEntries(result.legs.map((l) => [l.id, l.status]))
    const prev = slip.prev ?? {}
    const hasPrev = slip.prev !== null

    const messages: string[] = []
    if (hasPrev) {
      for (const l of result.legs) {
        const was = prev[l.id]
        if (was === l.status) continue
        if (l.status === 'vann') messages.push(`✅ ${l.label} — í höfn!`)
        else if (l.status === 'tapad') messages.push(`❌ ${l.label} — datt`)
      }
      const prevAlive = !Object.values(prev).includes('tapad')
      if (prevAlive && !result.alive) messages.push(`Seðillinn datt (${result.vann}/${result.legs.length} í höfn)`)
      else if (result.alive && result.vann === result.legs.length && Object.values(prev).some((s) => s !== 'vann')) {
        messages.push(`🎉 SEÐILLINN VANN — allir ${result.legs.length} leggir í höfn!`)
      }
    }

    if (messages.length) {
      const payload = JSON.stringify({
        title: slip.title ?? 'Seðillinn þinn',
        body: messages.slice(0, 4).join('\n'),
        tag: `sedill-${slip.slug}`,
        url: `/vaktin/${slip.slug}`,
      })
      for (const sub of slip.subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) dead.push(sub.endpoint)
        }
      }
    }

    // persist state whenever it changed (or first sighting) so diffs stay accurate
    if (!hasPrev || JSON.stringify(current) !== JSON.stringify(prev)) {
      await db().rpc('rpc_push_set_state', {
        p_secret: process.env.CRON_SECRET!,
        p_slug: slip.slug,
        p_statuses: current,
      })
    }
  }

  for (const endpoint of dead) {
    await db().rpc('rpc_push_unsubscribe', { p_secret: process.env.CRON_SECRET!, p_endpoint: endpoint })
  }

  return NextResponse.json({ ok: true, slips: slips.length, checked, sent, deadSubs: dead.length })
}
