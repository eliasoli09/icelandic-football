'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2, RotateCcw, Wand2 } from 'lucide-react'
import { probLabel } from '@/lib/nfl/format'
import { applyPicks, decodePicks, encodePicks, fillWithFavourites, fromPlain, openGames, type PlainState, type Picks, type Side } from '@/lib/nfl/machine'
import { pairUp, seasonFormat, simulateSeason } from '@/lib/nfl/sim'
import { computeStandings } from '@/lib/nfl/standings'
import { CONFERENCES, type Conference, type NflGame, type NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'

const STORE = 'nfl:umspil'
/** Four runs of 500: about a second in a browser, and the page stays responsive between them. */
const RUNS = 4, PER_RUN = 500

interface Odds { p_playoffs: number; p_title: number }

/** RUNS short simulations one after another, averaged; returns a cancel. */
function simChunked(games: NflGame[], teams: NflTeam[], elo: ReturnType<typeof fromPlain>, done: (o: Record<string, Odds>) => void, wait = 0): () => void {
  let alive = true, run = 0
  const sum = new Map<string, Odds>()
  const step = () => {
    if (!alive) return
    for (const [abbr, s] of Object.entries(simulateSeason(games, teams, elo, { sims: PER_RUN, hot: true, seed: 7 + run }))) {
      const x = sum.get(abbr) ?? { p_playoffs: 0, p_title: 0 }
      sum.set(abbr, { p_playoffs: x.p_playoffs + s.p_playoffs / RUNS, p_title: x.p_title + s.p_title / RUNS })
    }
    if (++run < RUNS) t = setTimeout(step, 0)
    else done(Object.fromEntries(sum))
  }
  let t = setTimeout(step, wait)
  return () => { alive = false; clearTimeout(t) }
}

const pts = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d * 100))}`

/**
 * Umspilsvélin: pick the winners of the games left and watch the seeds and the
 * playoff chances move. Unpicked games go the model's way for the seeds and are
 * simulated for the chances; the picks travel in the link, to share.
 */
export function PlayoffMachine({ season, games, teams, state, pHome }: { season: number; games: NflGame[]; teams: NflTeam[]; state: PlainState; pHome: Record<string, number> }) {
  const open = useMemo(() => openGames(games), [games])
  const weeks = useMemo(() => [...new Set(open.map((g) => g.week))], [open])
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const elo = useMemo(() => fromPlain(state), [state])
  const fmt = seasonFormat(season)
  const [picks, setPicks] = useState<Picks>({})
  const [week, setWeek] = useState(weeks[0] ?? 0)
  const [conf, setConf] = useState<Conference>('AFC')
  const [odds, setOdds] = useState<Record<string, Odds> | null>(null)
  const [base, setBase] = useState<Record<string, Odds>>({})
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const loaded = useRef(false)

  // the link's picks first, else this device's last ones
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('v')
    let code = fromHash
    if (!code) try { const s = JSON.parse(localStorage.getItem(STORE) ?? 'null'); if (s?.season === season) code = s.code } catch { /* none */ }
    if (code) setPicks(decodePicks(open, code))
    loaded.current = true
  }, [open, season])

  const code = encodePicks(open, picks)
  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(STORE, JSON.stringify({ season, code })) } catch { /* not remembered */ }
    history.replaceState(null, '', code ? `#v=${code}` : window.location.pathname)
  }, [code, season])

  // the seeds as the table stands plus the reader's picks; unpicked games do not count yet
  const standings = useMemo(() => computeStandings(applyPicks(games, picks), teams), [games, picks, teams])

  // the chances with nothing picked, once: the yardstick for the changes, from the same runs and seeds
  useEffect(() => simChunked(games, teams, elo, setBase), [games, teams, elo])

  // the chances with the picks fixed, in a few short runs so the page keeps up
  useEffect(() => {
    setBusy(true)
    return simChunked(applyPicks(games, picks), teams, elo, (o) => { setOdds(o); setBusy(false) }, 250)
  }, [games, picks, teams, elo])

  const pick = (g: NflGame, side: Side) => setPicks((p) => {
    const next = { ...p }
    if (next[g.game_id] === side) delete next[g.game_id]; else next[g.game_id] = side
    return next
  })
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the address bar has it */ }
  }

  const ranked = standings.seeds[conf]
  const seeds = ranked.slice(0, fmt.seeds).map((r) => r.abbr)
  const firstRound = pairUp(seeds.slice(fmt.byes))
  const list = open.filter((g) => g.week === week)
  const pickedIn = (w: number) => open.filter((g) => g.week === w && picks[g.game_id]).length
  const btn = 'rounded-full border px-3 min-h-[36px] text-sm inline-flex items-center gap-1.5'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
      <section className="grid gap-3 order-2 lg:order-1" aria-label="Leikirnir sem eftir eru">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPicks(fillWithFavourites(games, picks, (g) => pHome[g.game_id]))} className={btn} style={{ borderColor: 'var(--border)' }}><Wand2 size={14} aria-hidden /> Líkanið velur restina</button>
          <button onClick={() => setPicks({})} disabled={!Object.keys(picks).length} className={`${btn} disabled:opacity-40`} style={{ borderColor: 'var(--border)' }}><RotateCcw size={14} aria-hidden /> Hreinsa</button>
          <button onClick={() => void share()} className={btn} style={{ borderColor: 'var(--border)' }}><Link2 size={14} aria-hidden /> {copied ? 'Hlekkur afritaður' : 'Deila'}</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Vikur">
          {weeks.map((w) => {
            const n = open.filter((g) => g.week === w).length, k = pickedIn(w)
            return (
              <button key={w} role="tab" aria-selected={w === week} onClick={() => setWeek(w)} className="shrink-0 rounded-full px-3 min-h-[34px] text-sm border num"
                style={w === week ? { background: 'var(--pill)', color: '#fff', borderColor: 'transparent' } : { borderColor: k === n ? 'var(--accent)' : 'var(--border)' }}>
                Vika {w} <span className="opacity-70 text-xs">{k}/{n}</span>
              </button>
            )
          })}
        </div>
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {list.map((g) => {
            const p = pHome[g.game_id] ?? 0.5
            return (
              <li key={g.game_id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5">
                {([['A', g.away, 1 - p], ['H', g.home, p]] as const).map(([side, abbr, q], i) => {
                  const on = picks[g.game_id] === side, t = byAbbr.get(abbr)
                  const el = (
                    <button key={side} onClick={() => pick(g, side)} aria-pressed={on} className={`rounded-xl border min-h-[46px] px-2.5 flex items-center gap-2 ${i ? 'flex-row-reverse text-right' : ''}`}
                      style={{ borderColor: on ? t?.color ?? 'var(--accent)' : 'var(--border)', background: on ? `color-mix(in srgb, ${t?.color ?? '#2f6bff'} 30%, transparent)` : 'transparent', opacity: picks[g.game_id] && !on ? 0.55 : 1 }}>
                      <NflLogo team={t} size={26} />
                      <span className="min-w-0 grid">
                        <span className="font-bold text-sm">{abbr}</span>
                        <span className="text-[11px] muted num">{probLabel(q)}</span>
                      </span>
                    </button>
                  )
                  return i === 0 ? [el, <span key="at" className="muted text-xs">@</span>] : el
                })}
              </li>
            )
          })}
        </ul>
        <p className="text-xs muted">Smelltu á lið til að láta það vinna, aftur til að hætta við. Prósenturnar eru líkur líkansins á sigri.</p>
      </section>

      <section className="card p-4 grid gap-3 order-1 lg:order-2 lg:sticky lg:top-4" aria-label="Umspilið">
        <div className="flex items-center gap-2">
          {CONFERENCES.map((c) => (
            <button key={c} onClick={() => setConf(c)} aria-pressed={conf === c} className="rounded-full px-4 min-h-[34px] text-sm font-semibold border"
              style={conf === c ? { background: 'var(--pill)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--border)' }}>{c}</button>
          ))}
          <span className="ml-auto text-[11px] muted">{busy ? 'Reiknar…' : `${(RUNS * PER_RUN).toLocaleString('de-DE')} hermanir`}</span>
        </div>
        <ol className="grid text-sm">
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.2rem_3.6rem_3rem] gap-2 px-1 pb-1 text-[10px] muted font-semibold">
            <span>#</span><span>Lið</span><span className="text-right">Staða</span><span className="text-right">Umspil</span><span className="text-right">Titill</span>
          </li>
          {ranked.map((r, i) => {
            const rec = standings.records[r.abbr], o = odds?.[r.abbr], b = base[r.abbr]
            const d = o && b ? o.p_playoffs - b.p_playoffs : 0
            return (
              <li key={r.abbr} className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.2rem_3.6rem_3rem] gap-2 items-center px-1 py-1.5 border-t"
                style={{ borderColor: i === fmt.seeds ? 'var(--border-strong)' : 'var(--border)', borderTopWidth: i === fmt.seeds ? 2 : 1, opacity: i < fmt.seeds ? 1 : 0.65 }}>
                <span className="num font-bold" style={{ color: i < fmt.byes ? 'var(--accent)' : undefined }}>{i < fmt.seeds ? i + 1 : ''}</span>
                <span className="flex items-center gap-2 min-w-0"><NflLogo team={byAbbr.get(r.abbr)} size={20} /><span className="font-semibold truncate">{r.abbr}</span></span>
                <span className="text-right num muted">{rec.w}-{rec.l}{rec.t ? `-${rec.t}` : ''}</span>
                <span className="text-right num">
                  {o ? probLabel(o.p_playoffs) : '-'}
                  {o && b && Math.abs(d) >= 0.005 && <span className="block text-[10px] font-semibold" style={{ color: d > 0 ? 'var(--win)' : 'var(--loss)' }}>{pts(d)}</span>}
                </span>
                <span className="text-right num muted">{o ? probLabel(o.p_title) : '-'}</span>
              </li>
            )
          })}
        </ol>
        <div className="text-xs grid gap-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          <span className="muted">Fyrsta umferð ef þetta fer svona{fmt.byes ? ` (${seeds.slice(0, fmt.byes).join(', ')} situr hjá)` : ''}:</span>
          <span className="font-semibold num">{firstRound.map(([a, b]) => `${a} – ${b}`).join(' · ')}</span>
        </div>
        <p className="text-[11px] muted">Sætin eru staðan í dag með þínum úrslitum; leikir sem þú velur ekki teljast ekki enn. Umspilslíkurnar herma hina leikina með þínum úrslitum föstum; tölurnar í grænu og rauðu eru breytingin frá líkunum án þíns vals. Röðunarreglur NFL gilda.</p>
      </section>
    </div>
  )
}
