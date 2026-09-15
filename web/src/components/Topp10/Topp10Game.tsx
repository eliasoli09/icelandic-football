'use client'

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowRight, Check, ChevronDown, Info, RotateCcw, X } from 'lucide-react'
import { CLUB_BY_ID, QUESTIONS } from '@/lib/tenaball/data'
import { LIVES, SAVE_KEY, newRound, nextQuestion, restoreRound, submitAnswer, type Feedback, type Round } from '@/lib/tenaball/game'
import { normalise } from '@/lib/topp10/normalise'
import { TenaballScene } from './TenaballScene'
import { RotatingStarBall } from './RotatingStarBall'
import styles from './Tenaball.module.css'

type Visual = Feedback & { event: number }
export function Topp10Game() {
  const [state, setState] = useState(() => newRound(QUESTIONS[0]))
  const current = useRef(state)
  const [ready, setReady] = useState(false)
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<Visual | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [animated, setAnimated] = useState<string[]>([])
  const [celebrate, setCelebrate] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [roundNumber, setRoundNumber] = useState(0)
  const [help, setHelp] = useState(false)
  const [reveal, setReveal] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLHeadingElement>(null)
  const lastInput = useRef({ value: '', time: -Infinity })
  const sequence = useRef(0)
  const question = QUESTIONS.find(q => q.id === state.questionId)!

  useEffect(() => {
    try {
      const saved = restoreRound(sessionStorage.getItem(SAVE_KEY))
      if (saved) { current.current = saved; setState(saved); setShowResult(saved.status !== 'playing') }
    } catch { /* Storage may be unavailable; the game still works. */ }
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
    setHighlight(feedback?.kind === 'duplicate' ? feedback.clubId ?? null : null)
    const timer = setTimeout(() => setHighlight(null), 600)
    return () => clearTimeout(timer)
  }, [feedback])
  useEffect(() => { if (showResult) result.current?.focus({ preventScroll: true }) }, [showResult])

  const update = (next: Round) => {
    current.current = next
    setState(next)
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(next)) } catch { /* continue without persistence */ }
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
      setAnimated(a => [...a, response.feedback.clubId!])
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
  const next = () => {
    update(newRound(nextQuestion(current.current.questionId)))
    setText(''); setFeedback(null); setAnimated([]); setCelebrate(false); setShowResult(false); setReveal(false)
    lastInput.current = { value: '', time: -Infinity }
    setRoundNumber(n => n + 1)
  }
  const club = feedback?.clubId ? CLUB_BY_ID[feedback.clubId] : null
  const message = feedback?.kind === 'correct' ? `Rétt! ${club?.label} bætist við.`
    : feedback?.kind === 'incorrect' ? 'Ekki rétt. Reyndu aftur.'
    : feedback?.kind === 'duplicate' ? `${club?.label} er þegar komið.` : ''
  const kind = feedback?.kind ?? 'idle'

  return <div className={styles.shell}>
    <div className={styles.topline}><span>FÓTBOLTAÞRAUTIR <span>/</span> TENABALL</span><span>10 SVÖR. EIN ÁSKORUN.</span></div>
    <section className={styles.arena} aria-labelledby="tenaball-title" data-status={state.status}>
      <TenaballScene/>
      <div className={styles.toolbar}>
        <span className={styles.roundTag}><span/> ÞRAUT {String(QUESTIONS.indexOf(question) + 1).padStart(2, '0')} / {String(QUESTIONS.length).padStart(2, '0')}</span>
        <button className={styles.helpButton} onClick={() => setHelp(!help)} aria-expanded={help} aria-controls="tenaball-help"><Info size={16}/> Svona spilarðu</button>
      </div>
      {help && <aside id="tenaball-help" className={styles.help}>
        <strong>Tíu félög. Þrjár tilraunir.</strong>
        <p>Skrifaðu eitt félag í einu og ýttu á Enter eða Svara. Hvert nýtt rétt svar fyllir næsta þrep. Þú mátt svara í hvaða röð sem er. Rangt svar kostar tilraun; tómt eða endurtekið svar kostar ekkert.</p>
        <button onClick={() => setHelp(false)}>Loka leiðbeiningum <X size={16}/></button>
      </aside>}
      <div className={styles.gameLayout} key={roundNumber}>
        <header className={styles.brand}><p>MEISTARADEILDIN</p><h1 id="tenaball-title">TENABALL</h1><span>Tíu skref í átt að stjörnunum.</span></header>
        {!showResult && <div className={styles.questionBlock}><span className={styles.eyebrow}>{question.title}</span><h2>{question.question}</h2><p>Miðað við lok tímabilsins {question.cutoff}.</p></div>}
        <div className={`${styles.answerPanel} ${styles[kind] ?? ''}`} data-result={showResult}>
          {showResult ? <div className={styles.result}>
            <span className={styles.eyebrow}>{state.status === 'won' ? 'VEL GERT!' : 'VEL REYNT'}</span>
            <h2 ref={result} tabIndex={-1}>{state.status === 'won' ? '10 AF 10!' : 'Umferð lokið'}</h2>
            <p>{state.status === 'won' ? 'Öll tíu félögin fundin.' : `Þú fannst ${state.found.length} af 10 félögum.`}</p>
            <button className={styles.primary} onClick={next}>{QUESTIONS.length > 1 ? 'Næsta þraut' : 'Spila aftur'}<ArrowRight size={19}/></button>
            {state.status === 'lost' && <button className={styles.revealButton} aria-expanded={reveal} aria-controls="possible-answers" onClick={() => setReveal(!reveal)}>Sjá möguleg svör <ChevronDown size={17}/></button>}
          </div> : <>
            <form onSubmit={submit}>
              <label htmlFor="tenaball-answer">Nafn félags</label>
              <div className={styles.inputRow}><div className={styles.inputWrap}>
                <input ref={input} id="tenaball-answer" value={text} onChange={e => setText(e.target.value)} placeholder="Skrifaðu lið …" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" disabled={!ready || state.status !== 'playing'} aria-describedby="tenaball-feedback" aria-invalid={kind === 'incorrect'}/>
                {kind === 'incorrect' && <X className={styles.inputIcon} size={20} aria-hidden/>}
              </div><button type="submit" className={styles.primary} disabled={!ready || state.status !== 'playing'}>Svara <ArrowRight size={17}/></button></div>
            </form>
            <p id="tenaball-feedback" className={styles.feedback} aria-live="polite" aria-atomic="true">
              {message ? <span key={feedback?.event}>{kind === 'correct' ? <Check size={18}/> : kind === 'incorrect' ? <X size={18}/> : <Info size={18}/>} {message}</span> : <span className={styles.prompt}>Hvaða félag kemur fyrst upp í hugann?</span>}
            </p>
            <div className={styles.progress}>
              <div><strong key={state.found.length} className={animated.length ? styles.progressPop : ''}>{state.found.length} <span>/ 10</span></strong><span>rétt svör</span></div>
              <div className={styles.lives}><span>{state.lives} {state.lives === 1 ? 'tilraun eftir' : 'tilraunir eftir'}</span><span role="img" aria-label={`${state.lives} af 3 tilraunum eftir`} className={styles.dots}>{Array.from({ length: LIVES }, (_, i) => <i key={`${i}-${i < state.lives}`} className={i < state.lives ? styles.filled : styles.spent}/>)}</span></div>
            </div>
            <div className={styles.progressTrack} aria-hidden><span style={{ width: `${state.found.length * 10}%` }}/></div>
          </>}
        </div>
        <div className={`${styles.pyramid} ${celebrate ? styles.celebrating : ''}`} aria-label="Tíu svarþrep">
          <svg className={styles.pyramidOutline} viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden><path d="M125 10 H375 L486 546 Q501 570 486 585 Q480 592 466 592 H34 Q20 592 14 585 Q-1 570 14 546 Z"/></svg>
          <RotatingStarBall className={styles.crown}/>
          <ol role="list">{Array.from({ length: 10 }, (_, i) => {
            const id = state.found[i]
            const found = id ? CLUB_BY_ID[id] : null
            return <li key={i} style={{ '--step': i, '--row-width': `${46 + i * 4.4}%` } as CSSProperties} className={styles.step}>
              <div className={`${styles.stepSurface} ${found ? styles.found : ''}`}>
                {found && animated.includes(id) && <span className={styles.correctSweep} aria-hidden/>}
                {feedback?.kind === 'duplicate' && highlight === id && <span key={feedback.event} className={styles.duplicateSweep} aria-hidden/>}
                <span className={styles.stepNumber}>{i + 1}</span><span className={styles.clubName}>{found?.label ?? <span className={styles.emptyLine}/>}</span>
                {found ? <Check className={animated.includes(id) ? styles.checkDraw : ''} size={19} aria-label="Rétt svar"/> : <span className={styles.emptyDot} aria-hidden/>}
              </div>
            </li>
          })}</ol>
          <p className={styles.pyramidCaption}>{state.status === 'won' ? 'ÞÚ ERT KOMIN(N) Á TOPPINN' : 'HVERT RÉTT SVAR TELUR'}</p>
          {celebrate && <div className={styles.confetti} aria-hidden>{Array.from({ length: 28 }, (_, i) => <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--drift': `${(i % 2 ? 1 : -1) * (25 + i * 3)}px` } as CSSProperties}>✦</span>)}</div>}
        </div>
      </div>
      <div className={styles.arenaFooter}><span><span className={styles.tinyStar}>✦</span> ÞÍN ÞEKKING. ÞÍN MEISTARADEILD.</span><span>10 félög <i/> 3 tilraunir <i/> Engin tímamörk</span></div>
    </section>
    {reveal && <section id="possible-answers" className={styles.answers}><h2>Möguleg svör sem þú fannst ekki</h2><p>Þetta eru gild félög við þessari spurningu. Hvaða tíu ólík gild svör sem er duga.</p><ul>{question.clubIds.filter(id => !state.found.includes(id)).map(id => <li key={id}>{CLUB_BY_ID[id].label}</li>)}</ul></section>}
    <div className={styles.below}><span><RotateCcw size={14}/> Framvindan vistast í þessum vafraflipa.</span><a href={question.source} target="_blank" rel="noreferrer">Heimild: UEFA · Staðfest 15.09.2026 ↗</a></div>
    <p className={styles.srOnly} aria-live="polite">{showResult ? state.status === 'won' ? '10 af 10. Öll tíu félögin fundin.' : `Umferð lokið. Þú fannst ${state.found.length} af 10 félögum.` : ''}</p>
  </div>
}
