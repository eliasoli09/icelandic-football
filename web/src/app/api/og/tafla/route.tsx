import { ImageResponse } from 'next/og'
import { teams, standings, seasonSim, teamInfo } from '@/lib/queries'
import { Frame, C, OG_SIZE, ogFonts } from '@/lib/og'
import { displayColor } from '@/lib/teamColors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [names, infos, table, sim] = await Promise.all([teams(), teamInfo(), standings(), seasonSim()])
  const nm = (t: number) => names.get(t) ?? '?'
  const titleOf = new Map(sim.map((s) => [s.team_id, s.p_title]))
  const rows = table.slice(0, 8)
  return new ImageResponse(
    (
      <Frame footer="Besta deild karla 2026 · uppfærist eftir hvern leik">
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, marginBottom: 24 }}>Staðan + meistaralíkur</div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {rows.map((r, i) => (
            <div key={r.teamId} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderTop: i ? `1px solid ${C.border}` : 'none', fontSize: 28 }}>
              <div style={{ display: 'flex', width: 44, color: C.muted }}>{i + 1}</div>
              {infos.get(r.teamId)?.crest ? (
                <img src={infos.get(r.teamId)!.crest!} width={30} height={30} style={{ objectFit: 'contain', marginRight: 12 }} />
              ) : (
                <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 8, background: displayColor(infos.get(r.teamId)), margin: '0 20px 0 8px' }} />
              )}
              <div style={{ display: 'flex', flex: 1, fontWeight: 700 }}>{nm(r.teamId)}</div>
              <div style={{ display: 'flex', width: 90, justifyContent: 'flex-end', color: C.muted }}>{r.played} l.</div>
              <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end', fontWeight: 700 }}>{r.points} stig</div>
              <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', color: C.accent, fontWeight: 700 }}>
                {Math.round((titleOf.get(r.teamId) ?? 0) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
