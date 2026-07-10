'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, CheckCircle2, Circle, Clock, Hand, RefreshCw, Share2, XCircle } from 'lucide-react'
import type { LegStatus, SlipLeg } from '@/lib/vaktin'

const b64ToUint8 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type LegView = SlipLeg & { status: LegStatus; detail: string }

interface Status {
  title: string | null
  legs: LegView[]
  vann: number
  tapad: number
  iGangi: number
  alive: boolean
}

const ICON: Record<LegStatus, { icon: typeof Circle; color: string; label: string }> = {
  vann: { icon: CheckCircle2, color: 'var(--win)', label: 'Í höfn' },
  tapad: { icon: XCircle, color: 'var(--loss)', label: 'Dautt' },
  i_gangi: { icon: RefreshCw, color: 'var(--accent)', label: 'Í gangi' },
  obyrjad: { icon: Clock, color: 'var(--text-2)', label: 'Óbyrjað' },
  handvirkt: { icon: Hand, color: 'var(--ice)', label: 'Handvirkt' },
}

export function SlipView({ slug, initial }: { slug: string; initial: Status }) {
  const [s, setS] = useState<Status>(initial)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  const [notif, setNotif] = useState<'unsupported' | 'off' | 'on' | 'denied' | 'busy'>('unsupported')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'denied') return setNotif('denied')
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setNotif(sub ? 'on' : 'off')
    }).catch(() => setNotif('off'))
  }, [])

  const enableNotif = async () => {
    setNotif('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setNotif(perm === 'denied' ? 'denied' : 'off')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const res = await fetch(`/api/vaktin/${slug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setNotif(res.ok ? 'on' : 'off')
    } catch {
      setNotif('off')
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vaktin/${slug}`, { cache: 'no-store' })
      const d = await res.json()
      if (d.ok) {
        setS(d)
        setUpdated(new Date())
      }
    } catch {
      // next poll retries
    }
  }, [slug])

  useEffect(() => {
    const anyLive = s.legs.some((l) => l.status === 'i_gangi')
    const t = setInterval(load, anyLive ? 60_000 : 5 * 60_000)
    return () => clearInterval(t)
  }, [load, s.legs])

  const toggle = async (leg: LegView) => {
    await fetch(`/api/vaktin/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legId: leg.id, done: !leg.manualDone }),
    })
    load()
  }

  const share = async () => {
    const url = `${location.origin}/vaktin/${slug}`
    try {
      if (navigator.share) await navigator.share({ title: s.title ?? 'Seðillinn minn', url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled */ }
  }

  const done = s.vann
  const total = s.legs.length

  return (
    <div className="grid gap-5">
      <div className="card p-5 text-center" style={{ borderColor: s.alive ? 'var(--border)' : 'var(--loss)' }}>
        <p className="text-xs muted uppercase tracking-wide mb-1">Seðlavaktin</p>
        <h1 className="display text-2xl font-black mb-2">{s.title ?? 'Seðillinn minn'}</h1>
        <p className="stat text-4xl mb-1" style={{ color: s.alive ? 'var(--accent)' : 'var(--loss)' }}>
          {done}/{total}
        </p>
        <p className="text-sm muted">
          {s.alive
            ? s.tapad === 0 && done === total
              ? '🎉 Allir leggir í höfn — seðillinn vann!'
              : `${total - done} ${total - done === 1 ? 'leggur' : 'leggir'} eftir — seðillinn lifir`
            : `Seðillinn datt — ${s.tapad} ${s.tapad === 1 ? 'leggur tapaðist' : 'leggir töpuðust'}`}
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={share} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <Share2 size={13} aria-hidden /> {copied ? 'Afritað!' : 'Deila seðli'}
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <RefreshCw size={13} aria-hidden /> Uppfæra núna
          </button>
          {(notif === 'off' || notif === 'busy') && (
            <button onClick={enableNotif} disabled={notif === 'busy'} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: notif === 'busy' ? 0.6 : 1 }}>
              <Bell size={13} aria-hidden /> Kveikja á tilkynningum
            </button>
          )}
          {notif === 'on' && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border" style={{ borderColor: 'var(--win)', color: 'var(--win)' }}>
              <BellRing size={13} aria-hidden /> Tilkynningar virkar
            </span>
          )}
        </div>
        {notif === 'denied' && (
          <p className="text-[11px] muted mt-2">Tilkynningum var hafnað — kveiktu á þeim í stillingum vafrans/símans.</p>
        )}
        {notif === 'unsupported' && (
          <p className="text-[11px] muted mt-2">📲 Á iPhone: Deila → „Add to Home Screen" — þá er hægt að kveikja á tilkynningum þegar seðillinn er opnaður þaðan.</p>
        )}
      </div>

      <div className="grid gap-1.5">
        {s.legs.map((l) => {
          const c = ICON[l.status]
          const Icon = c.icon
          return (
            <div key={l.id} className="card px-4 py-3 flex items-center gap-3">
              <Icon size={20} aria-hidden style={{ color: c.color }} className={l.status === 'i_gangi' ? 'animate-spin [animation-duration:3s]' : ''} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{l.label}</p>
                <p className="text-xs muted">{l.detail}</p>
              </div>
              <span className="pill pill-flat shrink-0" style={{ color: c.color }}>{c.label}</span>
              {(l.market === 'handvirkt' || (l.market === 'markaskorari' && (l.status === 'handvirkt' || l.status === 'i_gangi' || l.manualDone))) && (
                <button onClick={() => toggle(l)} className="text-xs font-bold px-3 py-1.5 rounded-lg border shrink-0" style={{ borderColor: 'var(--border)', color: l.manualDone ? 'var(--win)' : 'var(--text-2)' }}>
                  {l.manualDone ? '✓ merkt' : 'merkja ✓'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] muted">
        Staðan og markaskorarar uppfærast sjálfkrafa í rauntíma meðan leikir eru í gangi {updated ? `· síðast ${updated.toLocaleTimeString('is-IS')}` : ''} · Handvirku hólfin (horn o.þ.h.) tikkarðu sjálf/ur · 18 ára aldurstakmark — spilaðu ábyrgt
      </p>
    </div>
  )
}
