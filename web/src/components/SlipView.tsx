'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Bell, BellRing, CheckCircle2, Circle, Clock, Hand, RefreshCw, Share2, XCircle } from 'lucide-react'
import type { LegStatus, SlipLeg } from '@/lib/vaktin'

type LegView = SlipLeg & { status: LegStatus; detail: string; prob: number | null }

interface Scoreboard {
  id: number
  home: string
  away: string
  flagHome: string
  flagAway: string
  date: string
  home_score: number | null
  away_score: number | null
  live: boolean
  elapsed: number | null
}

interface Status {
  title: string | null
  legs: LegView[]
  vann: number
  tapad: number
  iGangi: number
  alive: boolean
  totalProb: number | null
  scoreboard: Scoreboard[]
}

const b64ToUint8 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

const ICON: Record<LegStatus, { icon: typeof Circle; color: string; label: string }> = {
  vann: { icon: CheckCircle2, color: 'var(--win)', label: 'Í höfn' },
  tapad: { icon: XCircle, color: 'var(--loss)', label: 'Dautt' },
  i_gangi: { icon: RefreshCw, color: 'var(--accent)', label: 'Í gangi' },
  obyrjad: { icon: Clock, color: 'var(--text-2)', label: 'Ekki byrjað' },
  handvirkt: { icon: Hand, color: 'var(--ice)', label: 'Handvirkt' },
}

const fmtKickoff = (d: string) =>
  new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

const probColor = (p: number) => (p >= 0.65 ? 'var(--win)' : p >= 0.35 ? 'var(--accent)' : 'var(--loss)')

function ScoreCard({ m, reduce }: { m: Scoreboard; reduce: boolean }) {
  const played = m.home_score !== null
  return (
    <motion.div
      layout={!reduce}
      className="card px-4 py-3 flex-1 min-w-[240px]"
      style={m.live ? {
        borderColor: 'var(--accent)',
        background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent), var(--surface) 60%)',
        boxShadow: '0 0 28px -10px color-mix(in srgb, var(--accent) 60%, transparent)',
      } : undefined}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between text-[10px] muted uppercase tracking-wide mb-1.5">
        <span>{m.live ? 'Í gangi' : played ? 'Lokið' : fmtKickoff(m.date)}</span>
        {m.live && (
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: 'var(--accent)' }}>
            <span className="live-dot" aria-hidden />
            {m.elapsed != null ? `${m.elapsed}’` : 'LIVE'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-right text-sm font-bold truncate">
          {m.home} <span aria-hidden>{m.flagHome}</span>
        </span>
        <motion.span
          key={`${m.home_score}-${m.away_score}`}
          initial={reduce ? false : { scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className="stat text-3xl px-2 shrink-0"
          style={{ color: m.live ? 'var(--accent)' : 'var(--text)', textShadow: m.live ? '0 0 16px color-mix(in srgb, var(--accent) 70%, transparent)' : undefined }}
        >
          {played ? `${m.home_score}–${m.away_score}` : '–'}
        </motion.span>
        <span className="flex-1 text-sm font-bold truncate">
          <span aria-hidden>{m.flagAway}</span> {m.away}
        </span>
      </div>
    </motion.div>
  )
}

export function SlipView({ slug, initial }: { slug: string; initial: Status }) {
  const [s, setS] = useState<Status>(initial)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  const [notif, setNotif] = useState<'unsupported' | 'off' | 'on' | 'denied' | 'busy'>('unsupported')
  const reduce = useReducedMotion() ?? false

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
    const anyLive = s.scoreboard.some((m) => m.live) || s.legs.some((l) => l.status === 'i_gangi')
    const t = setInterval(load, anyLive ? 45_000 : 5 * 60_000)
    return () => clearInterval(t)
  }, [load, s.scoreboard, s.legs])

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
  const pct = s.totalProb === null ? null : Math.round(s.totalProb * 100)

  return (
    <div className="grid gap-5">
      {s.scoreboard.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.scoreboard.map((m) => (
            <ScoreCard key={m.id} m={m} reduce={reduce} />
          ))}
        </div>
      )}

      <motion.div
        className="card p-5 text-center"
        style={{
          borderColor: s.alive ? 'color-mix(in srgb, var(--accent) 45%, var(--border))' : 'var(--loss)',
          background: s.alive
            ? 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 14%, transparent) 0%, var(--surface) 55%)'
            : 'linear-gradient(160deg, color-mix(in srgb, var(--loss) 14%, transparent) 0%, var(--surface) 55%)',
          boxShadow: s.alive
            ? '0 0 42px -14px color-mix(in srgb, var(--accent) 55%, transparent)'
            : '0 0 42px -14px color-mix(in srgb, var(--loss) 55%, transparent)',
        }}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
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

        {pct !== null && s.alive && done < total && (
          <div className="mt-4 max-w-xs mx-auto">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] muted uppercase tracking-wide">Líkur á að seðillinn gangi upp</span>
              <motion.span
                key={pct}
                initial={reduce ? false : { scale: 1.25 }}
                animate={{ scale: 1 }}
                className="stat text-2xl"
                style={{ color: probColor(s.totalProb!), textShadow: `0 0 18px color-mix(in srgb, ${probColor(s.totalProb!)} 65%, transparent)` }}
              >
                {pct < 1 ? '<1' : pct}%
              </motion.span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${probColor(s.totalProb!)}, color-mix(in srgb, ${probColor(s.totalProb!)} 55%, white))`,
                  boxShadow: `0 0 14px color-mix(in srgb, ${probColor(s.totalProb!)} 80%, transparent)`,
                }}
                animate={{ width: `${Math.max(2, pct)}%` }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="text-[10px] muted mt-1">Margfeldi leggjalíkna skv. spálíkaninu · handvirk hólf ekki talin með</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
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
      </motion.div>

      <div className="grid gap-1.5">
        {s.legs.map((l, i) => {
          const c = ICON[l.status]
          const Icon = c.icon
          const legPct = l.prob === null ? null : Math.round(l.prob * 100)
          return (
            <motion.div
              key={l.id}
              className="card px-4 py-3"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { delay: 0.05 * i }}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} aria-hidden style={{ color: c.color }} className={l.status === 'i_gangi' ? 'animate-spin [animation-duration:3s]' : ''} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{l.label}</p>
                  <p className="text-xs muted">{l.detail}</p>
                </div>
                {legPct !== null && l.status !== 'vann' && l.status !== 'tapad' && (
                  <motion.span
                    key={legPct}
                    initial={reduce ? false : { scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="stat text-lg shrink-0"
                    style={{ color: probColor(l.prob!), textShadow: `0 0 12px color-mix(in srgb, ${probColor(l.prob!)} 60%, transparent)` }}
                  >
                    {legPct < 1 ? '<1' : legPct}%
                  </motion.span>
                )}
                <span className="pill shrink-0 font-bold" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.color} 35%, transparent)` }}>{c.label}</span>
                {(l.market === 'handvirkt' || (l.market === 'markaskorari' && (l.status === 'handvirkt' || l.status === 'i_gangi' || l.manualDone))) && (
                  <button onClick={() => toggle(l)} className="text-xs font-bold px-3 py-1.5 rounded-lg border shrink-0" style={{ borderColor: 'var(--border)', color: l.manualDone ? 'var(--win)' : 'var(--text-2)' }}>
                    {l.manualDone ? '✓ merkt' : 'merkja ✓'}
                  </button>
                )}
              </div>
              {legPct !== null && l.status !== 'vann' && l.status !== 'tapad' && (
                <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--surface-2)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${probColor(l.prob!)}, color-mix(in srgb, ${probColor(l.prob!)} 55%, white))`,
                      boxShadow: `0 0 10px color-mix(in srgb, ${probColor(l.prob!)} 70%, transparent)`,
                    }}
                    animate={{ width: `${Math.max(2, legPct)}%` }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      <p className="text-[11px] muted">
        Staðan, markaskorarar og líkur uppfærast sjálfkrafa í rauntíma meðan leikir eru í gangi {updated ? `· síðast ${updated.toLocaleTimeString('is-IS')}` : ''} · Líkurnar eru Poisson-mat spálíkansins, ekki stuðlar · Handvirku hólfin (horn o.þ.h.) tikkarðu sjálf/ur · 18 ára aldurstakmark — spilaðu ábyrgt
      </p>
    </div>
  )
}
