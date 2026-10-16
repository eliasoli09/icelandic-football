import { ImageResponse } from 'next/og'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { nflGame, nflSeasonModel } from '@/lib/nfl/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed } from '@/lib/nfl/types'
import { weekLabel } from '@/lib/nfl/week'
import { C, Card, OG_SIZE, ogFonts, ogSrc } from '@/lib/og'

export const alt = 'NFL-leikur: líkur og úrslit'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const game = await nflGame((await params).id).catch(() => null)
  if (!game) return new ImageResponse(<Card kicker="NFL"><div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>Leikur fannst ekki</div></Card>, { ...size, fonts: ogFonts() })
  const model = await nflSeasonModel(game.season)
  const team = new Map(model.teams.map((t) => [t.abbr, t]))
  const f = seasonForecasts(model.games, model.elo, model.state)[game.game_id]
  const played = isPlayed(game)
  const side = (abbr: string, p: number | null, score: number | null) => {
    const t = team.get(abbr)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1 }}>
        {t && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ogSrc(t.logo)} width={150} height={150} style={{ objectFit: 'contain' }} />
        )}
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{t?.name ?? abbr}</div>
        <div style={{ display: 'flex', fontSize: played ? 84 : 64, fontWeight: 700, color: played ? C.text : C.cyan }}>
          {played ? String(score) : p !== null ? `${Math.round(p * 100)}%` : ''}
        </div>
      </div>
    )
  }
  return new ImageResponse(
    (
      <Card kicker={`${weekLabel(game.game_type, game.week).toUpperCase()} · ${played ? 'ÚRSLIT' : 'LÍKUR LÍKANSINS'}`}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {side(game.away, f ? 1 - f.pHome : null, game.away_score)}
          <div style={{ display: 'flex', fontSize: 48, color: C.muted, padding: '0 24px' }}>@</div>
          {side(game.home, f ? f.pHome : null, game.home_score)}
        </div>
        {!played && <div style={{ display: 'flex', justifyContent: 'center', fontSize: 30, color: C.muted, marginTop: 18 }}>{dayLabel(game.kickoff)} · {isSmallHours(game.kickoff) ? 'aðfaranótt ' : 'kl. '}{clock(game.kickoff)} að íslenskum tíma</div>}
      </Card>
    ),
    { ...size, fonts: ogFonts() },
  )
}
