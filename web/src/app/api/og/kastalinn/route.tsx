import { ImageResponse } from 'next/og'
import { teams, beltHistory } from '@/lib/queries'
import { Frame, C, OG_SIZE, ogFonts } from '@/lib/og'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [names, history] = await Promise.all([teams(), beltHistory()])
  if (!history.length) return new Response('no data', { status: 404 })
  const nm = (t: number) => names.get(t) ?? '?'
  const last = history[history.length - 1]
  const holder = last.holder_after
  const reignStartIdx = history.findLastIndex((h) => h.taken)
  const reignStart = history[reignStartIdx]
  const defenses = history.length - 1 - reignStartIdx
  return new ImageResponse(
    (
      <Frame footer="Óopinber meistaratign íslenska boltans · óslitin lína frá 1912">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 30, color: C.muted, letterSpacing: 4 }}>KONUNGUR KASTALANS</div>
          <div style={{ display: 'flex', fontSize: 40 }}>👑</div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700 }}>{nm(holder)}</div>
          <div style={{ display: 'flex', fontSize: 28, color: C.muted }}>
            {`Með beltið síðan ${reignStart.date ? new Date(reignStart.date).toLocaleDateString('is-IS', { timeZone: 'UTC' }) : reignStart.season} · ${defenses} ${defenses === 1 ? 'vörn' : 'varnir'} í röð`}
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
