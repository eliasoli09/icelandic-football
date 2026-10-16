'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { addTrade, deleteTrade, flagNews, listTrades, recentNews, type DeskNews, type DeskTrade } from '@/lib/nfl/articles/editorStore'
import { HEAT_LABEL, type Heat } from '@/lib/nfl/rumours'
import { DeskGate } from './DeskList'

const field = 'rounded-lg border px-3 min-h-[40px] text-sm'
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }
type Team = { abbr: string; name: string }

export function DeskRumours({ teams }: { teams: Team[] }) {
  return <DeskGate>{(me) => <Desk me={me} teams={teams} />}</DeskGate>
}

function Desk({ me, teams }: { me: { id: string }; teams: Team[] }) {
  const [news, setNews] = useState<DeskNews[] | null>(null)
  const [trades, setTrades] = useState<DeskTrade[]>([])
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null)
  const [onlyRumours, setOnlyRumours] = useState(true)
  const load = async () => { setNews(await recentNews()); setTrades(await listTrades()) }
  useEffect(() => { load().catch((e) => setNote({ good: false, text: e.message })) }, [])

  const flag = async (n: DeskNews, patch: Partial<Pick<DeskNews, 'rumour' | 'heat'>>) => {
    setNews((xs) => xs?.map((x) => (x.url === n.url ? { ...x, ...patch } : x)) ?? null)
    try { await flagNews(n.url, patch) } catch (e) { setNote({ good: false, text: (e as Error).message }); void load() }
  }
  const shown = (news ?? []).filter((n) => !onlyRumours || n.rumour)

  return (
    <div className="grid gap-8">
      <Link href="/ritstjorn" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Ritstjórn</Link>
      <h1 className="display text-3xl font-extrabold">Slúður og skipti</h1>
      {note && <p className="text-sm font-semibold" role="status" style={{ color: note.good ? 'var(--win)' : 'var(--loss)' }}>{note.text}</p>}

      <TradeForm teams={teams} onSave={async (t) => {
        try { await addTrade(t, me.id); setNote({ good: true, text: 'Skiptin eru skráð og birtast á /sludur.' }); await load() }
        catch (e) { setNote({ good: false, text: (e as Error).message }) }
      }} />

      {trades.length > 0 && (
        <section className="grid gap-2">
          <h2 className="display text-xl font-extrabold">Skráð skipti</h2>
          <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {trades.map((t) => (
              <li key={t.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="muted num">{t.traded_on}</span>
                <span className="min-w-0 flex-1">{t.moves.map((m) => `${m.player} (${m.from} → ${m.to})`).join(', ')}{t.compensation ? ` · á móti: ${t.compensation}` : ''}</span>
                <button className="muted inline-flex items-center gap-1" onClick={async () => {
                  if (!window.confirm('Eyða þessum skiptum af síðunni?')) return
                  try { await deleteTrade(t.id); await load() } catch (e) { setNote({ good: false, text: (e as Error).message }) }
                }}><Trash2 size={14} aria-hidden /> Eyða</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl font-extrabold">Fréttir síðustu 14 daga</h2>
          <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={onlyRumours} onChange={(e) => setOnlyRumours(e.target.checked)} /> Aðeins slúður</label>
        </div>
        {news === null ? <p className="muted">Sæki ...</p> : shown.length === 0 ? <p className="muted">Ekkert hér.</p> : (
          <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {shown.map((n) => (
              <li key={n.url} className="px-4 py-3 grid gap-2">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-semibold leading-snug">{n.title_is ?? n.title}</a>
                <span className="text-xs muted">{n.source} · {n.published_at.slice(0, 10)}{n.title_is ? '' : ' · bíður samantektar (birtist ekki fyrr)'}</span>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={n.rumour} onChange={(e) => void flag(n, { rumour: e.target.checked, ...(e.target.checked ? {} : { heat: null }) })} /> Slúður</label>
                  {n.rumour && (['heitt', 'volgt', 'kalt'] as Heat[]).map((h) => (
                    <button key={h} onClick={() => void flag(n, { heat: n.heat === h ? null : h })} aria-pressed={n.heat === h}
                      className="rounded-full border px-3 min-h-[32px] text-xs font-semibold"
                      style={{ borderColor: 'var(--border)', background: n.heat === h ? 'var(--accent)' : 'transparent', color: n.heat === h ? 'var(--accent-ink)' : 'var(--text-2)' }}>
                      {HEAT_LABEL[h]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TradeForm({ teams, onSave }: { teams: Team[]; onSave: (t: Omit<DeskTrade, 'id'>) => Promise<void> }) {
  const blank = { player: '', from: '', to: '' }
  const [moves, setMoves] = useState([blank])
  const [compensation, setCompensation] = useState('')
  const [source, setSource] = useState('')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const valid = moves.every((m) => m.player.trim() && m.from && m.to && m.from !== m.to)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    await onSave({ traded_on: day, moves: moves.map((m) => ({ ...m, player: m.player.trim() })), compensation: compensation.trim(), source_url: source.trim() || null })
    setMoves([blank]); setCompensation(''); setSource('')
  }
  const team = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={field} style={fieldStyle}>
      <option value="">{label}</option>
      {teams.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
    </select>
  )
  return (
    <form onSubmit={submit} className="card p-4 grid gap-3">
      <h2 className="display text-xl font-extrabold">Skrá staðfest skipti</h2>
      {moves.map((m, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input aria-label="Leikmaður" placeholder="Leikmaður" value={m.player} onChange={(e) => setMoves(moves.map((x, j) => (j === i ? { ...x, player: e.target.value } : x)))} className={`${field} flex-1 min-w-[12rem]`} style={fieldStyle} />
          {team(m.from, (v) => setMoves(moves.map((x, j) => (j === i ? { ...x, from: v } : x))), 'Frá liði')}
          {team(m.to, (v) => setMoves(moves.map((x, j) => (j === i ? { ...x, to: v } : x))), 'Til liðs')}
        </div>
      ))}
      <button type="button" onClick={() => setMoves([...moves, blank])} className="text-sm muted inline-flex items-center gap-1 w-fit"><Plus size={14} aria-hidden /> Annar leikmaður í sömu skiptum</button>
      <input placeholder="Á móti, t.d. 3. umferð 2027" value={compensation} onChange={(e) => setCompensation(e.target.value)} className={field} style={fieldStyle} />
      <div className="flex flex-wrap gap-2">
        <input placeholder="Tengill á heimild" value={source} onChange={(e) => setSource(e.target.value)} className={`${field} flex-1 min-w-[14rem]`} style={fieldStyle} />
        <input type="date" aria-label="Dagur" value={day} onChange={(e) => setDay(e.target.value)} className={field} style={fieldStyle} />
      </div>
      <button disabled={!valid} className="rounded-full px-4 min-h-[40px] font-semibold w-fit disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Skrá skiptin</button>
    </form>
  )
}
