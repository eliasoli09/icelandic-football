'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { excitement } from '@/lib/nfl/winChart'
import { NflLogo } from '../NflLogo'
import { useWp } from '../useWp'
import { WinChart } from '../WinChart'
import { Empty, type Ctx } from './Simple'

/** How much a game has to swing to be called a thriller. */
const THRILLER = 1

/** Every game's win chance over time, the most dramatic first. */
export function WinChances({ ctx }: { ctx: Ctx }) {
  const games = (ctx.live?.games ?? []).filter((g) => g.live || g.final)
  const wp = useWp(games.map((g) => g.game_id), ctx.live?.interval)
  if (!games.length) return <Empty>Gröfin teiknast um leið og leikirnir byrja.</Empty>
  const rows = games.map((g) => ({ g, pts: wp[g.game_id] ?? [], swing: excitement(wp[g.game_id] ?? []) })).sort((a, b) => b.swing - a.swing)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(({ g, pts, swing }, i) => (
        <Link key={g.game_id} href={`/leikur/${g.game_id}`} className="rounded-xl border p-3 grid gap-2 trow" style={{ borderColor: 'var(--border)' }}>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <NflLogo team={ctx.teams.get(g.away)} size={20} /> {g.away} <span className="num">{g.awayScore ?? 0}-{g.homeScore ?? 0}</span> {g.home} <NflLogo team={ctx.teams.get(g.home)} size={20} />
            <span className="ml-auto text-[11px] muted font-normal">{g.final ? 'Lokið' : g.statusLabel}</span>
          </span>
          {i === 0 && swing >= THRILLER && <span className="text-[11px] font-bold tracking-widest inline-flex items-center gap-1" style={{ color: 'var(--live)' }}><Flame size={12} aria-hidden /> MEST SPENNANDI</span>}
          {pts.length > 1 ? <WinChart points={pts} home={ctx.teams.get(g.home)} away={ctx.teams.get(g.away)} homeAbbr={g.home} awayAbbr={g.away} pre={g.pHomePre} height={90} /> : <Empty>Grafið fyllist eftir því sem líður á leikinn.</Empty>}
        </Link>
      ))}
    </div>
  )
}
