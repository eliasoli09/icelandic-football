'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, Trash2 } from 'lucide-react'
import { browserDb } from '@/lib/leaderboard/store'
import { DeskGate } from './DeskList'

interface Row { id: number; target: string; body: string; created_at: string; hidden: boolean; reports: number; game_user: { name: string } | null }

const link = (target: string) => { const [kind, id] = target.split(':'); return kind === 'grein' ? `/grein/${id}` : `/leikur/${id}` }

export function DeskComments() {
  return <DeskGate>{() => <Desk />}</DeskGate>
}

/** Reported and hidden comments first, then the newest; hide, show again or delete. */
function Desk() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    const { data, error: e } = await browserDb().from('nfl_comment').select('id, target, body, created_at, hidden, reports, game_user(name)')
      .order('reports', { ascending: false }).order('created_at', { ascending: false }).range(0, 199)
    if (e) setError(e.message)
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { void load() }, [])
  const act = async (fn: PromiseLike<{ error: { message: string } | null }>) => { const { error: e } = await fn; if (e) setError(e.message); void load() }
  return (
    <div className="grid gap-5">
      <Link href="/ritstjorn" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Ritstjórn</Link>
      <h1 className="display text-3xl font-extrabold">Athugasemdir</h1>
      <p className="text-sm muted">Athugasemd með þrjár tilkynningar felur sig sjálf þar til hér er ákveðið hvað verður um hana.</p>
      {error && <p className="text-sm" style={{ color: 'var(--loss)' }}>{error}</p>}
      {rows === null ? <p className="muted">Sæki ...</p> : rows.length === 0 ? <p className="muted">Engar athugasemdir enn.</p> : (
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 grid gap-1.5">
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-semibold">{r.game_user?.name ?? 'Óþekkt(ur)'}</span>
                <Link href={link(r.target)} className="text-xs muted underline">{r.target}</Link>
                <span className="text-xs muted">{r.created_at.slice(0, 16).replace('T', ' ')}</span>
                {r.reports > 0 && <span className="text-xs font-semibold" style={{ color: 'var(--loss)' }}>{r.reports} tilkynning{r.reports === 1 ? '' : 'ar'}</span>}
                {r.hidden && <span className="text-xs muted">falin</span>}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{r.body}</p>
              <div className="flex gap-3 text-xs">
                <button onClick={() => void act(browserDb().from('nfl_comment').update({ hidden: !r.hidden }).eq('id', r.id))} className="inline-flex items-center gap-1 muted">
                  {r.hidden ? <><Eye size={12} aria-hidden /> Birta aftur</> : <><EyeOff size={12} aria-hidden /> Fela</>}
                </button>
                <button onClick={() => { if (window.confirm('Eyða athugasemdinni?')) void act(browserDb().from('nfl_comment').delete().eq('id', r.id)) }} className="inline-flex items-center gap-1 muted">
                  <Trash2 size={12} aria-hidden /> Eyða
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
