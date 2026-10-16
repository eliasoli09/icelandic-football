'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FilePlus2, Newspaper } from 'lucide-react'
import { SignIn } from '@/components/Leaderboard/SignIn'
import { listArticles, newArticle, type Article } from '@/lib/nfl/articles/editorStore'
import { useEditor } from './useEditor'

export const KIND_LABEL: Record<Article['kind'], string> = { upphitun: 'Upphitun', umfjollun: 'Umfjöllun', vikan: 'Vikan í hnotskurn', grein: 'Grein' }

const stamp = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}. kl. ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }

export function DeskGate({ children }: { children: (me: NonNullable<ReturnType<typeof useEditor>['me']>) => React.ReactNode }) {
  const { ready, me, editor } = useEditor()
  if (!ready) return <p className="muted">Augnablik ...</p>
  if (!me?.name) return <div className="grid gap-4 max-w-xl"><h1 className="display text-3xl font-extrabold">Ritstjórn</h1><SignIn me={me} onDone={() => {}} /></div>
  if (!editor) return <div className="grid gap-2 max-w-xl"><h1 className="display text-3xl font-extrabold">Ritstjórn</h1><p className="muted">Þú ert skráð(ur) inn sem {me.name}, en ert ekki ritstjóri. Biddu ritstjóra um aðgang.</p></div>
  return <>{children(me)}</>
}

export function DeskList() {
  return <DeskGate>{(me) => <Desk me={me} />}</DeskGate>
}

function Desk({ me }: { me: { id: string; name: string | null } }) {
  const router = useRouter()
  const [rows, setRows] = useState<Article[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState<'draft' | 'published'>('draft')
  useEffect(() => { listArticles().then(setRows).catch((e) => setError(e.message)) }, [])
  const list = (rows ?? []).filter((r) => r.status === show)
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><Newspaper size={13} aria-hidden /> RITSTJÓRN</p>
          <h1 className="display text-3xl font-extrabold">NFL-greinar</h1>
        </div>
        <button className="rounded-full px-4 min-h-[40px] font-semibold inline-flex items-center gap-2" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          onClick={async () => { try { router.push(`/ritstjorn/${await newArticle(me.id)}`) } catch (e) { setError((e as Error).message) } }}>
          <FilePlus2 size={16} aria-hidden /> Ný grein
        </button>
      </header>
      <div className="inline-flex w-fit rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)' }}>
        {(['draft', 'published'] as const).map((s) => (
          <button key={s} aria-pressed={show === s} onClick={() => setShow(s)} className="rounded-full px-4 min-h-[36px] font-semibold"
            style={{ background: show === s ? 'var(--accent)' : 'transparent', color: show === s ? 'var(--accent-ink)' : 'var(--text-2)' }}>
            {s === 'draft' ? 'Drög' : 'Birtar'} ({(rows ?? []).filter((r) => r.status === s).length})
          </button>
        ))}
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--loss)' }}>{error}</p>}
      {rows === null ? <p className="muted">Sæki ...</p> : list.length === 0 ? <p className="muted">Ekkert hér.</p> : (
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/ritstjorn/${a.id}`} className="trow flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-[11px] font-bold tracking-wide muted w-28 shrink-0">{KIND_LABEL[a.kind].toUpperCase()}</span>
                <span className="font-semibold min-w-0 flex-1">{a.title || <span className="muted font-normal">{a.slug} · bíður texta</span>}</span>
                <span className="text-xs muted">{a.body ? (a.edited ? 'yfirlesið' : `vélartexti${a.model ? ` (${a.model})` : ''}`) : 'enginn texti'} · {stamp(a.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
