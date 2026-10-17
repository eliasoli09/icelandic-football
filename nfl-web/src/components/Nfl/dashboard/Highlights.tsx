'use client'

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { forClubs, type Video } from '@/lib/nfl/highlights'
import type { Board } from './store'
import { Empty, type Ctx } from './Simple'

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 60 ? `fyrir ${m} mín.` : m < 1440 ? `fyrir ${Math.round(m / 60)} klst.` : `fyrir ${Math.round(m / 1440)} d.`
}

/** The newest NFL videos, played here; "Mín lið" keeps those naming the reader's clubs. */
export function Highlights({ ctx, board }: { ctx: Ctx; board: Board }) {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [mine, setMine] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  useEffect(() => {
    const load = () => fetch('/api/nfl/hapunktar').then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => setVideos([]))
    void load()
    const t = setInterval(load, 10 * 60_000)
    return () => clearInterval(t)
  }, [])

  // the reader's clubs: the fantasy team's, the slips', and "Liðið mitt"
  let fav: string | null = null
  try { fav = localStorage.getItem('nfl:lid') } catch { /* none */ }
  const clubs = [...new Set([...board.fantasy.roster.map((r) => r.team), ...board.bets.flatMap((s) => s.legs.map((l) => l.team)), ...(fav ? [fav] : [])])]
  const nicknames = clubs.map((c) => ctx.teams.get(c)?.name.split(' ').at(-1)).filter((n): n is string => !!n)
  if (videos === null) return null
  const list = (mine ? forClubs(videos, nicknames) : videos).slice(0, 9)

  return (
    <div className="grid gap-3">
      {nicknames.length > 0 && (
        <div className="flex gap-1.5 text-sm">
          {([[false, 'Öll'], [true, 'Mín lið']] as const).map(([v, l]) => (
            <button key={l} onClick={() => setMine(v)} aria-pressed={mine === v} className="rounded-full px-3 min-h-[32px] border" style={{ borderColor: mine === v ? 'var(--accent)' : 'var(--border)' }}>{l}</button>
          ))}
        </div>
      )}
      {playing && (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: '16 / 9', background: '#000' }}>
          <iframe src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1&rel=0`} title="Myndband" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
        </div>
      )}
      {!list.length ? <Empty>{mine ? 'Engin ný myndbönd um þín lið. Sýndu öll.' : 'Engin myndbönd fundust.'}</Empty> : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {list.map((v) => (
            <li key={v.id}>
              <button onClick={() => setPlaying(v.id)} className="text-left grid gap-1.5 w-full group">
                <span className="relative block overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
                  <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100"><span className="rounded-full p-2" style={{ background: 'rgba(0,0,0,.6)' }}><Play size={16} color="#fff" aria-hidden /></span></span>
                </span>
                <span className="text-xs font-medium leading-snug line-clamp-2">{v.title}</span>
                <span className="text-[11px] muted">{ago(v.published)}{v.short ? ' · stutt' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] muted">Af opinberri YouTube-rás NFL.</p>
    </div>
  )
}
