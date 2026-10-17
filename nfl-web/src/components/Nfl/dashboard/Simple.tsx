'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tv } from 'lucide-react'
import type { LiveReply, LiveRow } from '@/app/api/nfl/live/route'
import type { StatsReply } from '@/app/api/nfl/live/stats/route'
import { browserDb, whoAmI } from '@/lib/leaderboard/store'
import { probLabel } from '@/lib/nfl/format'
import { EVENT_LABEL, playIs, quarterLabel } from '@/lib/nfl/live'
import type { Broadcast } from '@/lib/nfl/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import type { NflGame, NflTeam } from '@/lib/nfl/types'
import { NflLogo } from '../NflLogo'
import { ProbSplit } from '../ProbSplit'

export interface Ctx {
  teams: Map<string, NflTeam>
  /** The games of the round under way or next, oldest first. */
  round: NflGame[]
  tv: Record<string, Broadcast>
  live: LiveReply | null
  stats: StatsReply | null
}

export const when = (iso: string) => `${dayLabel(iso)} ${isSmallHours(iso) ? 'aðfaranótt ' : 'kl. '}${clock(iso)}`
const state = (g: LiveRow) => `${g.statusLabel}${g.clock && g.live && g.status !== 'HT' ? ` · ${g.clock}` : ''}`
export const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm muted">{children}</p>

/** Every game under way, with our live win chance; the next kickoffs when nothing is on. */
export function LiveGames({ ctx }: { ctx: Ctx }) {
  const games = ctx.live?.games ?? []
  if (!games.length) {
    const next = ctx.round.filter((g) => g.home_score === null && new Date(g.kickoff).getTime() > Date.now()).slice(0, 4)
    return next.length ? (
      <div className="grid gap-2">
        <Empty>Enginn leikur í gangi. Næstu leikir:</Empty>
        <ul className="grid gap-1.5 text-sm">{next.map((g) => (
          <li key={g.game_id}><Link href={`/leikur/${g.game_id}`} className="flex items-center gap-2"><NflLogo team={ctx.teams.get(g.away)} size={18} />{g.away} <span className="muted">@</span> <NflLogo team={ctx.teams.get(g.home)} size={18} />{g.home}<span className="ml-auto text-xs muted">{when(g.kickoff)}</span></Link></li>
        ))}</ul>
      </div>
    ) : <Empty>Engir leikir fram undan í þessari umferð.</Empty>
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {games.map((g) => (
        <li key={g.game_id}>
          <Link href={`/leikur/${g.game_id}`} className="card card-hover px-3 py-2.5 grid gap-1.5">
            {([['away', g.away, g.awayScore], ['home', g.home, g.homeScore]] as const).map(([side, abbr, score]) => (
              <span key={side} className="flex items-center gap-2 text-sm">
                <NflLogo team={ctx.teams.get(abbr)} size={22} /><span className="font-semibold">{ctx.teams.get(abbr)?.name.split(' ').at(-1) ?? abbr}</span>
                <span className="ml-auto num font-bold text-lg">{score ?? '-'}</span>
              </span>
            ))}
            <span className="flex items-center justify-between text-[11px] muted"><span>{g.live && <span className="live-dot mr-1.5" aria-hidden />}{state(g)}</span>{g.pHome !== null && !g.final && <span>{g.home} {probLabel(g.pHome)}</span>}</span>
            {g.pHome !== null && !g.final && <ProbSplit pHome={g.pHome} home={ctx.teams.get(g.home)} away={ctx.teams.get(g.away)} height={4} />}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Red-zone trips and touchdowns by club, the tightest games late on, and where RedZone is on. */
export function RedZone({ ctx }: { ctx: Ctx }) {
  const live = ctx.live?.games ?? []
  const tight = live.filter((g) => g.live && g.pHome !== null && (g.quarter ?? 0) >= 4 && Math.abs(g.pHome - 0.5) < 0.2).sort((a, b) => Math.abs(a.pHome! - 0.5) - Math.abs(b.pHome! - 0.5))
  const rz = (ctx.stats?.games ?? []).flatMap((g) => g.teams.map((t) => ({ ...t, game_id: g.game_id }))).filter((t) => t.rzAtt > 0).sort((a, b) => b.rzAtt - a.rzAtt || b.rzMade - a.rzMade)
  const channel = Object.values(ctx.tv).find((b) => /redzone/i.test(b.channel))?.channel.replace(/^RedZone,?\s*/i, '')
  return (
    <div className="grid gap-3">
      {channel && <p className="text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><Tv size={13} aria-hidden /> NFL RedZone á {channel}</p>}
      {tight.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--loss)' }}>Á HNÍFSEGG</p>
          {tight.map((g) => <Link key={g.game_id} href={`/leikur/${g.game_id}`} className="text-sm flex items-center gap-2"><span className="font-semibold">{g.away} {g.awayScore}-{g.homeScore} {g.home}</span><span className="text-xs muted">{state(g)} · {g.home} {probLabel(g.pHome!)}</span></Link>)}
        </div>
      )}
      {!live.length ? <Empty>Rauða svæðið lifnar við þegar leikirnir byrja.</Empty> : !rz.length ? <Empty>Engin lið komin á rauða svæðið enn.</Empty> : (
        <table className="text-sm w-full">
          <thead><tr className="text-[11px] muted text-left"><th className="font-normal">Lið</th><th className="font-normal text-right">Ferðir</th><th className="font-normal text-right">Snertimörk</th><th className="font-normal text-right">Hlutfall</th></tr></thead>
          <tbody>{rz.map((t) => (
            <tr key={`${t.game_id}${t.team}`}><td className="py-1"><span className="inline-flex items-center gap-2"><NflLogo team={ctx.teams.get(t.team)} size={18} />{t.team}</span></td><td className="text-right num">{t.rzAtt}</td><td className="text-right num">{t.rzMade}</td><td className="text-right num">{probLabel(t.rzMade / t.rzAtt)}</td></tr>
          ))}</tbody>
        </table>
      )}
      <p className="text-[11px] muted">Rauða svæðið er síðustu 20 jardarnir að endamarki. Tölurnar uppfærast á 1-2 mínútna fresti.</p>
    </div>
  )
}

const QUARTER = ['first', 'second', 'third', 'fourth', 'overtime']
const qi = (q: string) => QUARTER.indexOf(q.toLowerCase())
const clockSecs = (m: string | null) => { const [a, b] = (m ?? '0:00').split(':').map(Number); return (a || 0) * 60 + (b || 0) }

/** Every scoring play of every game under way, newest first. */
export function ScoringFeed({ ctx }: { ctx: Ctx }) {
  const plays = (ctx.live?.games ?? []).flatMap((g) => (g.events ?? []).map((e, i) => ({ ...e, g, i })))
    .sort((a, b) => qi(b.quarter) - qi(a.quarter) || clockSecs(a.minute) - clockSecs(b.minute) || b.i - a.i)
  if (!plays.length) return <Empty>Engin stig skoruð enn í leikjum dagsins.</Empty>
  return (
    <ol className="grid gap-2 max-h-[28rem] overflow-y-auto pr-1">
      {plays.slice(0, 40).map((p) => (
        <li key={`${p.g.game_id}${p.i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 text-sm">
          <NflLogo team={ctx.teams.get(p.team) ?? [...ctx.teams.values()].find((t) => t.name === p.team)} size={22} />
          <span className="min-w-0">
            <span className="block"><span className="font-semibold" style={{ color: p.type === 'TD' ? 'var(--accent)' : undefined }}>{EVENT_LABEL[p.type] ?? p.type}</span> <span className="muted text-xs">{p.g.away} {p.awayScore}-{p.homeScore} {p.g.home} · {quarterLabel(p.quarter)}{p.minute ? ` ${p.minute}` : ''}</span></span>
            <span className="block text-xs muted break-words">{playIs(p.comment)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** What Icelandic TV shows now and next. */
export function TvNow({ ctx }: { ctx: Ctx }) {
  const live = new Set((ctx.live?.games ?? []).filter((g) => g.live).map((g) => g.game_id))
  const listed = ctx.round.filter((g) => ctx.tv[g.game_id] && (live.has(g.game_id) || (g.home_score === null && new Date(g.kickoff).getTime() > Date.now() - 4 * 3600_000)))
  if (!listed.length) return <Empty>Engir leikir skráðir í íslensku sjónvarpi á næstunni. <Link href="/leikir/sjonvarp" className="underline">Dagskráin</Link></Empty>
  return (
    <ul className="grid gap-2 text-sm">
      {listed.slice(0, 8).map((g) => (
        <li key={g.game_id} className="flex items-center gap-2">
          {live.has(g.game_id) ? <span className="live-dot" aria-label="Í beinni" /> : <span className="text-xs muted w-[4.5rem] shrink-0">{clock(g.kickoff)}</span>}
          <span className="min-w-0 truncate">{g.away} @ {g.home}</span>
          <span className="ml-auto text-xs font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: 'var(--accent)' }}><Tv size={12} aria-hidden /> {ctx.tv[g.game_id].channel}</span>
        </li>
      ))}
    </ul>
  )
}

/** Time to the next kickoff. */
export function Countdown({ ctx }: { ctx: Ctx }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const next = ctx.round.find((g) => new Date(g.kickoff).getTime() > now)
  if (!next) return <Empty>Engir fleiri leikir í þessari umferð.</Empty>
  const s = Math.floor((new Date(next.kickoff).getTime() - now) / 1000)
  const parts = [[Math.floor(s / 86400), 'd'], [Math.floor(s / 3600) % 24, 'klst'], [Math.floor(s / 60) % 60, 'mín'], [s % 60, 'sek']] as const
  return (
    <div className="grid gap-2">
      <div className="flex gap-3">{parts.filter(([v], i) => i > 0 || v > 0).map(([v, u]) => <span key={u} className="text-center"><span className="block num font-extrabold text-3xl">{String(v).padStart(2, '0')}</span><span className="text-[11px] muted">{u}</span></span>)}</div>
      <Link href={`/leikur/${next.game_id}`} className="text-sm flex items-center gap-2"><NflLogo team={ctx.teams.get(next.away)} size={18} />{ctx.teams.get(next.away)?.name ?? next.away} <span className="muted">@</span> <NflLogo team={ctx.teams.get(next.home)} size={18} />{ctx.teams.get(next.home)?.name ?? next.home}</Link>
      <span className="text-xs muted">{when(next.kickoff)}</span>
    </div>
  )
}

/** The reader's pick'em picks for the round, each against the live score. */
export function Pickem({ ctx }: { ctx: Ctx }) {
  const [picks, setPicks] = useState<Record<string, string> | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  useEffect(() => {
    void (async () => {
      const me = await whoAmI().catch(() => null)
      if (!me) { setSignedIn(false); return }
      const { data } = await browserDb().from('nfl_pick').select('game_id, pick').eq('player', me.id).in('game_id', ctx.round.map((g) => g.game_id))
      setPicks(Object.fromEntries((data ?? []).map((r) => [r.game_id, r.pick])))
    })()
  }, [ctx.round])
  if (!signedIn) return <Empty>Skráðu þig inn í <Link href="/spa" className="underline">Spáleiknum</Link> til að sjá tippin þín hér.</Empty>
  if (!picks) return null
  const live = new Map((ctx.live?.games ?? []).map((g) => [g.game_id, g]))
  const rows = ctx.round.filter((g) => picks[g.game_id])
  if (!rows.length) return <Empty>Þú átt eftir að tippa á þessa umferð. <Link href="/spa" className="underline">Tippa</Link></Empty>
  let right = 0, wrong = 0
  const out = rows.map((g) => {
    const l = live.get(g.game_id)
    const hs = l?.homeScore ?? g.home_score, as = l?.awayScore ?? g.away_score
    const done = l ? l.final : g.home_score !== null
    const pick = picks[g.game_id]
    const lead = hs === null || as === null ? null : hs === as ? null : (hs > as ? g.home : g.away)
    const state = lead === null ? 'open' : lead === pick ? (done ? 'won' : 'ahead') : (done ? 'lost' : 'behind')
    if (state === 'won') right++
    if (state === 'lost') wrong++
    return { g, pick, state, score: hs !== null && as !== null ? `${as}-${hs}` : null }
  })
  const color = { won: 'var(--win)', ahead: 'var(--win)', lost: 'var(--loss)', behind: 'var(--loss)', open: 'var(--text-2)' } as const
  return (
    <div className="grid gap-2">
      <p className="text-sm"><span className="font-semibold">{right} rétt</span> <span className="muted">· {wrong} rangt · {rows.length - right - wrong} eftir</span></p>
      <ul className="grid gap-1 text-sm">{out.map(({ g, pick, state, score }) => (
        <li key={g.game_id} className="flex items-center gap-2"><NflLogo team={ctx.teams.get(pick)} size={18} /><span className="font-medium">{pick}</span><span className="text-xs muted">{g.away} @ {g.home}{score ? ` · ${score}` : ''}</span><span className="ml-auto text-xs font-semibold" style={{ color: color[state as keyof typeof color] }}>{{ won: 'Rétt', ahead: 'Yfir', lost: 'Rangt', behind: 'Undir', open: '-' }[state]}</span></li>
      ))}</ul>
    </div>
  )
}
