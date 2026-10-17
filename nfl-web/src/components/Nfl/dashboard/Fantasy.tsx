'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Plus, Search, X } from 'lucide-react'
import { browserDb } from '@/lib/leaderboard/store'
import { STATUS_LABEL, type InjuryStatus } from '@/lib/nfl/injuries'
import { franchiseOf } from '@/lib/nfl/elo'
import { SCORING_LABEL, defencePoints, findLive, isDefence, playerPoints, type RosterPlayer, type Scoring } from '@/lib/nfl/tracker'
import { PlayerHead } from '../PlayerHead'
import { NflLogo } from '../NflLogo'
import type { Board } from './store'
import { Empty, when, type Ctx } from './Simple'

interface Info {
  player_id: string; position: string | null; headshot?: string | null; games: number
  avg: Record<Scoring, number> | null; injury: InjuryStatus | null
  next: { game_id: string; kickoff: string; home: boolean; opp: string } | null
}
const dec1 = (x: number) => x.toFixed(1).replace('.', ',')
const MAX = 20

/** The reader's fantasy team: live points from the game stats, our projection for those yet to play. */
export function Fantasy({ ctx, board, update }: { ctx: Ctx; board: Board; update: (f: (b: Board) => Board) => void }) {
  const { roster, scoring } = board.fantasy
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [adding, setAdding] = useState(false)
  const ids = roster.map((r) => r.player_id).join(',')

  useEffect(() => {
    if (!ids) return
    let alive = true
    const load = () => fetch(`/api/nfl/fantasy/lid?ids=${encodeURIComponent(ids)}`).then((r) => r.json()).then((d) => { if (alive) setInfo(d.players ?? {}) }).catch(() => null)
    void load()
    const t = setInterval(load, 10 * 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [ids])

  const setRoster = (f: (r: RosterPlayer[]) => RosterPlayer[]) => update((b) => ({ ...b, fantasy: { ...b.fantasy, roster: f(b.fantasy.roster).slice(0, MAX) } }))
  const liveGames = ctx.live?.games ?? []
  const statsFor = (team: string) => ctx.stats?.games.find((g) => g.teams.some((t) => franchiseOf(t.team) === franchiseOf(team)) || g.players.some((p) => franchiseOf(p.team) === franchiseOf(team)))
  const gameFor = (team: string) => liveGames.find((g) => franchiseOf(g.home) === franchiseOf(team) || franchiseOf(g.away) === franchiseOf(team))

  const rows = roster.map((r) => {
    const i = info[r.player_id]
    const g = gameFor(r.team)
    const s = statsFor(r.team)
    let pts: number | null = null
    if (s) {
      if (isDefence(r)) { const t = s.teams.find((x) => franchiseOf(x.team) === franchiseOf(r.team)); pts = t ? defencePoints(t) : null }
      else { const l = findLive(r, s.players); pts = l ? playerPoints(l, scoring) : g && (g.live || g.final) ? 0 : null }
    }
    const projected = i?.avg ? i.avg[scoring] : null
    const state = g?.final ? 'Lokið' : g?.live ? `${g.statusLabel}${g.clock ? ` ${g.clock}` : ''}` : i?.next ? when(i.next.kickoff) : ''
    return { r, i, g, pts, projected, state, playing: !!g && (g.live || g.final) }
  })
  const starters = rows.filter((x) => !x.r.bench)
  const total = starters.reduce((t, x) => t + (x.pts ?? 0), 0)
  const expected = starters.reduce((t, x) => t + (x.playing ? (x.pts ?? 0) : (x.projected ?? 0)), 0)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Stigagjöf" value={scoring} onChange={(e) => update((b) => ({ ...b, fantasy: { ...b.fantasy, scoring: e.target.value as Scoring } }))}
          className="rounded-lg border px-2 min-h-[34px] text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          {(Object.keys(SCORING_LABEL) as Scoring[]).map((s) => <option key={s} value={s}>{SCORING_LABEL[s]}</option>)}
        </select>
        <button onClick={() => setAdding(!adding)} className="rounded-full border px-3 min-h-[34px] text-sm inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}><Plus size={14} aria-hidden /> Leikmenn</button>
        {roster.length > 0 && <span className="ml-auto text-right"><span className="block num font-extrabold text-2xl leading-none" style={{ color: 'var(--accent)' }}>{dec1(total)}</span><span className="text-[11px] muted">spáð alls {dec1(expected)}</span></span>}
      </div>
      {adding && <AddPlayers onAdd={(p) => setRoster((r) => r.some((x) => x.player_id === p.player_id) ? r : [...r, p])} onReplace={(list) => setRoster(() => list)} />}
      {!roster.length ? <Empty>Bættu leikmönnunum þínum við, eða lestu skjáskot af liðinu úr hvaða fantasy-appi sem er.</Empty> : (
        <ul className="grid gap-1">
          {[...rows].sort((a, b) => Number(!!a.r.bench) - Number(!!b.r.bench)).map(({ r, i, pts, projected, state, playing }) => (
            <li key={r.player_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 py-1" style={{ opacity: r.bench ? 0.6 : 1 }}>
              {isDefence(r) ? <NflLogo team={ctx.teams.get(r.team)} size={30} /> : <PlayerHead name={r.name} src={r.headshot ?? i?.headshot ?? null} color={ctx.teams.get(r.team)?.color} size={30} />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{r.name}{i?.injury && <span className="ml-1.5 rounded px-1 text-[10px] font-bold align-middle" style={{ background: 'color-mix(in srgb, var(--loss) 18%, transparent)', color: 'var(--loss)' }}>{STATUS_LABEL[i.injury].toUpperCase()}</span>}</span>
                <span className="block text-[11px] muted truncate">{r.bench ? 'Bekkur · ' : ''}{r.position ?? i?.position ?? ''} · {r.team}{i?.next ? ` ${i.next.home ? 'gegn' : '@'} ${i.next.opp}` : ''}{state ? ` · ${state}` : ''}</span>
              </span>
              <span className="text-right">
                {playing ? <span className="num font-bold">{dec1(pts ?? 0)}</span> : <span className="num muted text-sm" title="Meðalstig í leik á tímabilinu">{projected !== null ? `${dec1(projected)} spá` : '-'}</span>}
              </span>
              <button onClick={() => setRoster((list) => list.filter((x) => x.player_id !== r.player_id))} aria-label={`Fjarlægja ${r.name}`} className="muted p-1"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] muted">Stig í beinni úr tölfræði leiksins (uppfærist á 1-2 mínútna fresti). Spáin er meðalstig leikmannsins í leik á tímabilinu. Sparkarar og varnir fá stig í beinni en enga spá.</p>
    </div>
  )
}

interface Found { player_id: string; name: string; team: string; position: string | null; headshot: string | null }

function AddPlayers({ onAdd, onReplace }: { onAdd: (p: RosterPlayer) => void; onReplace: (list: RosterPlayer[]) => void }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [shot, setShot] = useState<{ busy: boolean; note: string | null; picked?: { shown: { name: string; bench: boolean }; player: Found | null }[] }>({ busy: false, note: null })
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => void fetch(`/api/nfl/leikmenn/leit?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setFound(d.players ?? [])).catch(() => null), 250)
    return () => clearTimeout(t)
  }, [q])

  const read = async (f: File) => {
    setShot({ busy: true, note: null })
    const { data } = await browserDb().auth.getSession()
    const token = data.session?.access_token
    if (!token) { setShot({ busy: false, note: 'Skráðu þig inn til að lesa skjáskot (t.d. í Spáleiknum).' }); return }
    const image = await shrink(f)
    const res = await fetch('/api/nfl/fantasy/skjaskot', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ image, media_type: 'image/jpeg' }) })
    const body = await res.json().catch(() => ({ error: 'Lesturinn brást.' }))
    if (!res.ok) { setShot({ busy: false, note: body.error ?? 'Lesturinn brást.' }); return }
    const missing = (body.players as { player: Found | null }[]).filter((p) => !p.player).length
    setShot({ busy: false, note: `${body.players.length} leikmenn lesnir${missing ? `, ${missing} fundust ekki: bættu þeim við með leitinni` : ''}.${body.notes ? ` ${body.notes}` : ''}`, picked: body.players })
  }

  return (
    <div className="rounded-xl border p-3 grid gap-2" style={{ borderColor: 'var(--border)' }}>
      <label className="flex items-center gap-2 rounded-lg border px-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <Search size={14} aria-hidden className="muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að leikmanni eða vörn" aria-label="Leita að leikmanni" className="bg-transparent min-h-[36px] text-sm flex-1 outline-none" />
      </label>
      {found.length > 0 && (
        <ul className="grid gap-1 max-h-56 overflow-y-auto">
          {found.map((p) => (
            <li key={p.player_id}><button onClick={() => { onAdd({ player_id: p.player_id, name: p.name.replace(/ \(vörn\)$/, ' D/ST'), team: p.team, position: p.position, headshot: p.headshot }); setQ('') }} className="w-full text-left text-sm flex items-center gap-2 px-1 py-1 rounded trow">
              <Plus size={13} aria-hidden /> <span className="font-medium">{p.name}</span> <span className="text-xs muted">{p.position} · {p.team}</span>
            </button></li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = '' }} />
        <button disabled={shot.busy} onClick={() => file.current?.click()} className="rounded-full border px-3 min-h-[34px] text-sm inline-flex items-center gap-1.5 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <Camera size={14} aria-hidden /> {shot.busy ? 'Les skjáskotið...' : 'Lesa skjáskot af liðinu'}
        </button>
        <span className="text-[11px] muted">NFL Fantasy, ESPN, Yahoo, Sleeper. 10 á dag.</span>
      </div>
      {shot.note && <p className="text-xs" role="status">{shot.note}</p>}
      {shot.picked && shot.picked.some((p) => p.player) && (
        <button onClick={() => { onReplace(shot.picked!.filter((p) => p.player).map((p) => ({ ...p.player!, name: p.player!.name.replace(/ \(vörn\)$/, ' D/ST'), bench: p.shown.bench }))); setShot({ busy: false, note: 'Liðinu skipt út.' }) }}
          className="rounded-full px-4 min-h-[36px] text-sm font-semibold w-fit" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
          Nota þetta lið ({shot.picked.filter((p) => p.player).length} leikmenn)
        </button>
      )}
    </div>
  )
}

/** A phone screenshot down to 1600 px on the long side as JPEG: well under the reader's limit, plenty to read names. */
async function shrink(f: File): Promise<string> {
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url })
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}
