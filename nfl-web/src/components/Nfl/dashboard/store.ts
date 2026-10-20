'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { browserDb, whoAmI } from '@/lib/leaderboard/store'
import type { RosterPlayer, Scoring, TrackedSlip } from '@/lib/nfl/tracker'

export type WidgetKind = 'live' | 'wp' | 'redzone' | 'feed' | 'fantasy' | 'bets' | 'highlights' | 'myteam' | 'tv' | 'pickem' | 'countdown'
export interface Widget { id: string; kind: WidgetKind; wide: boolean }

export interface Board {
  v: 1
  widgets: Widget[]
  fantasy: { scoring: Scoring; roster: RosterPlayer[] }
  bets: TrackedSlip[]
  /** When this copy changed, to settle the device against the account. */
  updated: string
}

export const WIDGET_INFO: Record<WidgetKind, { title: string; blurb: string }> = {
  live: { title: 'Leikir í beinni', blurb: 'Staða, klukka og sigurlíkur í hverjum leik' },
  wp: { title: 'Sigurlíkur', blurb: 'Hvernig líkurnar sveiflast í hverjum leik, mest spennandi efst' },
  redzone: { title: 'Rauða svæðið', blurb: 'Ferðir á rauða svæðið og jöfnustu leikirnir undir lokin' },
  feed: { title: 'Stigaveitan', blurb: 'Öll snertimörk og vallarmörk úr öllum leikjum' },
  fantasy: { title: 'Fantasy-liðið mitt', blurb: 'Stigin þín í rauntíma' },
  bets: { title: 'Seðlarnir mínir', blurb: 'Hvernig hver leggur stendur' },
  highlights: { title: 'Hápunktar', blurb: 'Nýjustu myndböndin frá NFL' },
  myteam: { title: 'Liðið mitt', blurb: 'Næsti leikur, síðasti leikur og fréttir' },
  tv: { title: 'Í sjónvarpinu', blurb: 'Hvað er sýnt núna og næst' },
  pickem: { title: 'Spáleikurinn', blurb: 'Hvernig tippin þín standa í umferðinni' },
  countdown: { title: 'Niðurtalning', blurb: 'Í næsta leik' },
}
export const KINDS = Object.keys(WIDGET_INFO) as WidgetKind[]

const KEY = 'nfl:stjornbord'
const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => new Date().toISOString()

export const DEFAULT_BOARD = (): Board => ({
  v: 1,
  widgets: (['live', 'wp', 'fantasy', 'redzone', 'bets', 'feed', 'highlights', 'tv', 'countdown'] as WidgetKind[]).map((kind) => ({ id: uid(), kind, wide: kind === 'live' || kind === 'wp' || kind === 'highlights' })),
  fantasy: { scoring: 'ppr', roster: [] },
  bets: [],
  updated: new Date(0).toISOString(),
})

const valid = (b: unknown): b is Board => !!b && typeof b === 'object' && (b as Board).v === 1 && Array.isArray((b as Board).widgets)
function readLocal(): Board | null {
  try { const b = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return valid(b) ? b : null } catch { return null }
}
function writeLocal(b: Board) { try { localStorage.setItem(KEY, JSON.stringify(b)) } catch { /* this device forgets */ } }

const QUEUE = 'nfl:stjornbord:nyir'

/**
 * Add a slip from another page (Veðmálin). It waits in a queue rather than in
 * this device's board, so a stale board on this device can never win over the
 * account's newer one just because a slip was added; the board takes the queue
 * in when it opens, whichever copy wins.
 */
export function trackSlip(slip: Omit<TrackedSlip, 'id' | 'created'>): void {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE) ?? '[]') as TrackedSlip[]
    localStorage.setItem(QUEUE, JSON.stringify([...q, { ...slip, id: uid(), created: now() }].slice(-30)))
  } catch { /* this device forgets */ }
}
function takeQueue(): TrackedSlip[] {
  try { const q = JSON.parse(localStorage.getItem(QUEUE) ?? '[]'); localStorage.removeItem(QUEUE); return Array.isArray(q) ? q : [] } catch { return [] }
}
/** The queued slips on top of a board, and a bets widget if it has none. */
function withQueued(b: Board, q: TrackedSlip[]): Board {
  if (!q.length) return b
  const widgets = b.widgets.some((w) => w.kind === 'bets') ? b.widgets : [{ id: uid(), kind: 'bets' as const, wide: false }, ...b.widgets]
  return { ...b, widgets, bets: [...[...q].reverse(), ...b.bets].slice(0, 30), updated: now() }
}

/**
 * The board: this device's copy at once, then the account's if it is newer.
 * Every change is written here straight away and to the account a moment later.
 */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const queued = takeQueue()
    const saved = readLocal() ?? DEFAULT_BOARD()
    // shown at once with the queue in, but compared with the account as it was before the queue
    const local = withQueued(saved, queued)
    setBoard(local)
    writeLocal(local)
    void (async () => {
      const who = await whoAmI().catch(() => null)
      if (!who) return
      setMe(who.id)
      const { data } = await browserDb().from('nfl_dashboard').select('layout, fantasy, bets, updated_at').eq('user_id', who.id).maybeSingle()
      const remote: Board | null = data ? { v: 1, widgets: data.layout as Widget[], fantasy: data.fantasy as Board['fantasy'], bets: data.bets as TrackedSlip[], updated: data.updated_at } : null
      if (remote && valid(remote) && remote.fantasy?.roster && new Date(remote.updated) > new Date(saved.updated)) {
        const next = withQueued(remote, queued)
        setBoard(next); writeLocal(next)
        if (queued.length) await save(who.id, next)
      } else if (!remote || new Date(remote.updated).getTime() !== new Date(local.updated).getTime()) {
        await save(who.id, local)
      }
    })()
  }, [])

  const update = useCallback((change: (b: Board) => Board) => {
    setBoard((prev) => {
      if (!prev) return prev
      const next = { ...change(prev), updated: now() }
      writeLocal(next)
      if (me) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void save(me, next), 1500)
      }
      return next
    })
  }, [me])

  return { board, update, signedIn: !!me }
}

async function save(userId: string, b: Board) {
  await browserDb().from('nfl_dashboard').upsert({ user_id: userId, layout: b.widgets, fantasy: b.fantasy, bets: b.bets, updated_at: b.updated })
}

export const newWidget = (kind: WidgetKind): Widget => ({ id: uid(), kind, wide: false })
export const newId = uid
