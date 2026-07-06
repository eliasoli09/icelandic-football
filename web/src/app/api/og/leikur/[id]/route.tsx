import { ImageResponse } from 'next/og'
import { teamInfo, matchDetail } from '@/lib/queries'
import { Frame, Bar, C, OG_SIZE, ogFonts } from '@/lib/og'
import { displayColor, tint } from '@/lib/teamColors'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [infos, detail] = await Promise.all([teamInfo(), matchDetail(Number(id))])
  if (!detail) return new Response('not found', { status: 404 })
  const { match, prediction, events } = detail
  const home = infos.get(match.home_team)
  const away = infos.get(match.away_team)
  const played = match.status === 'played'
  const goals = events.filter((e: { type: string }) => ['goal', 'penalty', 'owngoal'].includes(e.type))

  const Team = ({ info, align }: { info: typeof home; align: 'left' | 'right' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1 }}>
      {info?.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.crest} width={110} height={110} style={{ objectFit: 'contain' }} />
      ) : (
        <div style={{ display: 'flex', width: 110, height: 110, borderRadius: 60, background: tint(info, 0.4) }} />
      )}
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: displayColor(info), textAlign: align === 'left' ? 'right' : 'left' }}>
        {info?.name ?? '?'}
      </div>
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: `linear-gradient(120deg, ${tint(home, 0.5)} 0%, ${C.bg} 38%, ${C.bg} 62%, ${tint(away, 0.5)} 100%)`,
          color: C.text, fontFamily: 'Inter', padding: 52,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 30 }}>⚽</div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>Besta spáin</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>
            {`Fótbolti · Ísland · ${match.league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'} ${match.season}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 24 }}>
          <Team info={home} align="left" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', fontSize: played ? 100 : 44, fontWeight: 700, color: played ? C.text : C.muted }}>
              {played ? `${match.home_goals} – ${match.away_goals}` : 'gegn'}
            </div>
            {played ? (
              <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>Leik lokið</div>
            ) : null}
            <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{fmtDate(match.date)}</div>
          </div>
          <Team info={away} align="right" />
        </div>

        {played && goals.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 30, flexWrap: 'wrap', background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 24px' }}>
            {goals.slice(0, 6).map((g: { player_name: string; minute: number; side: string; type: string; event_id: number }) => (
              <div key={`${g.event_id}-${g.player_name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 23 }}>
                <div style={{ display: 'flex', color: g.side === 'home' ? displayColor(home) : displayColor(away) }}>⚽</div>
                <div style={{ display: 'flex' }}>{`${g.player_name} ${g.minute}'${g.type === 'owngoal' ? ' (sj.)' : g.type === 'penalty' ? ' (v.)' : ''}`}</div>
              </div>
            ))}
          </div>
        ) : null}
        {!played && prediction ? (
          <Bar pHome={prediction.p_home} pDraw={prediction.p_draw} pAway={prediction.p_away} />
        ) : null}
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
