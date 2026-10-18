'use client'

import { useMemo, useState, type DragEvent } from 'react'
import { ArrowDown, ArrowUp, Columns2, GripVertical, Plus, Settings2, X } from 'lucide-react'
import type { Broadcast } from '@/lib/nfl/queries'
import type { TeamCard } from '@/lib/nfl/myteam'
import type { NflGame, NflTeam } from '@/lib/nfl/types'
import { CelebrationLayer } from '../celebrate/CelebrationLayer'
import { MyTeam } from '../MyTeam'
import { Bets } from './Bets'
import { Fantasy } from './Fantasy'
import { useFeeds } from './feeds'
import { Highlights } from './Highlights'
import { Countdown, LiveGames, Pickem, RedZone, ScoringFeed, TvNow, type Ctx } from './Simple'
import { KINDS, WIDGET_INFO, newWidget, useBoard, type Board, type Widget } from './store'

/** Widgets that read player and team stats; the stats feed only runs when one is on the board. */
const NEEDS_STATS = new Set(['fantasy', 'bets', 'redzone'])

/** The second screen: widgets the reader picks, orders and sizes, all fed by one live poll. */
export function Dashboard({ teams, round, tv, cards }: { teams: NflTeam[]; round: NflGame[]; tv: Record<string, Broadcast>; cards: TeamCard[] }) {
  const { board, update, signedIn } = useBoard()
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const { live, stats } = useFeeds(!!board?.widgets.some((w) => NEEDS_STATS.has(w.kind)))
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  if (!board) return null
  const ctx: Ctx = { teams: teamMap, round, tv, live, stats }

  const setWidgets = (f: (w: Widget[]) => Widget[]) => update((b) => ({ ...b, widgets: f(b.widgets) }))
  const move = (id: string, by: number) => setWidgets((ws) => {
    const i = ws.findIndex((w) => w.id === id), j = i + by
    if (i < 0 || j < 0 || j >= ws.length) return ws
    const next = [...ws]; [next[i], next[j]] = [next[j], next[i]]; return next
  })
  const drop = (target: string) => (e: DragEvent) => {
    e.preventDefault()
    if (!dragging || dragging === target) return
    setWidgets((ws) => {
      const from = ws.findIndex((w) => w.id === dragging), to = ws.findIndex((w) => w.id === target)
      const next = [...ws]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next
    })
    setDragging(null)
  }
  const missing = KINDS.filter((k) => !board.widgets.some((w) => w.kind === k))
  const anyLive = !!live?.games.some((g) => g.live)

  return (
    <div className="grid gap-4">
      <CelebrationLayer live={live} teams={teamMap} />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl font-extrabold">Stjórnborðið</h1>
        {anyLive && <span className="text-[11px] font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><span className="live-dot" aria-hidden /> Í BEINNI</span>}
        <button onClick={() => setEditing(!editing)} aria-pressed={editing} className="ml-auto rounded-full border px-3 min-h-[36px] text-sm inline-flex items-center gap-1.5" style={{ borderColor: editing ? 'var(--accent)' : 'var(--border)' }}>
          <Settings2 size={15} aria-hidden /> {editing ? 'Klára' : 'Sérsníða'}
        </button>
      </header>
      {editing && (
        <div className="card p-3 grid gap-2 text-sm">
          <p className="muted">Dragðu einingarnar til (á síma: örvarnar), gerðu þær breiðar eða mjóar, eða fjarlægðu þær. {signedIn ? 'Uppsetningin vistast á aðganginn þinn.' : 'Uppsetningin vistast á þessu tæki; skráðu þig inn til að hafa hana í öllum tækjum.'}</p>
          {missing.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {missing.map((k) => (
                <button key={k} onClick={() => setWidgets((ws) => [...ws, newWidget(k)])} title={WIDGET_INFO[k].blurb} className="rounded-full border px-3 min-h-[32px] inline-flex items-center gap-1" style={{ borderColor: 'var(--border)' }}><Plus size={13} aria-hidden /> {WIDGET_INFO[k].title}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
        {board.widgets.map((w, i) => (
          <section key={w.id} aria-label={WIDGET_INFO[w.kind].title}
            draggable={editing} onDragStart={() => setDragging(w.id)} onDragOver={(e) => editing && e.preventDefault()} onDrop={drop(w.id)}
            className={`card p-4 grid gap-3 content-start min-w-0 ${w.wide ? 'lg:col-span-2' : ''}`}
            style={{ outline: editing ? '1px dashed var(--border)' : undefined, opacity: dragging === w.id ? 0.5 : 1 }}>
            <header className="flex items-center gap-2">
              {editing && <GripVertical size={16} className="muted cursor-grab hidden sm:block" aria-hidden />}
              <h2 className="display text-lg font-extrabold">{WIDGET_INFO[w.kind].title}</h2>
              {editing && (
                <span className="ml-auto flex items-center gap-1">
                  <button onClick={() => move(w.id, -1)} disabled={i === 0} aria-label="Færa upp" className="p-1.5 muted disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button onClick={() => move(w.id, 1)} disabled={i === board.widgets.length - 1} aria-label="Færa niður" className="p-1.5 muted disabled:opacity-30"><ArrowDown size={15} /></button>
                  <button onClick={() => setWidgets((ws) => ws.map((x) => x.id === w.id ? { ...x, wide: !x.wide } : x))} aria-pressed={w.wide} aria-label="Breið eða mjó" className="p-1.5 muted hidden lg:inline" style={{ color: w.wide ? 'var(--accent)' : undefined }}><Columns2 size={15} /></button>
                  <button onClick={() => setWidgets((ws) => ws.filter((x) => x.id !== w.id))} aria-label="Fjarlægja" className="p-1.5 muted"><X size={15} /></button>
                </span>
              )}
            </header>
            <Body w={w} ctx={ctx} board={board} update={update} teams={teams} cards={cards} />
          </section>
        ))}
      </div>
      {!board.widgets.length && <p className="muted">Ekkert á stjórnborðinu. Smelltu á Sérsníða og bættu við einingum.</p>}
    </div>
  )
}

function Body({ w, ctx, board, update, teams, cards }: { w: Widget; ctx: Ctx; board: Board; update: (f: (b: Board) => Board) => void; teams: NflTeam[]; cards: TeamCard[] }) {
  switch (w.kind) {
    case 'live': return <LiveGames ctx={ctx} />
    case 'redzone': return <RedZone ctx={ctx} />
    case 'feed': return <ScoringFeed ctx={ctx} />
    case 'fantasy': return <Fantasy ctx={ctx} board={board} update={update} />
    case 'bets': return <Bets ctx={ctx} board={board} update={update} />
    case 'highlights': return <Highlights ctx={ctx} board={board} />
    case 'myteam': return <MyTeam cards={cards} teams={teams} />
    case 'tv': return <TvNow ctx={ctx} />
    case 'pickem': return <Pickem ctx={ctx} />
    case 'countdown': return <Countdown ctx={ctx} />
  }
}
