'use client'

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Flag, Lock, Search, Share2, X } from 'lucide-react'
import { NAME_INDEX, NAMES, PLAYERS, SCHEDULE } from '@/lib/hver/data'
import { HINTS, LEVEL_KEY, clubsShown, dailyPlayer, giveUp, guess, hintOpensAfter, hintValue, hintsOpen, newState, playersAt, puzzleNumber, restore, shareText, storageKey, suggest, triesFor, untilMidnight, type GuessOutcome, type WhoState } from '@/lib/hver/game'
import { dayNumber } from '@/lib/topp10/daily'
import { normalise } from '@/lib/topp10/normalise'
import { LEVELS, isLevel, type Level } from '@/lib/level'
import type { CareerRow, WhoPlayer } from '@/lib/hver/types'
import styles from './Hver.module.css'

const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const DAY = 86_400_000
const dayLabel = (day: number) => { const d = new Date(day * DAY); return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}` }
/** 3:07:09 */
const clock = (ms: number) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
const span = (r: CareerRow) => r.to === null ? `${r.from}-` : r.to === r.from ? `${r.from}` : `${r.from}-${r.to}`
const LEVEL_NOTE: Record<Level, string> = {
  easy: 'Þekktustu landsliðsmennirnir',
  medium: 'Atvinnumenn og landsliðsmenn',
  hard: 'Fyrir þá sem fylgjast með öllu',
}

const load = (player: WhoPlayer) => {
  try { return restore(localStorage.getItem(storageKey(player)), player) } catch { return null }
}
const save = (player: WhoPlayer, state: WhoState) => {
  try { localStorage.setItem(storageKey(player), JSON.stringify(state)) } catch { /* play on without saving */ }
}

export function HverGame() {
  const [ready, setReady] = useState(false)
  const [today, setToday] = useState(0)
  const [day, setDay] = useState(0)
  const [level, setLevel] = useState<Level>('easy')
  const player = useMemo(() => dailyPlayer(PLAYERS, day, level, SCHEDULE), [day, level])
  const [state, setState] = useState<WhoState>(newState)
  const [typed, setTyped] = useState('')
  const [active, setActive] = useState(-1)
  const [outcome, setOutcome] = useState<{ kind: GuessOutcome; name: string; n: number } | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    const d = dayNumber(new Date())
    try { const saved = localStorage.getItem(LEVEL_KEY); if (isLevel(saved)) setLevel(saved) } catch { /* default level */ }
    setToday(d); setDay(d); setReady(true)
  }, [])
  // at midnight in Iceland the next player arrives, without a reload; someone looking at an older day stays there
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!ready) return
    const tick = () => {
      const now = new Date()
      const d = dayNumber(now)
      setLeft(untilMidnight(now))
      setToday((t) => {
        if (d !== t) setDay((shown) => (shown === t ? d : shown))
        return d
      })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [ready])

  useEffect(() => {
    if (!ready) return
    setState(load(player) ?? newState())
    setTyped(''); setActive(-1); setOutcome(null); setConfirmGiveUp(false); setCopied(false)
  }, [player, ready])

  const options = useMemo(() => suggest(NAMES, typed), [typed])
  const cycle = playersAt(PLAYERS, level).length
  const over = state.status !== 'playing'
  const open = hintsOpen(player, state)
  const shown = clubsShown(player, state)
  const tries = triesFor(player)
  const hidden = player.career.length - shown
  const isToday = day === today

  const update = (next: WhoState) => { setState(next); save(player, next) }
  const submit = (text: string) => {
    const result = guess(player, state, text, NAME_INDEX)
    if (result.outcome === 'empty') return
    const name = result.outcome === 'right' ? player.name : NAME_INDEX.get(normalise(text)) ?? text
    setOutcome((o) => ({ kind: result.outcome, name, n: (o?.n ?? 0) + 1 }))
    if (result.state !== state) update(result.state)
    if (result.outcome === 'right' || result.outcome === 'wrong') { setTyped(''); setActive(-1) }
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // a highlighted suggestion, or the only one left, is the name meant
    const pick = active >= 0 && options[active] ? options[active] : !NAME_INDEX.has(normalise(typed)) && options.length === 1 ? options[0] : typed
    submit(pick)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)) }
    else if (e.key === 'Escape') { setTyped(''); setActive(-1) }
  }
  const chooseLevel = (next: Level) => {
    setLevel(next); setDay(today)
    try { localStorage.setItem(LEVEL_KEY, next) } catch { /* not saved */ }
  }
  const share = async () => {
    const label = LEVELS.find((l) => l.id === level)!.label
    const body = shareText(player, state, day, label, `${location.origin}/hver`)
    if (navigator.share) { try { await navigator.share({ text: body }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(body); setCopied(true) } catch { /* blocked */ }
  }

  const message = !outcome ? null
    : outcome.kind === 'right' ? `Rétt! Þetta er ${player.name}.`
    : outcome.kind === 'wrong' ? `Ekki ${outcome.name}.${over ? '' : open > 0 ? ' Ný vísbending opnaðist.' : ' Næsta félag bættist við ferilinn.'}`
    : outcome.kind === 'repeat' ? `Þú hefur þegar giskað á ${outcome.name}.`
    : outcome.kind === 'unknown' ? 'Það nafn er ekki á listanum. Veldu leikmann úr tillögunum.'
    : null

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <div>
          <p className={styles.kicker}><span /> {isToday ? 'LEIKMAÐUR DAGSINS' : `ÞRAUT ${dayLabel(day).toUpperCase()}`}</p>
          <h1>Hver er maðurinn?</h1>
          <p className={styles.subtitle}>Eitt félag í einu. Hvert rangt gisk sýnir næsta félag á ferlinum.</p>
        </div>
        <div>
          <span className={styles.controlLabel}>Erfiðleikastig</span>
          <div role="group" aria-label="Erfiðleikastig" className={styles.levels}>
            {LEVELS.map((l) => (
              <button key={l.id} className={styles.level} aria-pressed={level === l.id} disabled={!ready} onClick={() => chooseLevel(l.id)}>{l.label}</button>
            ))}
          </div>
          <p className={styles.levelNote}>{LEVEL_NOTE[level]}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.careerCard} aria-label="Ferill leikmannsins">
          <div className={styles.cardHead}>
            <span>FERILL</span>
            <span>#{ready ? puzzleNumber(day) : ''} · {ready ? dayLabel(day) : ''}</span>
          </div>
          <ol className={styles.career}>
            {ready && player.career.slice(0, shown).map((r, i) => (
              // rows showing when the puzzle loads come in one after another; a new club comes in at once
              <li key={i} className={r.loan ? styles.loan : undefined} style={{ '--i': state.guesses.length ? 0 : i } as CSSProperties}>
                <span className={styles.years}>{span(r)}</span>
                <span className={styles.club}>{r.loan && <span className={styles.arrow} aria-hidden>↳</span>}{r.club}{r.loan && <em>lán</em>}</span>
              </li>
            ))}
            {ready && hidden > 0 && (
              <li className={styles.nextClub} aria-label={`${hidden} félög í viðbót á ferlinum`}>
                <span className={styles.years}><Lock size={13} aria-hidden /></span>
                <span>{hidden === 1 ? 'Eitt félag í viðbót' : `${hidden} félög í viðbót`} · næsta birtist við rangt gisk</span>
              </li>
            )}
          </ol>
          {over && (
            <div className={styles.answer} aria-live="polite">
              <span>{state.status === 'won' ? 'RÉTT SVAR' : 'SVARIÐ'}</span>
              <strong>{player.name}</strong>
              <a href={player.sources[0].url} target="_blank" rel="noreferrer">Sjá á Transfermarkt <ArrowUpRight size={13} aria-hidden /></a>
            </div>
          )}
        </section>

        <section className={styles.play} aria-label="Giska">
          <div className={styles.status}>
            <span>GISK {state.guesses.length}/{tries}</span>
            <span>{shown}/{player.career.length} FÉLÖG SÝND</span>
          </div>
          {state.guesses.length > 0 && (
            <ol className={styles.tries} aria-label="Gisk">
              {state.guesses.map((g, i) => {
                const right = g === player.name
                return (
                  <li key={i} className={`${styles.try} ${right ? styles.tryRight : styles.tryWrong}`}>
                    <span className={styles.tryIcon}>{right ? <Check size={14} aria-label="Rétt" /> : <X size={14} aria-label="Rangt" />}</span>
                    <span>{g}</span>
                  </li>
                )
              })}
            </ol>
          )}

          {!over && (
            <form className={styles.form} onSubmit={onSubmit} role="search">
              <label htmlFor="hver-guess" className={styles.srOnly}>Nafn leikmanns</label>
              <div className={styles.combo}>
                <Search size={16} aria-hidden className={styles.searchIcon} />
                <input
                  id="hver-guess" ref={input} value={typed} autoComplete="off" autoCapitalize="words" spellCheck={false}
                  placeholder="Skrifaðu nafn leikmanns" disabled={!ready}
                  role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list"
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  onChange={(e) => { setTyped(e.target.value); setActive(-1) }} onKeyDown={onKey}
                />
                {options.length > 0 && (
                  <ul id={listId} role="listbox" className={styles.options}>
                    {options.map((name, i) => (
                      <li key={name} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                        onMouseDown={(e) => { e.preventDefault(); submit(name); input.current?.focus() }}>
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" className={styles.primary} disabled={!ready || !typed.trim()}>Giska</button>
            </form>
          )}
          <p className={styles.feedback} aria-live="polite">{message && <span key={outcome?.n}>{message}</span>}</p>

          <div className={styles.hints}>
            <div className={styles.hintsHead}><span>VÍSBENDINGAR</span><span>{open}/{HINTS.length}</span></div>
            <div className={styles.hintGrid}>
              {HINTS.map((h, i) => (
                <div key={h.id} className={`${styles.hint} ${i < open ? styles.hintOpen : ''}`}>
                  <small>{h.label}</small>
                  {i < open ? <strong>{hintValue(player, h.id)}</strong> : <span className={styles.locked}><Lock size={12} aria-hidden /> Eftir {hintOpensAfter(player, i + 1)}. ranga gisk</span>}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            {!over && (confirmGiveUp
              ? <><button className={styles.primary} onClick={() => { update(giveUp(state)); setConfirmGiveUp(false) }}>Já, sýna svarið</button>
                  <button className={styles.ghost} onClick={() => setConfirmGiveUp(false)}>Hætta við</button></>
              : <button className={styles.ghost} disabled={!ready} onClick={() => setConfirmGiveUp(true)}><Flag size={14} aria-hidden /> Gefast upp</button>)}
            {over && <button className={styles.primary} onClick={share}><Share2 size={15} aria-hidden /> {copied ? 'Afritað' : 'Deila'}</button>}
          </div>
        </section>
      </div>

      <nav className={styles.days} aria-label="Fyrri þrautir">
        <button className={styles.ghost} disabled={!ready || today - day >= cycle - 1} onClick={() => setDay((d) => d - 1)}><ChevronLeft size={15} aria-hidden /> Fyrri</button>
        <span>{isToday ? 'Þraut dagsins' : dayLabel(day)} · {LEVELS.find((l) => l.id === level)!.label}{left !== null && <> · <span className={styles.countdown}>Nýr leikmaður eftir {clock(left)}</span></>}</span>
        <button className={styles.ghost} disabled={!ready || isToday} onClick={() => setDay((d) => d + 1)}>Næsta <ChevronRight size={15} aria-hidden /></button>
      </nav>

      <p className={styles.sources}>
        {over
          ? <>Ferill, staða, fæðingarár og landslið borin saman og sammála {player.verifiedAt.split('-').reverse().join('.')}: {player.sources.map((s, i) => <Fragment key={s.url}>{i > 0 && ' og '}<a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a></Fragment>)}</>
          : 'Hver ferill er borinn saman á Transfermarkt og Wikipedia og birtist aðeins ef heimildirnar eru sammála. Heimildirnar sjást þegar þrautinni lýkur.'}
      </p>
    </div>
  )
}
