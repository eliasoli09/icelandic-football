'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Ticket, Trash2 } from 'lucide-react'
import { MARKET_LABELS, type LegMarket, type SlipLeg } from '@/lib/vaktin'

interface MatchOpt {
  id: number
  home: string
  away: string
  date: string
  flagHome: string
  flagAway: string
}

const fmt = (d: string) =>
  new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export function SlipBuilder({ matches }: { matches: MatchOpt[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [legs, setLegs] = useState<SlipLeg[]>([])
  const [matchId, setMatchId] = useState(matches[0]?.id ?? 0)
  const [market, setMarket] = useState<LegMarket>('urslit')
  const [pick, setPick] = useState<'1' | 'X' | '2'>('1')
  const [line, setLine] = useState('2.5')
  const [player, setPlayer] = useState('')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const m = matches.find((x) => x.id === matchId)

  const addLeg = () => {
    if (!m) return
    const vs = `${m.home}–${m.away}`
    let label = ''
    const leg: SlipLeg = { id: String(legs.length + 1), match_id: m.id, market, label: '' }
    if (market === 'urslit') {
      leg.pick = pick
      label = `${vs}: ${pick === '1' ? m.home + ' vinnur' : pick === '2' ? m.away + ' vinnur' : 'Jafntefli'}`
    } else if (market === 'mork_yfir' || market === 'mork_undir') {
      const n = Number(line)
      if (!(n > 0)) return setErr('Ógild markalína')
      leg.line = n
      label = `${vs}: ${market === 'mork_yfir' ? 'Yfir' : 'Undir'} ${n} mörk`
    } else if (market === 'baedi_skora') {
      label = `${vs}: Bæði lið skora`
    } else if (market === 'markaskorari') {
      if (!player.trim()) return setErr('Vantar nafn leikmanns')
      leg.player = player.trim()
      label = `${vs}: ${player.trim()} skorar`
    } else {
      if (!custom.trim()) return setErr('Lýstu leggnum')
      label = `${vs}: ${custom.trim()}`
    }
    setErr('')
    setLegs([...legs, { ...leg, label }])
    setPlayer('')
    setCustom('')
  }

  const create = async () => {
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/vaktin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'Miðinn minn', legs }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error ?? 'villa')
      router.push(`/vaktin/${d.slug}`)
    } catch (e) {
      setErr(String(e))
      setBusy(false)
    }
  }

  const inputCls = 'px-3 py-2 rounded-lg text-sm border w-full'
  const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }

  return (
    <div className="grid gap-5">
      <div className="card p-4 grid gap-3">
        <label className="text-xs font-bold muted uppercase tracking-wide">Heiti miðans</label>
        <input className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.d. HM-miðinn minn" maxLength={80} />

        <label className="text-xs font-bold muted uppercase tracking-wide mt-2">Bættu við legg</label>
        <div className="grid sm:grid-cols-2 gap-2">
          <select className={inputCls} style={inputStyle} value={matchId} onChange={(e) => setMatchId(Number(e.target.value))}>
            {matches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.flagHome} {x.home} – {x.away} {x.flagAway} · {fmt(x.date)}
              </option>
            ))}
          </select>
          <select className={inputCls} style={inputStyle} value={market} onChange={(e) => setMarket(e.target.value as LegMarket)}>
            {(Object.keys(MARKET_LABELS) as LegMarket[]).map((k) => (
              <option key={k} value={k}>{MARKET_LABELS[k]}</option>
            ))}
          </select>
        </div>
        {market === 'urslit' && m && (
          <div className="flex gap-2">
            {(['1', 'X', '2'] as const).map((p) => (
              <button key={p} onClick={() => setPick(p)} className="flex-1 px-3 py-2 rounded-lg text-sm font-bold border"
                style={{ background: pick === p ? 'var(--accent)' : 'var(--surface)', color: pick === p ? 'var(--accent-ink)' : 'var(--text-2)', borderColor: 'var(--border)' }}>
                {p === '1' ? m.home : p === '2' ? m.away : 'Jafntefli'}
              </button>
            ))}
          </div>
        )}
        {(market === 'mork_yfir' || market === 'mork_undir') && (
          <input className={inputCls} style={inputStyle} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Markalína, t.d. 2.5" inputMode="decimal" />
        )}
        {market === 'markaskorari' && (
          <input className={inputCls} style={inputStyle} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Nafn leikmanns, t.d. Olise" maxLength={60} />
        )}
        {market === 'handvirkt' && (
          <input className={inputCls} style={inputStyle} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Lýsing, t.d. Yfir 9,5 horn" maxLength={100} />
        )}
        <button onClick={addLeg} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          <Plus size={15} aria-hidden /> Bæta legg á miðann
        </button>
      </div>

      {legs.length > 0 && (
        <div className="card p-4 grid gap-2">
          <p className="text-xs font-bold muted uppercase tracking-wide">Miðinn ({legs.length} {legs.length === 1 ? 'leggur' : 'leggir'})</p>
          {legs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{l.label}</span>
              <button aria-label="Eyða legg" onClick={() => setLegs(legs.filter((x) => x.id !== l.id))} className="p-1.5 rounded" style={{ color: 'var(--loss)' }}>
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
          <button onClick={create} disabled={busy} className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: busy ? 0.6 : 1 }}>
            <Ticket size={15} aria-hidden /> {busy ? 'Bý til…' : 'Búa til miða og fá hlekk'}
          </button>
        </div>
      )}
      {err && <p className="text-sm" style={{ color: 'var(--loss)' }}>{err}</p>}
    </div>
  )
}
