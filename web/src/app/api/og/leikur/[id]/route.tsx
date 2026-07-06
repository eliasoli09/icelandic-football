import { ImageResponse } from 'next/og'
import { teams, matchDetail } from '@/lib/queries'
import { Frame, Bar, C, OG_SIZE, ogFonts } from '@/lib/og'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [names, detail] = await Promise.all([teams(), matchDetail(Number(id))])
  if (!detail) return new Response('not found', { status: 404 })
  const { match, prediction } = detail
  const nm = (t: number) => names.get(t) ?? '?'
  const played = match.status === 'played'
  return new ImageResponse(
    (
      <Frame footer={`${fmtDate(match.date)} · ${match.venue ?? ''} · ${match.league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'} ${match.season}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 40 }}>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', fontSize: 54, fontWeight: 700, textAlign: 'right' }}>
            {nm(match.home_team)}
          </div>
          <div style={{ display: 'flex', fontSize: played ? 84 : 40, fontWeight: 700, color: played ? C.text : C.muted, padding: '0 10px' }}>
            {played ? `${match.home_goals} – ${match.away_goals}` : 'gegn'}
          </div>
          <div style={{ display: 'flex', flex: 1, fontSize: 54, fontWeight: 700 }}>
            {nm(match.away_team)}
          </div>
        </div>
        {!played && prediction ? (
          <Bar pHome={prediction.p_home} pDraw={prediction.p_draw} pAway={prediction.p_away} />
        ) : null}
      </Frame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
