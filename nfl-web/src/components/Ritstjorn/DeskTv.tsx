'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { browserDb } from '@/lib/leaderboard/store'
import { clock, dayLabel } from '@/lib/nfl/time'
import { DeskGate } from './DeskList'

type Game = { game_id: string; kickoff: string; home: string; away: string }
type Listing = { channel: string; note: string }
const CHANNELS = ['Sýn Sport', 'Sýn Sport 2', 'Sýn Sport 3', 'Sýn Sport 4', 'Sýn Sport Viaplay']
const field = 'rounded-lg border px-3 min-h-[36px] text-sm'
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }

export function DeskTv() {
  return <DeskGate>{(me) => <Desk me={me} />}</DeskGate>
}

/** The next ten days' games with a channel each; an empty channel means not shown here. */
function Desk({ me }: { me: { id: string } }) {
  const [games, setGames] = useState<Game[] | null>(null)
  const [tv, setTv] = useState<Record<string, Listing>>({})
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null)
  const load = async () => {
    const from = new Date(Date.now() - 4 * 3600_000).toISOString(), to = new Date(Date.now() + 10 * 86400_000).toISOString()
    const { data: g } = await browserDb().from('nfl_games').select('game_id, kickoff, home, away').gte('kickoff', from).lte('kickoff', to).order('kickoff')
    const ids = (g ?? []).map((x) => x.game_id)
    const { data: b } = ids.length ? await browserDb().from('nfl_broadcast').select('game_id, channel, note').in('game_id', ids) : { data: [] }
    setGames((g ?? []) as Game[])
    setTv(Object.fromEntries((b ?? []).map((r) => [r.game_id, { channel: r.channel, note: r.note }])))
  }
  useEffect(() => { load().catch((e) => setNote({ good: false, text: e.message })) }, [])

  const save = async (g: Game, l: Listing) => {
    const channel = l.channel.trim()
    const { error } = channel
      ? await browserDb().from('nfl_broadcast').upsert({ game_id: g.game_id, channel, note: l.note.trim(), updated_by: me.id, updated_at: new Date().toISOString() })
      : await browserDb().from('nfl_broadcast').delete().eq('game_id', g.game_id)
    setNote(error ? { good: false, text: error.message } : { good: true, text: channel ? `${g.away} @ ${g.home}: ${channel}` : `${g.away} @ ${g.home}: tekið af listanum` })
    void load()
  }

  return (
    <div className="grid gap-5">
      <Link href="/ritstjorn" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Ritstjórn</Link>
      <h1 className="display text-3xl font-extrabold">Í sjónvarpinu</h1>
      <p className="text-sm muted">Skráðu rás við leiki sem eru sýndir á Íslandi. Tóm rás tekur leikinn af listanum.</p>
      {note && <p className="text-sm font-semibold" role="status" style={{ color: note.good ? 'var(--win)' : 'var(--loss)' }}>{note.text}</p>}
      <datalist id="channels">{CHANNELS.map((c) => <option key={c} value={c} />)}</datalist>
      {games === null ? <p className="muted">Sæki ...</p> : (
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {games.map((g) => <Row key={`${g.game_id}:${tv[g.game_id]?.channel ?? ''}`} g={g} l={tv[g.game_id]} onSave={(l) => void save(g, l)} />)}
        </ul>
      )}
    </div>
  )
}

function Row({ g, l, onSave }: { g: Game; l: Listing | undefined; onSave: (l: Listing) => void }) {
  const [channel, setChannel] = useState(l?.channel ?? '')
  const [text, setText] = useState(l?.note ?? '')
  const dirty = channel !== (l?.channel ?? '') || text !== (l?.note ?? '')
  return (
    <li className="px-4 py-3 flex flex-wrap items-center gap-2">
      <span className="text-xs muted w-40">{dayLabel(g.kickoff)} {clock(g.kickoff)}</span>
      <span className="font-semibold w-28">{g.away} @ {g.home}</span>
      <input list="channels" placeholder="Rás" value={channel} onChange={(e) => setChannel(e.target.value)} className={`${field} w-44`} style={fieldStyle} />
      <input placeholder="Athugasemd (valfrjálst)" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} className={`${field} flex-1 min-w-[10rem]`} style={fieldStyle} />
      <button disabled={!dirty} onClick={() => onSave({ channel, note: text })} className="rounded-full px-3 min-h-[36px] text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Vista</button>
    </li>
  )
}
