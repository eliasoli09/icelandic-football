'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, Lightbulb, Share2, Shuffle, CalendarDays, Check, X } from 'lucide-react'
import { LISTS } from '@/lib/topp10/lists'
import { dailyList, dayNumber } from '@/lib/topp10/daily'
import { guess, hint, hintFor, newGame, LIVES, type GameState, type Outcome } from '@/lib/topp10/game'
import { shareText } from '@/lib/topp10/share'
import type { Region, Topp10List } from '@/lib/topp10/types'

const REGIONS: { id: Region; label: string }[] = [
  { id: 'island', label: 'Ísland' },
  { id: 'enska', label: 'Enska' },
  { id: 'evropa', label: 'Evrópa' },
]

const DAY = 86_400_000

// A rebuilt list can reorder its answers, so a saved game belongs to one build of one list.
const savedKey = (list: Topp10List, day: number) => `topp10:${day}:${list.id}:${list.verifiedAt}`

function readSaved(key: string, list: Topp10List): GameState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    const valid = s.listId === list.id && [...s.found, ...s.hinted].every((i) => i >= 0 && i < list.answers.length)
    return valid ? s : null
  } catch {
    return null
  }
}

function writeSaved(key: string, state: GameState) {
  try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* private mode: play without saving */ }
}

export function Topp10Game() {
  const [region, setRegion] = useState<Region>('island')
  // the day is read in the browser, so everyone's list turns over at their own midnight render
  const [day, setDay] = useState<number | null>(null)
  const [freeId, setFreeId] = useState<string | null>(null)

  useEffect(() => {
    setDay(dayNumber(new Date()))
    try {
      const r = localStorage.getItem('topp10:region')
      if (r === 'island' || r === 'enska' || r === 'evropa') setRegion(r)
    } catch { /* ignore */ }
  }, [])

  const regionLists = useMemo(() => LISTS.filter((l) => l.region === region), [region])
  const daily = day === null ? null : dailyList(regionLists, new Date(day * DAY))
  const list = (freeId && regionLists.find((l) => l.id === freeId)) || daily

  const chooseRegion = (r: Region) => {
    setRegion(r)
    setFreeId(null)
    try { localStorage.setItem('topp10:region', r) } catch { /* ignore */ }
  }

  const shuffle = () => {
    const others = regionLists.filter((l) => l.id !== list?.id)
    if (others.length) setFreeId(others[Math.floor(Math.random() * others.length)].id)
  }

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Keppni" className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {REGIONS.map((r) => {
          const active = r.id === region
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={active}
              onClick={() => chooseRegion(r.id)}
              className="min-h-[44px] rounded-lg text-sm font-semibold"
              style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Veldu lista"
          value={freeId ?? ''}
          onChange={(e) => setFreeId(e.target.value || null)}
          className="card px-3 py-2 text-sm flex-1 min-w-0 min-h-[44px]"
          style={{ color: 'var(--text)' }}
        >
          <option value="">Listi dagsins</option>
          {regionLists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <button onClick={shuffle} className="card px-3 min-h-[44px] text-sm font-semibold inline-flex items-center gap-1.5">
          <Shuffle size={15} aria-hidden /> Annar listi
        </button>
        {freeId && (
          <button onClick={() => setFreeId(null)} className="card px-3 min-h-[44px] text-sm font-semibold inline-flex items-center gap-1.5">
            <CalendarDays size={15} aria-hidden /> Dagsins
          </button>
        )}
      </div>

      {list && day !== null
        ? <Board key={`${list.id}:${freeId ? 'frjals' : day}`} list={list} saveAs={freeId ? null : savedKey(list, day)} daily={!freeId} />
        : <div className="card p-6 h-64 animate-pulse" aria-hidden />}
    </div>
  )
}

const MESSAGES: Record<Exclude<Outcome, 'empty'>, string> = {
  correct: 'Rétt!',
  wrong: 'Ekki á listanum.',
  repeat: 'Þú ert búin(n) að reyna þetta.',
  over: 'Leiknum er lokið.',
}

function Board({ list, saveAs, daily }: { list: Topp10List; saveAs: string | null; daily: boolean }) {
  const [state, setState] = useState<GameState>(() => newGame(list))
  const [text, setText] = useState('')
  const [flash, setFlash] = useState<{ outcome: Outcome; detail: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!saveAs) return
    const saved = readSaved(saveAs, list)
    if (saved) setState(saved)
  }, [saveAs, list])

  const update = (next: GameState) => {
    setState(next)
    if (saveAs) writeSaved(saveAs, next)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r = guess(list, state, text)
    if (r.outcome === 'empty') return
    update(r.state)
    setFlash({ outcome: r.outcome, detail: r.revealed.map((i) => list.answers[i].label).join(', ') })
    setText('')
    input.current?.focus()
  }

  const share = async () => {
    const body = shareText(list, state, `${window.location.origin}/topp10`)
    if (navigator.share) {
      try { await navigator.share({ text: body }); return } catch { return }
    }
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  const over = state.status !== 'playing'
  const total = list.answers.length

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="topp10-title">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold muted">{daily ? 'Listi dagsins' : 'Frjáls leikur'}</p>
          <h2 id="topp10-title" className="display text-xl font-black leading-tight">{list.title}</h2>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pt-1" aria-label={`${state.lives} líf eftir af ${LIVES}`} role="img">
          {Array.from({ length: LIVES }, (_, i) => (
            <Heart key={i} size={20} aria-hidden
              fill={i < state.lives ? 'var(--loss)' : 'transparent'}
              style={{ color: i < state.lives ? 'var(--loss)' : 'var(--border-strong)' }} />
          ))}
        </div>
      </div>
      <p className="text-sm mb-1">{list.question}</p>
      {list.note && <p className="text-xs muted mb-3">{list.note}</p>}

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // not left to implicit form submission, which some keyboards and automation skip
          onKeyDown={(e) => { if (e.key === 'Enter') submit(e) }}
          enterKeyHint="go"
          disabled={over}
          placeholder={over ? 'Leik lokið' : 'Skrifaðu nafn…'}
          aria-label="Ágiskun"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-w-0 rounded-lg border px-3 min-h-[44px] text-base"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }}
        />
        <button type="submit" disabled={over} className="rounded-lg px-4 min-h-[44px] text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
          Giska
        </button>
      </form>

      <p aria-live="polite" className="text-sm min-h-[1.5rem] mt-2 font-medium inline-flex items-center gap-1.5"
        style={{ color: flash?.outcome === 'correct' ? 'var(--win)' : flash?.outcome === 'wrong' ? 'var(--loss)' : 'var(--text-2)' }}>
        {flash && flash.outcome !== 'empty' && (
          <>
            {flash.outcome === 'correct' ? <Check size={15} aria-hidden /> : flash.outcome === 'wrong' ? <X size={15} aria-hidden /> : null}
            {MESSAGES[flash.outcome]}{flash.detail ? ` ${flash.detail}` : ''}
          </>
        )}
      </p>

      <ol className="grid gap-1.5 mt-2">
        {list.answers.map((a, i) => {
          const found = state.found.includes(i)
          const hinted = state.hinted.includes(i)
          const canHint = !over && !found && !hinted && state.lives > 1
          return (
            <li key={i} className="flex items-center gap-3 rounded-lg border px-3 min-h-[48px]"
              style={{
                borderColor: found ? 'color-mix(in srgb, var(--win) 45%, transparent)' : 'var(--border)',
                background: found ? 'color-mix(in srgb, var(--win) 10%, transparent)' : 'transparent',
              }}>
              <span className="num text-sm font-bold w-11 shrink-0 muted">{a.slot ?? `${a.rank}.`}</span>
              <span className="flex-1 min-w-0 py-2">
                {found ? (
                  <span className="font-semibold">{a.label}</span>
                ) : over ? (
                  <span className="muted italic">{a.label}</span>
                ) : hinted ? (
                  <span className="text-sm" style={{ color: 'var(--accent)' }}>{hintFor(list, i)}</span>
                ) : (
                  <span className="muted" aria-label="Ófundið">?</span>
                )}
              </span>
              {(found || over) && <span className="num text-xs muted shrink-0">{a.detail}</span>}
              {canHint && (
                <button onClick={() => update(hint(list, state, i))}
                  className="shrink-0 w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-lg"
                  aria-label={`Vísbending fyrir ${a.slot ?? `${a.rank}. sæti`}, kostar eitt líf`}
                  title="Vísbending (kostar líf)">
                  <Lightbulb size={16} aria-hidden style={{ color: 'var(--text-2)' }} />
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="text-sm font-semibold num">
          {state.status === 'won' ? `Þú fannst öll ${total}!` : over ? `Leik lokið. Þú fannst ${state.found.length} af ${total}.` : `${state.found.length} af ${total} fundin`}
        </p>
        {over && (
          <button onClick={share} className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border-strong)' }}>
            <Share2 size={15} aria-hidden /> {copied ? 'Afritað' : 'Deila'}
          </button>
        )}
      </div>

      <footer className="mt-4 pt-3 border-t text-[11px] muted" style={{ borderColor: 'var(--border)' }}>
        Tvær óháðar heimildir bornar saman og sammála um öll svör, staðfest {list.verifiedAt}:{' '}
        {list.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ' og '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.name}</a>
          </span>
        ))}
      </footer>
    </section>
  )
}
