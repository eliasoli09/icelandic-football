'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Flag, MessageSquare, Trash2 } from 'lucide-react'
import { SignIn } from '@/components/Leaderboard/SignIn'
import { browserDb, whoAmI, type Me } from '@/lib/leaderboard/store'

interface Row { id: number; body: string; created_at: string; author: string; hidden: boolean; game_user: { name: string } | null }

const MAX = 1000
const when = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'rétt í þessu'
  if (mins < 60) return `fyrir ${mins} mín.`
  const h = Math.round(mins / 60)
  if (h < 24) return `fyrir ${h} klst.`
  const d = new Date(iso)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
}

/** Comments under an article or a game: signed-in readers write, anyone reads, three reports hide one. */
export function Comments({ target }: { target: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [reported, setReported] = useState<Set<number>>(new Set())
  const [signIn, setSignIn] = useState(false)

  const load = useCallback(async () => {
    const { data } = await browserDb().from('nfl_comment').select('id, body, created_at, author, hidden, game_user(name)').eq('target', target).order('created_at').range(0, 299)
    setRows((data ?? []) as unknown as Row[])
  }, [target])

  useEffect(() => {
    void whoAmI().then(setMe).catch(() => null)
    void load()
    const { data } = browserDb().auth.onAuthStateChange(() => { void whoAmI().then(setMe).catch(() => null); void load() })
    return () => data.subscription.unsubscribe()
  }, [load])

  const post = async (e: FormEvent) => {
    e.preventDefault()
    if (!me?.name || !text.trim()) return
    setBusy(true); setNote(null)
    const { error } = await browserDb().from('nfl_comment').insert({ target, author: me.id, body: text.trim() })
    setBusy(false)
    if (error) { setNote(error.code === '42501' ? 'Of margar athugasemdir á stuttum tíma. Reyndu aftur eftir smá stund.' : 'Athugasemdin vistaðist ekki.'); return }
    setText(''); void load()
  }

  const report = async (id: number) => {
    if (!window.confirm('Tilkynna þessa athugasemd til ritstjórnar?')) return
    const { error } = await browserDb().rpc('rpc_report_nfl_comment', { p_id: id })
    if (!error) { setReported(new Set([...reported, id])); setNote('Takk, ritstjórn skoðar þetta.') }
  }
  const remove = async (id: number) => {
    if (!window.confirm('Eyða athugasemdinni þinni?')) return
    await browserDb().from('nfl_comment').delete().eq('id', id)
    void load()
  }

  return (
    <section className="grid gap-3" aria-label="Athugasemdir">
      <h2 className="display text-lg font-extrabold inline-flex items-center gap-2"><MessageSquare size={18} aria-hidden /> Athugasemdir {rows?.length ? <span className="muted text-sm font-normal">({rows.filter((r) => !r.hidden).length})</span> : null}</h2>
      {rows === null ? null : rows.length === 0 ? <p className="text-sm muted">Engar athugasemdir enn.</p> : (
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 grid gap-1">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold">{r.game_user?.name ?? 'Óþekkt(ur)'}</span>
                <span className="text-xs muted">{when(r.created_at)}</span>
                {r.hidden && <span className="text-xs" style={{ color: 'var(--loss)' }}>falin þar til ritstjórn skoðar hana</span>}
                <span className="ml-auto inline-flex gap-3">
                  {me && me.id === r.author && <button onClick={() => void remove(r.id)} className="text-xs muted inline-flex items-center gap-1"><Trash2 size={12} aria-hidden /> Eyða</button>}
                  {me?.name && me.id !== r.author && !reported.has(r.id) && <button onClick={() => void report(r.id)} className="text-xs muted inline-flex items-center gap-1"><Flag size={12} aria-hidden /> Tilkynna</button>}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-sm" role="status">{note}</p>}
      {me?.name ? (
        <form onSubmit={post} className="grid gap-2">
          <label htmlFor={`c-${target}`} className="sr-only">Athugasemd</label>
          <textarea id={`c-${target}`} value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={3} placeholder={`Skrifaðu athugasemd sem ${me.name}`}
            className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
          <div className="flex items-center justify-between text-xs muted">
            <span>{text.length}/{MAX} · Sýndu kurteisi. Ritstjórn getur fjarlægt athugasemdir.</span>
            <button disabled={busy || !text.trim()} className="rounded-full px-4 min-h-[36px] text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Senda</button>
          </div>
        </form>
      ) : signIn ? <SignIn me={me} onDone={() => { setSignIn(false); void whoAmI().then(setMe) }} /> : (
        <button onClick={() => setSignIn(true)} className="text-sm underline decoration-dotted underline-offset-2 w-fit">Skráðu þig inn til að skrifa athugasemd</button>
      )}
    </section>
  )
}
