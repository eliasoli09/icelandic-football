import { NextRequest } from 'next/server'
import { seasonCalendar, type CalendarExtra } from '@/lib/nfl/calendar'
import { franchiseOf } from '@/lib/nfl/elo'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { probLabel } from '@/lib/nfl/format'
import { oddsLabel } from '@/lib/nfl/odds'
import { nflBroadcasts, nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { SITE_NAME, SITE_URL } from '@/lib/site'

export const revalidate = 3600

/** /dagatal/CHI.ics: one club's season for a phone's calendar; /dagatal/allt.ics: every game. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ lid: string }> }) {
  const lid = (await params).lid.replace(/\.ics$/i, '').toUpperCase()
  const season = await nflCurrentSeason()
  if (!season) return new Response('Engir leikir', { status: 404 })
  const [{ games, teams, elo, state }, tv] = await Promise.all([nflSeasonModel(season), nflBroadcasts(season).catch(() => ({} as Record<string, { channel: string }>))])
  const all = lid === 'ALLT'
  const club = all ? null : teams.find((t) => t.abbr === lid && t.franchise === t.abbr)
  if (!all && !club) return new Response('Lið fannst ekki', { status: 404 })
  const mine = all ? games : games.filter((g) => franchiseOf(g.home) === club!.abbr || franchiseOf(g.away) === club!.abbr)
  const f = seasonForecasts(games, elo, state)
  const extra: Record<string, CalendarExtra> = {}
  for (const g of mine) {
    const p = f[g.game_id]?.pHome
    extra[g.game_id] = {
      channel: tv[g.game_id]?.channel,
      odds: oddsLabel(g.away_ml) && oddsLabel(g.home_ml) ? `${g.away} ${oddsLabel(g.away_ml)} · ${g.home} ${oddsLabel(g.home_ml)}` : undefined,
      model: p != null ? (p >= 0.5 ? `${g.home} ${probLabel(p)}` : `${g.away} ${probLabel(1 - p)}`) : undefined,
    }
  }
  const name = all ? `${SITE_NAME} - allir NFL-leikir` : `${SITE_NAME} - ${club!.name}`
  return new Response(seasonCalendar(name, mine, SITE_URL, extra), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${all ? 'nfl' : club!.abbr}.ics"`, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
