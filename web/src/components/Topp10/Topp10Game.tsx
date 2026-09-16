'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronDown, Info, Lightbulb, RotateCcw, Share2, X } from 'lucide-react'
import { QUESTIONS, QUESTION_BY_ID, REGIONS, words } from '@/lib/tenaball/data'
import { LEVEL_KEY, MODE_KEY, SAVE_KEY, dailyKey, dailyQuestion, livesFor, newRound, nextQuestion, restoreRound, shareText, submitAnswer, type Feedback, type Round } from '@/lib/tenaball/game'
import { hintDetails, requestHint } from '@/lib/tenaball/hints'
import { LEVELS, isLevel, type Level } from '@/lib/level'
import { dayNumber } from '@/lib/topp10/daily'
import { normalise } from '@/lib/topp10/normalise'
import { TenaballScene } from './TenaballScene'
import { RotatingStarBall } from './RotatingStarBall'
import styles from './Tenaball.module.css'

type Visual = Feedback & { event: number }
type Mode = 'daily' | 'free'
const DAY = 86_400_000

// Storage may be unavailable (private mode, blocked site data); the game still works without it.
const read = (store: 'local' | 'session', key: string) => {
  try { return (store === 'local' ? localStorage : sessionStorage).getItem(key) } catch { return null }
}
const write = (store: 'local' | 'session', key: string, value: string) => {
  try { (store === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* continue without persistence */ }
}
const pad = (n: number) => String(n).padStart(2, '0')
// spelled out here: not every browser ships Icelandic month names
const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const dayLabel = (day: number) => { const d = new Date(day * DAY); return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}` }
const optionLabel = (competition: string, title: string) => `${competition.charAt(0)}${competition.slice(1).toLowerCase()} · ${title}`

export function Topp10Game() {
  const [state, setState] = useState(() => newRound(QUESTIONS[0]))
  const current = useRef(state)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<Mode>('daily')
  const modeRef = useRef<Mode>('daily')
  const [level, setLevel] = useState<Level>('medium')
  const levelRef = useRef<Level>('medium')
  const [day, setDay] = useState(0)
  const dayRef = useRef(0)
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<Visual | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [animated, setAnimated] = useState<string[]>([])
  const [celebrate, setCelebrate] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [roundNumber, setRoundNumber] = useState(0)
  const [help, setHelp] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hintSelection, setHintSelection] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLHeadingElement>(null)
  const lastInput = useRef({ value: '', time: -Infinity })
  const sequence = useRef(0)
  const question = QUESTION_BY_ID[state.questionId]
  const answers = useMemo(() => new Map(question.answers.map(a => [a.id, a])), [question])
  const w = words(question.kind)
  const missing = question.answers.filter(a => !state.found.includes(a.id))
  const hintAnswer = missing.find(a => a.id === hintSelection) ?? missing[0]
  const hintStage = hintAnswer ? state.hints[hintAnswer.id] ?? 0 : 0
  const hints = hintAnswer ? hintDetails(question, hintAnswer) : []
  const hintSlot = hintAnswer ? question.answers.findIndex(a => a.id === hintAnswer.id) + 1 : 0
  // the day is read in the browser, after hydration, so the server never picks it
  const dateLabel = ready ? dayLabel(day) : ''

  useEffect(() => {
    const today = dayNumber(new Date())
    dayRef.current = today
    setDay(today)
    const free = read('session', MODE_KEY) === 'free' ? restoreRound(read('session', SAVE_KEY)) : null
    const saved = read('local', LEVEL_KEY)
    const lvl: Level = free ? QUESTION_BY_ID[free.questionId].level : isLevel(saved) ? saved : 'medium'
    levelRef.current = lvl
    setLevel(lvl)
    const daily = dailyQuestion(today, lvl)
    const start = free ?? restoreRound(read('local', dailyKey(today, lvl)), daily.id) ?? newRound(daily)
    modeRef.current = free ? 'free' : 'daily'
    setMode(modeRef.current)
    current.current = start
    setState(start)
    setShowResult(start.status !== 'playing')
    setReady(true)
  }, [])
  useEffect(() => {
    if (ready && current.current.status === 'playing' && matchMedia('(pointer: fine)').matches) input.current?.focus({ preventScroll: true })
  }, [ready, roundNumber])
  useEffect(() => {
    if (!celebrate) return
    const resultTimer = setTimeout(() => setShowResult(true), 850)
    const finishTimer = setTimeout(() => setCelebrate(false), 2900)
    return () => { clearTimeout(resultTimer); clearTimeout(finishTimer) }
  }, [celebrate])
  useEffect(() => {
    setHighlight(feedback?.kind === 'duplicate' ? feedback.answerId ?? null : null)
    const timer = setTimeout(() => setHighlight(null), 600)
    return () => clearTimeout(timer)
  }, [feedback])
  useEffect(() => { if (showResult) result.current?.focus({ preventScroll: true }) }, [showResult])

  const update = (next: Round) => {
    current.current = next
    setState(next)
    if (modeRef.current === 'daily') write('local', dailyKey(dayRef.current, levelRef.current), JSON.stringify(next))
    else write('session', SAVE_KEY, JSON.stringify(next))
  }
  const play = (next: Round, nextMode: Mode) => {
    modeRef.current = nextMode
    setMode(nextMode)
    write('session', MODE_KEY, nextMode)
    update(next)
    setText(''); setFeedback(null); setAnimated([]); setCelebrate(false); setReveal(false); setCopied(false); setHintSelection(null)
    setShowResult(next.status !== 'playing')
    lastInput.current = { value: '', time: -Infinity }
    setRoundNumber(n => n + 1)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready || current.current.status !== 'playing') return
    const value = input.current?.value ?? text
    const normalized = normalise(value)
    if (!normalized) return
    const time = performance.now()
    // Coalesce a double click / Enter+click without blocking a different answer.
    const repeatedEvent = normalized === lastInput.current.value && time - lastInput.current.time < 350
    if (repeatedEvent) { input.current?.focus({ preventScroll: true }); return }
    lastInput.current = { value: normalized, time }
    const token = String(++sequence.current) + ':' + time
    const response = submitAnswer(question, current.current, value, token)
    update(response.state)
    setFeedback({ ...response.feedback, event: sequence.current })
    if (response.feedback.kind === 'correct') {
      setAnimated(a => [...a, response.feedback.answerId!])
      setText('')
      if (input.current) input.current.value = ''
      if (response.state.status === 'won') setCelebrate(true)
    } else if (response.feedback.kind === 'incorrect') {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) input.current?.animate(
        [0, -4, 4, -3, 3, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 280 })
      if (response.state.status === 'lost') setShowResult(true)
    }
    if (response.state.status === 'playing') input.current?.focus({ preventScroll: true })
  }
  const next = () => play(newRound(nextQuestion(current.current.questionId)), 'free')
  const rememberLevel = (next: Level) => {
    levelRef.current = next
    setLevel(next)
    write('local', LEVEL_KEY, next)
  }
  const toDaily = () => {
    const daily = dailyQuestion(dayRef.current, levelRef.current)
    play(restoreRound(read('local', dailyKey(dayRef.current, levelRef.current)), daily.id) ?? newRound(daily), 'daily')
  }
  const chooseLevel = (next: Level) => { rememberLevel(next); toDaily() }
  const choose = (id: string) => {
    const q = QUESTION_BY_ID[id]
    if (!q) return
    rememberLevel(q.level)
    play(newRound(q), 'free')
  }
  const levelLabel = LEVELS.find(l => l.id === level)!.label
  const lives = livesFor(question)
  const share = async () => {
    const body = shareText(question, current.current, mode === 'daily' ? dateLabel : null, `${location.origin}/topp10`)
    if (navigator.share) { try { await navigator.share({ text: body }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(body); setCopied(true) } catch { /* clipboard blocked */ }
  }

  const answer = feedback?.answerId ? answers.get(feedback.answerId) : null
  const message = feedback?.kind === 'correct' ? `Rétt! ${answer?.label} bætist við.`
    : feedback?.kind === 'incorrect' ? 'Ekki eitt af tíu svörunum. Reyndu aftur.'
    : feedback?.kind === 'duplicate' ? `${answer?.label} ${w.already}.` : ''
  const kind = feedback?.kind ?? 'idle'
  const verified = question.verifiedAt.split('-').reverse().join('.')

  return <div className={styles.shell}>
    <div className={styles.topline}><span>FÓTBOLTAÞRAUTIR <span>/</span> TENABALL</span><span>10 SVÖR. EIN ÁSKORUN.</span></div>
    <section className={styles.arena} aria-labelledby="tenaball-title" data-status={state.status}>
      <TenaballScene/>
      <div className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
        <span className={styles.roundTag}><span/> {!ready ? 'ÞRAUT DAGSINS' : mode === 'daily' ? `ÞRAUT DAGSINS · ${levelLabel.toUpperCase()} · ${dateLabel.toUpperCase()}` : `${levelLabel.toUpperCase()} · ÞRAUT ${pad(QUESTIONS.indexOf(question) + 1)} / ${pad(QUESTIONS.length)}`}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div role="group" aria-label="Erfiðleikastig" style={{ display: 'flex', gap: 4 }}>
            {LEVELS.map(l => (
              <button key={l.id} className={styles.helpButton} aria-pressed={level === l.id} disabled={!ready}
                onClick={() => chooseLevel(l.id)}
                style={level === l.id ? { background: '#16c9ff', color: '#031746', borderColor: '#16c9ff' } : undefined}>
                {l.label}
              </button>
            ))}
          </div>
          {mode === 'free' && <button className={styles.helpButton} onClick={toDaily}><CalendarDays size={16}/> Þraut dagsins</button>}
          <select className={styles.helpButton} aria-label="Veldu þraut" value="" onChange={e => choose(e.target.value)} disabled={!ready}
            style={{ background: '#031746', maxWidth: 190, cursor: 'pointer' }}>
            <option value="">Allar þrautir</option>
            {REGIONS.map(r => <optgroup key={r.id} label={r.label}>
              {QUESTIONS.filter(x => x.region === r.id)
                .map(x => ({ id: x.id, label: `${optionLabel(x.competition, x.title)} (${LEVELS.find(l => l.id === x.level)!.label})` }))
                .sort((a, b) => a.label.localeCompare(b.label, 'is'))
                .map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </optgroup>)}
          </select>
          <button className={styles.helpButton} onClick={() => setHelp(!help)} aria-expanded={help} aria-controls="tenaball-help"><Info size={16}/> Svona spilarðu</button>
        </div>
      </div>
      {help && <aside id="tenaball-help" className={styles.help}>
        <strong>Tíu svör. Létt: 5 tilraunir, Miðlungs: 3, Erfitt: 2.</strong>
        <p>Skrifaðu eitt svar í einu og ýttu á Enter eða Svara. Hvert rétt svar fer beint í sitt rétta sæti í pýramídanum. Þú mátt svara í hvaða röð sem er. Rangt svar kostar tilraun; tómt eða endurtekið svar kostar ekkert. Ný þraut dagsins birtist á miðnætti, og undir Allar þrautir getur þú spilað hinar.</p>
        <p>Veldu ófundið sæti undir Vísbendingar. Fyrsta vísbending sýnir fyrsta staf, önnur þjóðerni leikmanns eða land félags og þriðja félag leikmanns á tímabili þrautarinnar eða heimaborg félags. Vísbendingar kosta ekki tilraun.</p>
        <button onClick={() => setHelp(false)}>Loka leiðbeiningum <X size={16}/></button>
      </aside>}
      <div className={styles.gameLayout} key={roundNumber}>
        <header className={styles.brand}><p>{ready ? question.competition : ' '}</p><h1 id="tenaball-title">TENABALL</h1><span>Tíu skref í átt að stjörnunum.</span></header>
        {!showResult && <div className={styles.questionBlock} aria-busy={!ready}>
          <span className={styles.eyebrow}>{ready ? question.title : ' '}</span>
          <h2>{ready ? question.question : ' '}</h2>
          <p>{ready ? question.context : ' '}</p>
          {ready && <p className={styles.ordering}>{question.ordering}</p>}
        </div>}
        <div className={`${styles.answerPanel} ${styles[kind] ?? ''}`} data-result={showResult}>
          {showResult ? <div className={styles.result}>
            <span className={styles.eyebrow}>{state.status === 'won' ? 'VEL GERT!' : 'VEL REYNT'}</span>
            <h2 ref={result} tabIndex={-1}>{state.status === 'won' ? '10 AF 10!' : 'Umferð lokið'}</h2>
            <p>{state.status === 'won' ? w.all : `Þú fannst ${state.found.length} af 10 ${w.ofMany}.`}</p>
            <button className={styles.primary} onClick={next}>{mode === 'daily' ? 'Fleiri þrautir' : 'Næsta þraut'}<ArrowRight size={19}/></button>
            {mode === 'daily' && <button className={styles.revealButton} onClick={share}><Share2 size={17}/> {copied ? 'Afritað' : 'Deila niðurstöðu'}</button>}
            {state.status === 'lost' && <button className={styles.revealButton} aria-expanded={reveal} aria-controls="possible-answers" onClick={() => setReveal(!reveal)}>Sjá möguleg svör <ChevronDown size={17}/></button>}
          </div> : <>
            <form onSubmit={submit}>
              <label htmlFor="tenaball-answer">{w.field}</label>
              <div className={styles.inputRow}><div className={styles.inputWrap}>
                <input ref={input} id="tenaball-answer" value={text} onChange={e => setText(e.target.value)} placeholder={w.placeholder} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" disabled={!ready || state.status !== 'playing'} aria-describedby="tenaball-feedback" aria-invalid={kind === 'incorrect'}/>
                {kind === 'incorrect' && <X className={styles.inputIcon} size={20} aria-hidden/>}
              </div><button type="submit" className={styles.primary} disabled={!ready || state.status !== 'playing'}>Svara <ArrowRight size={17}/></button></div>
            </form>
            <p id="tenaball-feedback" className={styles.feedback} aria-live="polite" aria-atomic="true">
              {message ? <span key={feedback?.event}>{kind === 'correct' ? <Check size={18}/> : kind === 'incorrect' ? <X size={18}/> : <Info size={18}/>} {message}</span> : <span className={styles.prompt}>{w.prompt}</span>}
            </p>
            {hintAnswer && <section className={styles.hints} aria-label="Vísbendingar">
              <div className={styles.hintHeading}><span><Lightbulb size={16}/> Vísbendingar</span><small>Kosta ekki tilraun</small></div>
              <div className={styles.hintControls}>
                <label className={styles.srOnly} htmlFor="tenaball-hint-slot">Sæti fyrir vísbendingu</label>
                <select id="tenaball-hint-slot" value={hintAnswer.id} onChange={e => setHintSelection(e.target.value)} disabled={!ready || state.status !== 'playing'}>
                  {missing.map(a => <option key={a.id} value={a.id}>Sæti {question.answers.indexOf(a) + 1} · {state.hints[a.id] ?? 0}/3</option>)}
                </select>
                <button type="button" onClick={() => update(requestHint(question, current.current, hintAnswer.id))} disabled={!ready || state.status !== 'playing' || hintStage >= 3}>
                  <Lightbulb size={15}/>{hintStage < 3 ? `Vísbending ${hintStage + 1} / 3` : 'Allar 3 sýndar'}
                </button>
              </div>
              <div className={styles.hintContent} aria-live="polite" aria-atomic="true">
                {hintStage > 0 ? <><span className={styles.hintFor}>Vísbendingar fyrir sæti {hintSlot}</span><ol>{hints.slice(0, hintStage).map((hint, i) => <li key={hint.label}><span>{i + 1}</span><div><small>{hint.label}</small><strong>{hint.value}</strong></div></li>)}</ol></> : <p>Veldu sæti og fáðu fyrsta stafinn.</p>}
              </div>
            </section>}
            <div className={styles.progress}>
              <div><strong key={state.found.length} className={animated.length ? styles.progressPop : ''}>{state.found.length} <span>/ 10</span></strong><span>rétt svör</span></div>
              <div className={styles.lives}><span>{state.lives} {state.lives === 1 ? 'tilraun eftir' : 'tilraunir eftir'}</span><span role="img" aria-label={`${state.lives} af ${lives} tilraunum eftir`} className={styles.dots}>{Array.from({ length: lives }, (_, i) => <i key={`${i}-${i < state.lives}`} className={i < state.lives ? styles.filled : styles.spent}/>)}</span></div>
            </div>
            <div className={styles.progressTrack} aria-hidden><span style={{ width: `${state.found.length * 10}%` }}/></div>
          </>}
        </div>
        <div className={`${styles.pyramid} ${celebrate ? styles.celebrating : ''}`} aria-label="Tíu svarþrep">
          <svg className={styles.pyramidOutline} viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden><path d="M125 10 H375 L486 546 Q501 570 486 585 Q480 592 466 592 H34 Q20 592 14 585 Q-1 570 14 546 Z"/></svg>
          <RotatingStarBall className={styles.crown}/>
          <ol role="list">{Array.from({ length: 10 }, (_, i) => {
            const answer = question.answers[i]
            const id = answer.id
            const found = state.found.includes(id) ? answer : null
            const shown = found ?? (reveal ? answer : null)
            return <li key={i} style={{ '--step': i, '--row-width': `${46 + i * 4.4}%` } as CSSProperties} className={styles.step}>
              <div className={`${styles.stepSurface} ${found ? styles.found : ''} ${!found && hintAnswer?.id === id && hintStage > 0 ? styles.hintTarget : ''} ${reveal && !found ? styles.revealed : ''}`} title={shown?.detail}>
                {found && animated.includes(id) && <span className={styles.correctSweep} aria-hidden/>}
                {feedback?.kind === 'duplicate' && highlight === id && <span key={feedback.event} className={styles.duplicateSweep} aria-hidden/>}
                <span className={styles.stepNumber}>{i + 1}</span><span className={styles.clubName}>{shown?.label ?? (state.hints[id] ? <span className={styles.hintedLetter}>{Array.from(answer.label)[0]}<span> …</span></span> : <span className={styles.emptyLine}/>)}</span>
                {found ? <Check className={animated.includes(id) ? styles.checkDraw : ''} size={19} aria-label="Rétt svar"/> : reveal ? <X size={16} aria-label="Ófundið svar"/> : <span className={styles.emptyDot} aria-hidden/>}
              </div>
            </li>
          })}</ol>
          <p className={styles.pyramidCaption}>{state.status === 'won' ? 'ÞÚ ERT KOMIN(N) Á TOPPINN' : 'HVERT RÉTT SVAR TELUR'}</p>
          {celebrate && <div className={styles.confetti} aria-hidden>{Array.from({ length: 28 }, (_, i) => <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--drift': `${(i % 2 ? 1 : -1) * (25 + i * 3)}px` } as CSSProperties}>✦</span>)}</div>}
        </div>
      </div>
      <div className={styles.arenaFooter}><span><span className={styles.tinyStar}>✦</span> ÞÍN ÞEKKING. TÍU SVÖR.</span><span>10 {w.many} <i/> {lives} tilraunir <i/> Engin tímamörk</span></div>
    </section>
    {reveal && <section id="possible-answers" className={styles.answers}><h2>Rétt svör sem þú fannst ekki</h2><p>{question.ordering}</p><ul>{question.answers.filter(a => !state.found.includes(a.id)).map(a => <li key={a.id}>{question.answers.indexOf(a) + 1}. {a.label}{a.detail && <span style={{ color: '#8fa0b8' }}> · {a.detail}</span>}</li>)}</ul></section>}
    <div className={styles.below}>
      <span><RotateCcw size={14}/> {mode === 'daily' ? 'Þraut dagsins vistast í þessum vafra. Ný þraut á miðnætti.' : 'Framvindan vistast í þessum vafraflipa.'}</span>
      <span style={{ flexWrap: 'wrap' }}>Heimildir, bornar saman og sammála {verified}:{question.sources.map((s, i) => <Fragment key={s.url}>{i > 0 && ' og '}<a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a></Fragment>)}</span>
    </div>
    <p className={styles.srOnly} aria-live="polite">{showResult ? state.status === 'won' ? `10 af 10. ${w.all}` : `Umferð lokið. Þú fannst ${state.found.length} af 10 ${w.ofMany}.` : ''}</p>
  </div>
}
