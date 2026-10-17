'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { franchiseOf } from '@/lib/nfl/elo'
import { STAT_LABEL, findLive, legState, slipStatus, type BetLeg, type LegStatus, type TrackedSlip } from '@/lib/nfl/tracker'
import { NflLogo } from '../NflLogo'
import { newId, type Board } from './store'
import { Empty, type Ctx } from './Simple'

const LEG_COLOR: Record<LegStatus, string> = { won: 'var(--win)', ahead: 'var(--win)', lost: 'var(--loss)', behind: 'var(--loss)', open: 'var(--text-2)' }
const LEG_LABEL: Record<LegStatus, string> = { won: 'Unnið', ahead: 'Yfir', lost: 'Tapað', behind: 'Undir', open: 'Óráðið' }
const dec = (x: number) => x.toFixed(2).replace('.', ',')
const kr = (x: number) => `${Math.round(x).toLocaleString('de-DE')} kr.`

const legText = (l: BetLeg) => l.kind === 'win' ? `${l.team} vinnur` : l.kind === 'td' ? `${l.name} skorar` : `${l.name} yfir ${String(l.line).replace('.', ',')} ${STAT_LABEL[l.stat]}`

/** Tracked slips, each leg against the live score and stats. */
export function Bets({ ctx, board, update }: { ctx: Ctx; board: Board; update: (f: (b: Board) => Board) => void }) {
  const [building, setBuilding] = useState(false)
  const live = new Map((ctx.live?.games ?? []).map((g) => [g.game_id, g]))
  const player = (l: BetLeg) => {
    if (l.kind === 'win') return undefined
    const s = ctx.stats?.games.find((g) => g.game_id === l.game_id)
    return s ? findLive({ name: l.name, team: l.team }, s.players) : undefined
  }
  const remove = (id: string) => update((b) => ({ ...b, bets: b.bets.filter((s) => s.id !== id) }))

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setBuilding(!building)} className="rounded-full border px-3 min-h-[34px] text-sm inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}><Plus size={14} aria-hidden /> Nýr seðill</button>
        <a href="/vedmal" className="text-xs underline decoration-dotted underline-offset-2 muted">Seðlar vikunnar á Veðmálunum</a>
      </div>
      {building && <Builder ctx={ctx} onSave={(s) => { update((b) => ({ ...b, bets: [s, ...b.bets].slice(0, 30) })); setBuilding(false) }} />}
      {!board.bets.length ? <Empty>Engir seðlar enn. Smelltu á &quot;Fylgjast með&quot; á Veðmálunum eða búðu til þinn eigin.</Empty> : board.bets.map((s) => {
        const states = s.legs.map((l) => legState(l, live.get(l.game_id), player(l)))
        const status = slipStatus(states)
        return (
          <article key={s.id} className="rounded-xl border p-3 grid gap-2" style={{ borderColor: status === 'won' ? 'var(--win)' : status === 'lost' ? 'var(--loss)' : 'var(--border)' }}>
            <header className="flex items-center gap-2">
              <span className="font-semibold">{s.name}</span>
              {s.odds && <span className="text-xs muted num">{s.fair ? 'sanngj. ' : ''}stuðull {dec(s.odds)}</span>}
              <span className="ml-auto text-xs font-bold" style={{ color: status === 'won' ? 'var(--win)' : status === 'lost' ? 'var(--loss)' : 'var(--text-2)' }}>{status === 'won' ? 'UNNINN' : status === 'lost' ? 'TAPAÐUR' : 'Í GANGI'}</span>
              <button onClick={() => remove(s.id)} aria-label="Eyða seðli" className="muted p-1"><Trash2 size={13} /></button>
            </header>
            <ul className="grid gap-1 text-sm">
              {s.legs.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <NflLogo team={ctx.teams.get(l.team)} size={18} />
                  <span className="min-w-0 truncate">{legText(l)}</span>
                  {states[i].now && <span className="text-xs muted num shrink-0">{states[i].now}</span>}
                  <span className="ml-auto text-xs font-semibold shrink-0" style={{ color: LEG_COLOR[states[i].status] }}>{LEG_LABEL[states[i].status]}</span>
                </li>
              ))}
            </ul>
            {s.stake && s.odds && <p className="text-xs muted">{kr(s.stake)} undir · {status === 'won' ? 'vinningur' : 'mögulegur vinningur'} {kr(s.stake * s.odds)}</p>}
          </article>
        )
      })}
    </div>
  )
}

interface Found { player_id: string; name: string; team: string; position: string | null }

function Builder({ ctx, onSave }: { ctx: Ctx; onSave: (s: TrackedSlip) => void }) {
  const open = ctx.round.filter((g) => g.home_score === null)
  const [legs, setLegs] = useState<BetLeg[]>([])
  const [kind, setKind] = useState<'win' | 'td' | 'yards'>('win')
  const [game, setGame] = useState(open[0]?.game_id ?? '')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [stat, setStat] = useState<'pass' | 'rush' | 'rec'>('rush')
  const [line, setLine] = useState('49.5')
  const [name, setName] = useState('Minn seðill')
  const [odds, setOdds] = useState('')
  const [stake, setStake] = useState('')

  useEffect(() => {
    if (kind === 'win' || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => void fetch(`/api/nfl/leikmenn/leit?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setFound((d.players ?? []).filter((p: Found) => p.position !== 'DST'))).catch(() => null), 250)
    return () => clearTimeout(t)
  }, [q, kind])

  const gameOf = (team: string) => ctx.round.find((g) => franchiseOf(g.home) === franchiseOf(team) || franchiseOf(g.away) === franchiseOf(team))
  const addPlayer = (p: Found) => {
    const g = gameOf(p.team)
    if (!g) return
    const base = { game_id: g.game_id, player_id: p.player_id, name: p.name, team: p.team }
    const n = Number(line.replace(',', '.'))
    setLegs([...legs, kind === 'td' ? { kind: 'td', ...base } : { kind: 'yards', ...base, stat, line: Number.isFinite(n) ? n : 0 }])
    setQ('')
  }
  const field = 'rounded-lg border px-2 min-h-[34px] text-sm'
  const style = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }

  return (
    <div className="rounded-xl border p-3 grid gap-2" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-1.5 text-sm">
        {([['win', 'Sigur'], ['td', 'Snertimark'], ['yards', 'Jardar']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className="rounded-full px-3 min-h-[32px] border" style={{ borderColor: kind === k ? 'var(--accent)' : 'var(--border)' }}>{l}</button>
        ))}
      </div>
      {kind === 'win' ? (
        <div className="flex flex-wrap gap-2">
          <select value={game} onChange={(e) => setGame(e.target.value)} aria-label="Leikur" className={field} style={style}>
            {open.map((g) => <option key={g.game_id} value={g.game_id}>{g.away} @ {g.home}</option>)}
          </select>
          {(() => { const g = open.find((x) => x.game_id === game); return g ? [g.away, g.home].map((t) => (
            <button key={t} onClick={() => setLegs([...legs, { kind: 'win', game_id: g.game_id, team: t }])} className="rounded-full border px-3 min-h-[34px] text-sm inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}><NflLogo team={ctx.teams.get(t)} size={16} /> {t} vinnur</button>
          )) : null })()}
        </div>
      ) : (
        <div className="grid gap-2">
          {kind === 'yards' && (
            <div className="flex flex-wrap gap-2">
              <select value={stat} onChange={(e) => setStat(e.target.value as 'pass' | 'rush' | 'rec')} aria-label="Tölfræði" className={field} style={style}>
                <option value="rush">Hlaupajardar</option><option value="rec">Gripjardar</option><option value="pass">Sendingajardar</option>
              </select>
              <label className="text-sm flex items-center gap-1.5">yfir <input value={line} onChange={(e) => setLine(e.target.value)} inputMode="decimal" aria-label="Lína" className={`${field} w-20`} style={style} /></label>
            </div>
          )}
          <label className={`${field} flex items-center gap-2`} style={style}><Search size={14} aria-hidden className="muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að leikmanni" aria-label="Leikmaður" className="bg-transparent flex-1 outline-none" /></label>
          {found.length > 0 && <ul className="grid gap-1 max-h-48 overflow-y-auto">{found.map((p) => (
            <li key={p.player_id}><button onClick={() => addPlayer(p)} disabled={!gameOf(p.team)} className="w-full text-left text-sm flex items-center gap-2 px-1 py-1 rounded trow disabled:opacity-40"><Plus size={13} aria-hidden />{p.name} <span className="text-xs muted">{p.position} · {p.team}{gameOf(p.team) ? '' : ' · á ekki leik'}</span></button></li>
          ))}</ul>}
        </div>
      )}
      {legs.length > 0 && (
        <ul className="grid gap-1 text-sm border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          {legs.map((l, i) => <li key={i} className="flex items-center gap-2"><NflLogo team={ctx.teams.get(l.team)} size={16} />{legText(l)}<button onClick={() => setLegs(legs.filter((_, j) => j !== i))} aria-label="Fjarlægja legg" className="ml-auto muted"><X size={13} /></button></li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} aria-label="Nafn seðils" className={`${field} w-36`} style={style} />
        <input value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="Stuðull" inputMode="decimal" aria-label="Stuðull" className={`${field} w-24`} style={style} />
        <input value={stake} onChange={(e) => setStake(e.target.value)} placeholder="Upphæð (kr.)" inputMode="numeric" aria-label="Upphæð" className={`${field} w-32`} style={style} />
        <button disabled={!legs.length} onClick={() => {
          const o = Number(odds.replace(',', '.')), st = Number(stake.replace(/\D/g, ''))
          onSave({ id: newId(), name: name.trim() || 'Minn seðill', legs, odds: o > 1 ? o : null, stake: st > 0 ? st : null, created: new Date().toISOString() })
        }} className="rounded-full px-4 min-h-[36px] text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Vista seðil</button>
      </div>
    </div>
  )
}
