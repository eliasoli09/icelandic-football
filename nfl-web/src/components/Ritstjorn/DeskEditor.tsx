'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardCopy, ClipboardPaste, Eye, Send, Trash2, Undo2 } from 'lucide-react'
import { Markdown } from '@/lib/nfl/articles/markdown'
import { slugify } from '@/lib/nfl/articles/slots'
import { buildArticlePrompt, checkArticle, parseArticleReply } from '@/lib/nfl/articles/writer'
import { deleteArticle, getArticle, saveArticle, type Article } from '@/lib/nfl/articles/editorStore'
import { DeskGate, KIND_LABEL } from './DeskList'

const field = 'w-full rounded-lg border px-3 py-2'
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--surface)' }

export function DeskEditor({ id }: { id: string }) {
  return <DeskGate>{() => <Editor id={id} />}</DeskGate>
}

function Editor({ id }: { id: string }) {
  const router = useRouter()
  const [a, setA] = useState<Article | null>(null)
  const [title, setTitle] = useState('')
  const [lede, setLede] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const x = await getArticle(id)
    setA(x)
    if (x) { setTitle(x.title); setLede(x.lede); setBody(x.body) }
  }
  useEffect(() => { void load().catch((e) => setNote({ good: false, text: e.message })) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const machine = !!(a && a.kind !== 'grein' && a.facts)
  const problems = useMemo(() => (machine && a ? checkArticle({ title, lede, body }, a.facts) : []), [machine, a, title, lede, body])
  const dirty = !!a && (title !== a.title || lede !== a.lede || body !== a.body)

  if (!a) return <p className="muted">{note?.text ?? 'Sæki ...'}</p>

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setNote(null)
    try { await fn(); await load(); setNote({ good: true, text: ok }) } catch (e) { setNote({ good: false, text: (e as Error).message }) }
    setBusy(false)
  }
  const save = () => run(() => saveArticle(a.id, { title, lede, body }), 'Vistað.')
  const publish = () => {
    if (!title.trim() || !body.trim()) { setNote({ good: false, text: 'Fyrirsögn og meginmál þurfa að vera komin.' }); return }
    if (problems.length && !window.confirm(`Staðreyndavörnin kvartar:\n\n${problems.join('\n')}\n\nBirta samt?`)) return
    // a free article gets its address from the headline when first published
    const slug = a.kind === 'grein' && a.slug.startsWith('grein-') ? `${slugify(title)}-${a.id.slice(0, 4)}` : undefined
    return run(() => saveArticle(a.id, { title, lede, body, status: 'published', published_at: a.published_at ?? new Date().toISOString(), ...(slug ? { slug } : {}) }), 'Birt.')
  }
  const paste = () => {
    try {
      const t = parseArticleReply(reply)
      setTitle(t.title); setLede(t.lede); setBody(t.body); setReply('')
      const p = machine ? checkArticle(t, a.facts) : []
      setNote(p.length ? { good: false, text: `Svarið er komið inn, en: ${p.join('; ')}` } : { good: true, text: 'Svarið er komið inn. Lestu yfir og vistaðu.' })
    } catch (e) { setNote({ good: false, text: (e as Error).message }) }
  }

  return (
    <div className="grid gap-5">
      <Link href="/ritstjorn" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Öll drög</Link>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-2xl font-extrabold">{KIND_LABEL[a.kind]}{a.week ? ` · vika ${a.week}` : ''}</h1>
        <span className="text-xs muted">
          {a.status === 'published' ? <Link className="underline" href={`/grein/${a.slug}`}>Birt: /nfl/grein/{a.slug}</Link> : 'Drög'}
          {a.model && !a.edited ? ` · vélartexti (${a.model})` : ''}
        </span>
      </header>

      {note && <p className="text-sm font-semibold" role="status" style={{ color: note.good ? 'var(--win)' : 'var(--loss)' }}>{note.text}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid gap-3 content-start">
          <label className="grid gap-1 text-sm"><span className="font-semibold">Fyrirsögn</span>
            <input className={field} style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} /></label>
          <label className="grid gap-1 text-sm"><span className="font-semibold">Inngangur</span>
            <textarea className={field} style={fieldStyle} rows={2} value={lede} onChange={(e) => setLede(e.target.value)} /></label>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Meginmál <span className="muted font-normal">(## millifyrirsögn, - listi, **feitt**)</span></span>
            <button className="inline-flex items-center gap-1 muted" onClick={() => setPreview((p) => !p)}><Eye size={14} aria-hidden /> {preview ? 'Ritill' : 'Forskoða'}</button>
          </div>
          {preview
            ? <div className="card p-4"><h2 className="display text-2xl font-extrabold mb-2">{title}</h2><p className="font-semibold mb-4">{lede}</p><Markdown text={body} /></div>
            : <textarea className={`${field} font-mono text-sm`} style={fieldStyle} rows={18} value={body} onChange={(e) => setBody(e.target.value)} />}
          {machine && problems.length > 0 && <p className="text-xs" style={{ color: 'var(--loss)' }}>Staðreyndavörn: {problems.join('; ')}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || !dirty} onClick={save} className="rounded-full border px-4 min-h-[40px] font-semibold disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Vista</button>
            {a.status === 'draft'
              ? <button disabled={busy} onClick={publish} className="rounded-full px-4 min-h-[40px] font-semibold inline-flex items-center gap-2" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><Send size={15} aria-hidden /> Birta</button>
              : <button disabled={busy} onClick={() => run(() => saveArticle(a.id, { status: 'draft' }), 'Tekin úr birtingu.')} className="rounded-full border px-4 min-h-[40px] font-semibold inline-flex items-center gap-2" style={{ borderColor: 'var(--border)' }}><Undo2 size={15} aria-hidden /> Taka úr birtingu</button>}
            {a.status === 'draft' && (
              <button disabled={busy} className="rounded-full px-3 min-h-[40px] text-sm muted inline-flex items-center gap-1.5 ml-auto"
                onClick={async () => { if (window.confirm('Eyða þessum drögum? Þetta er ekki hægt að afturkalla.')) { await deleteArticle(a.id).catch((e) => setNote({ good: false, text: e.message })); router.push('/ritstjorn') } }}>
                <Trash2 size={14} aria-hidden /> Eyða drögum
              </button>
            )}
          </div>
        </div>

        {machine && (
          <aside className="grid gap-3 content-start">
            <div className="card p-4 grid gap-2">
              <h2 className="font-semibold">Skrifa í ChatGPT</h2>
              <p className="text-xs muted">Afritaðu promptinn, límdu hann í ChatGPT og límdu svarið hér fyrir neðan.</p>
              <button className="rounded-full border px-3 min-h-[36px] text-sm font-semibold inline-flex items-center gap-1.5 w-fit" style={{ borderColor: 'var(--border)' }}
                onClick={async () => { try { await navigator.clipboard.writeText(buildArticlePrompt(a.kind as Exclude<Article['kind'], 'grein'>, a.facts)); setNote({ good: true, text: 'Prompturinn er á klippiborðinu.' }) } catch { setNote({ good: false, text: 'Tókst ekki að afrita.' }) } }}>
                <ClipboardCopy size={14} aria-hidden /> Afrita prompt
              </button>
              <textarea className={`${field} text-xs font-mono`} style={fieldStyle} rows={5} placeholder="Límdu svarið frá ChatGPT hér" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button disabled={!reply.trim()} onClick={paste} className="rounded-full border px-3 min-h-[36px] text-sm font-semibold inline-flex items-center gap-1.5 w-fit disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>
                <ClipboardPaste size={14} aria-hidden /> Setja svarið inn
              </button>
            </div>
            <details className="card p-4">
              <summary className="font-semibold cursor-pointer">Staðreyndapakkinn</summary>
              <pre className="text-[11px] mt-3 overflow-auto max-h-[28rem] whitespace-pre-wrap">{JSON.stringify(a.facts, null, 2)}</pre>
            </details>
          </aside>
        )}
      </div>
    </div>
  )
}
