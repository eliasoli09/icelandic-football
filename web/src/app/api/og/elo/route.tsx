import { ImageResponse } from 'next/og'
import { teams, eloHistory, teamInfo } from '@/lib/queries'
import { Frame, C, OG_SIZE, ogFonts } from '@/lib/og'
import { displayColor } from '@/lib/teamColors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [names, infos, history] = await Promise.all([teams(), teamInfo(), eloHistory()])
  const nm = (t: number) => names.get(t) ?? '?'
  const latest = new Map<number, number>()
  for (const r of history) latest.set(r.team_id, r.elo_after)
  const rows = [...latest].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = rows[0]?.[1] ?? 1600
  return new ImageResponse(
    (
      <Frame footer="Elo-stig frá 1985 · stig fylgja liðum milli deilda og tímabila">
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, marginBottom: 24 }}>Elo-stig liða</div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {rows.map(([teamId, elo], i) => (
            <div key={teamId} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', fontSize: 28 }}>
              <div style={{ display: 'flex', width: 44, color: C.muted }}>{i + 1}</div>
              {infos.get(teamId)?.crest ? (
                <img src={infos.get(teamId)!.crest!} width={30} height={30} style={{ objectFit: 'contain', marginRight: 12 }} />
              ) : (
                <div style={{ display: 'flex', width: 30, marginRight: 12 }} />
              )}
              <div style={{ display: 'flex', width: 220, fontWeight: 700 }}>{nm(teamId)}</div>
              <div style={{ display: 'flex', flex: 1, height: 26, borderRadius: 8, overflow: 'hidden', background: '#1a2438' }}>
                <div style={{ display: 'flex', width: `${Math.max(8, ((elo - 1300) / (max - 1300)) * 100)}%`, background: displayColor(infos.get(teamId)), borderRadius: 8 }} />
              </div>
              <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end', fontWeight: 700 }}>{Math.round(elo)}</div>
            </div>
          ))}
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
