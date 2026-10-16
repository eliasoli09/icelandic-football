'use client'

import { useState, type FormEvent } from 'react'
import { Copy, LogOut, Users } from 'lucide-react'
import type { Me } from '@/lib/leaderboard/store'
import { createLeague, leaveLeague, type League } from '@/lib/nfl/pickStore'

export const inviteUrl = (code: string) => `${window.location.origin}/nfl/spa/deild/${code}`

export function PickLeagues({ me, leagues, names, onChanged, onError }: {
  me: Me; leagues: League[]; names: Map<string, string>
  onChanged: (text: string | null, select?: string) => void; onError: (text: string) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const out = await createLeague(name.trim())
    setBusy(false)
    if (!out.ok) { onError(out.message); return }
    setName('')
    const copied = await copy(inviteUrl(out.code))
    onChanged(copied ? 'Deildin er til og boðstengillinn er kominn á klippiborðið.' : 'Deildin er til. Afritaðu boðstengilinn hér fyrir neðan.', out.id)
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="Deildirnar mínar">
      <h3 className="display text-xl font-extrabold inline-flex items-center gap-2"><Users size={18} aria-hidden /> Deildirnar mínar</h3>
      <p className="text-sm muted">Stofnaðu deild fyrir vinina, vinnustaðinn eða fjölskylduna og sendu þeim boðstengilinn.</p>
      {leagues.length > 0 && (
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {leagues.map((l) => (
            <li key={l.id} className="px-3 py-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{l.name}</span>
              <span className="text-xs muted" title={l.members.map((m) => names.get(m) ?? '').join(', ')}>{l.members.length} {l.members.length === 1 ? 'meðlimur' : 'meðlimir'}</span>
              <span className="ml-auto inline-flex gap-2">
                <button className="rounded-full border px-3 min-h-[36px] text-sm font-semibold inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}
                  onClick={async () => { const ok = await copy(inviteUrl(l.code)); onChanged(ok ? 'Boðstengillinn er kominn á klippiborðið.' : inviteUrl(l.code)) }}>
                  <Copy size={13} aria-hidden /> Boðstengill
                </button>
                <button className="rounded-full border px-3 min-h-[36px] text-sm inline-flex items-center gap-1.5 muted" style={{ borderColor: 'var(--border)' }}
                  onClick={async () => {
                    if (!window.confirm(`Hætta í ${l.name}?`)) return
                    if (await leaveLeague(me.id, l.id)) onChanged(`Þú ert hætt(ur) í ${l.name}.`, 'all'); else onError('Tókst ekki að hætta í deildinni.')
                  }}>
                  <LogOut size={13} aria-hidden /> Hætta
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap gap-2" onSubmit={create}>
        <label htmlFor="league-name" className="sr-only">Nafn deildar</label>
        <input id="league-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nafn deildar, t.d. Vinnustaðurinn"
          className="flex-1 min-w-[12rem] min-h-[40px] rounded-lg border px-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        <button className="rounded-full px-4 min-h-[40px] font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          disabled={busy || name.trim().length < 2}>Stofna deild</button>
      </form>
    </section>
  )
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
