'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Pixelify_Sans, Silkscreen } from 'next/font/google'
import { ArrowLeft, Archive, Check, ChevronDown, Infinity as Endless, Share2, Shirt, Volume2, VolumeX } from 'lucide-react'
import { dayNumber } from '@/lib/topp10/daily'
import {
  KIT_KEY, LAUNCH_DAY, ROUND, SECONDS, SOUND_KEY, TIER_INFO, answer, dailyRoad, isDone, newRun, openQuestion,
  restore, roadNumber, shareText, showcase, storageKey, suggest, tierOf, timeout, total,
  type Pick, type Run,
} from '@/lib/leidin/game'
import { PERFECT, STADIUMS, nextStadium, reached, type Stadium } from '@/lib/leidin/road'
import { KITS, figure, palette, runPose, W as FW, H as FH, type Kit } from '@/lib/leidin/sprite'
import type { LeidQuestion, Tier } from '@/lib/leidin/types'
import { RoadScene } from './scene'
import { sfx, setMuted } from './sfx'
import styles from './Leidin.module.css'

const pixel = Pixelify_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-pixel' })
const caps = Silkscreen({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-caps' })

type Phase = 'title' | 'intro' | 'answer' | 'reveal' | 'end'
type Mode = { kind: 'daily' } | { kind: 'archive'; day: number } | { kind: 'practice'; day: number }

const INTRO_MS = 2600
const URL = 'https://islensk-fotbolti.vercel.app/leidin'

const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } }

const KIND_WORD: Record<LeidQuestion['kind'], string> = { club: 'félag', player: 'leikmann', year: 'ártal', nation: 'þjóð', town: 'bæ' }

export function LeidinGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<RoadScene | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [today, setToday] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'daily' })
  const [run, setRun] = useState<Run | null>(null)
  const [phase, setPhase] = useState<Phase>('title')
  const [left, setLeft] = useState(SECONDS)
  const [guess, setGuess] = useState('')
  const [active, setActive] = useState(-1)
  const [last, setLast] = useState<{ pick: Pick; before: number } | null>(null)
  const [arrived, setArrived] = useState(false)
  const [banner, setBanner] = useState<Stadium | null>(null)
  const [kit, setKit] = useState<Kit>(KITS[0])
  const [muted, setMute] = useState(false)
  const [panel, setPanel] = useState<'none' | 'how' | 'kits' | 'archive'>('none')
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState('')
  const deadline = useRef(0)
  const lastTick = useRef(99)

  const day = mode.kind === 'daily' ? today : mode.day
  const road = useMemo(() => (day === null ? [] : dailyRoad(day)), [day])
  const index = run ? Math.min(run.picks.length, ROUND - 1) : 0
  const question: LeidQuestion | undefined = road[run?.picks.length ?? 0] ?? road[index]
  const score = run ? total(run) : 0
  const saveKey = (r: Run) => (mode.kind === 'practice' ? null : storageKey(r.day))

  // ---- start up: today, the saved road, the kit and the sound
  useEffect(() => {
    const d = dayNumber(new Date())
    setToday(d)
    const saved = restore(read(storageKey(d)), d) ?? newRun(d)
    setRun(saved)
    write(storageKey(d), JSON.stringify(saved))
    const k = KITS.find((x) => x.id === read(KIT_KEY))
    if (k) setKit(k)
    const m = read(SOUND_KEY) === 'off'
    setMute(m); setMuted(m)
  }, [])

  // ---- the scene lives as long as the page
  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new RoadScene(canvasRef.current, KITS[0])
    sceneRef.current = scene
    const onResize = () => scene.resize()
    const ro = new ResizeObserver(onResize)
    ro.observe(canvasRef.current.parentElement!)
    return () => { ro.disconnect(); scene.destroy(); sceneRef.current = null }
  }, [])
  useEffect(() => { sceneRef.current?.setKit(kit) }, [kit])
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.onPass = (i) => {
      sfx.arrive()
      setBanner(STADIUMS[i])
      window.setTimeout(() => setBanner((b) => (b === STADIUMS[i] ? null : b)), 2600)
      if (i === STADIUMS.length - 1) scene.celebrate('#ffd23f', true)
    }
    scene.onArrive = () => setArrived(true)
  })
  // place the runner when a road is loaded
  useEffect(() => {
    if (!run || phase !== 'title') return
    sceneRef.current?.moveTo(total(run), true)
    sceneRef.current?.setMood('juggle')
    sceneRef.current?.showFlags(null)
  }, [run, phase])

  // ---- the clock
  const finishTimeout = useCallback(() => {
    if (!run || !question) return
    const before = total(run)
    const res = timeout(run, question)
    commit(res.run)
    setLast({ pick: res.pick, before })
    sfx.timeout()
    toReveal(before, res.pick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, question])

  useEffect(() => {
    if (phase !== 'answer') return
    const id = window.setInterval(() => {
      const ms = deadline.current - performance.now()
      const s = Math.max(0, ms / 1000)
      setLeft(s)
      const whole = Math.ceil(s)
      if (whole !== lastTick.current && whole <= 5 && whole > 0) { lastTick.current = whole; sfx.urgent() }
      if (ms <= 0) { window.clearInterval(id); finishTimeout() }
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, finishTimeout])

  // countdown to the next road
  useEffect(() => {
    if (phase !== 'end' && phase !== 'title') return
    const tick = () => {
      const now = new Date()
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000))
      setClock(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  function commit(next: Run) {
    setRun(next)
    const key = saveKey(next)
    if (key) write(key, JSON.stringify(next))
  }

  // ---- the flow
  function begin() {
    if (!run) return
    setPanel('none')
    if (isDone(run)) { setPhase('end'); return }
    sfx.start()
    const opened = openQuestion(run)
    commit(opened)
    setGuess(''); setActive(-1); setLast(null); setArrived(false)
    setPhase('intro')
    sceneRef.current?.setMood('juggle')
    sceneRef.current?.showFlags(null)
    window.setTimeout(() => {
      deadline.current = performance.now() + SECONDS * 1000
      lastTick.current = 99
      setLeft(SECONDS)
      setPhase('answer')
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }, INTRO_MS)
  }

  function toReveal(before: number, pick: Pick) {
    const scene = sceneRef.current
    setPhase('reveal')
    setArrived(pick.points === 0)
    if (!scene) return
    scene.showFlags(before)
    if (pick.points > 0) {
      scene.markFlag(pick.points)
      scene.moveTo(before + pick.points)
      window.setTimeout(() => sfx.tier(pick.points), 150)
    } else {
      scene.markFlag(null)
      scene.setMood('sulk')
    }
  }

  // the runner got there: a cheer, bigger for rarer answers
  useEffect(() => {
    if (!arrived || phase !== 'reveal' || !last || last.pick.points === 0) return
    const scene = sceneRef.current
    scene?.setMood('cheer')
    if (last.pick.points >= 75) scene?.celebrate(TIER_INFO[last.pick.points as Tier].color)
    const id = window.setTimeout(() => scene?.setMood('idle'), 2200)
    return () => window.clearTimeout(id)
  }, [arrived, phase, last])

  function submit(text = guess) {
    if (phase !== 'answer' || !run || !question || !text.trim()) return
    const before = total(run)
    const res = answer(run, question, text)
    commit(res.run)
    setLast({ pick: res.pick, before })
    if (res.pick.outcome === 'right') sfx.kick()
    else sfx.wrong()
    toReveal(before, res.pick)
  }

  function next() {
    if (!run) return
    if (isDone(run)) {
      setPhase('end')
      const s = total(run)
      sceneRef.current?.showFlags(null)
      if (s >= STADIUMS[STADIUMS.length - 1].at) { sfx.fanfare(); sceneRef.current?.celebrate('#ffd23f', true) }
      sceneRef.current?.setMood(s >= STADIUMS[STADIUMS.length - 1].at ? 'cheer' : 'juggle')
      return
    }
    begin()
  }

  function startMode(m: Mode) {
    setMode(m)
    setPanel('none')
    const d = m.kind === 'daily' ? today! : m.day
    const r = m.kind === 'practice' ? newRun(d) : restore(read(storageKey(d)), d) ?? newRun(d)
    setRun(r)
    if (m.kind !== 'practice') write(storageKey(d), JSON.stringify(r))
    setPhase('title')
  }

  // ---- input
  const options = phase === 'answer' && question ? suggest(question.kind, guess) : []
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setActive((a) => (a + 1) % options.length) }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)) }
    else if (e.key === 'Escape') setActive(-1)
    else if (e.key === 'Enter') {
      e.preventDefault()
      submit(active >= 0 && options[active] ? options[active] : guess)
    }
  }

  // keys outside the input: Enter or space moves on
  useEffect(() => {
    const onDown = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (phase === 'reveal') { e.preventDefault(); next() }
      else if (phase === 'title' && panel === 'none' && run) { e.preventDefault(); begin() }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  })

  function toggleSound() {
    const m = !muted
    setMute(m); setMuted(m); write(SOUND_KEY, m ? 'off' : 'on')
  }
  function chooseKit(k: Kit) { setKit(k); write(KIT_KEY, k.id) }

  async function share() {
    if (!run) return
    const text = shareText(run, URL)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
    } catch { /* cancelled */ }
  }

  // ---- what to show
  const ahead = nextStadium(score)
  const at = reached(score)
  const tier = last ? tierOf(last.pick) : null
  const shown = last && question ? showcase(road.find((q) => q.id === last.pick.questionId)!, last.pick.answerId) : null
  const lastQ = last ? road.find((q) => q.id === last.pick.questionId) : null
  const lastAnswer = last && lastQ ? lastQ.answers.find((a) => a.id === last.pick.answerId) : null
  const pastDays = today === null ? [] : Array.from({ length: today - LAUNCH_DAY }, (_, i) => today - 1 - i)
  const titleAction = !run ? '...' : isDone(run) ? 'SJÁ NIÐURSTÖÐU' : run.picks.length ? 'HALDA ÁFRAM' : 'LEGGJA AF STAÐ'

  return (
    <div className={`${styles.shell} ${pixel.variable} ${caps.variable}`}>
      <div className={styles.topline}>
        <Link href="/leikjaherbergi" className={styles.back}><ArrowLeft size={13} aria-hidden /> Leikjaherbergið</Link>
        <span className={styles.modeTag}>
          {mode.kind === 'daily' ? `Leið dagsins${today !== null ? ` #${roadNumber(today)}` : ''}` : mode.kind === 'archive' ? `Eldri leið #${roadNumber(mode.day)}` : 'Æfingaleið'}
        </span>
      </div>

      <div className={styles.stage} data-phase={phase}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
        <div className={styles.scan} aria-hidden />

        {/* HUD */}
        {phase !== 'title' && run && (
          <div className={styles.hud}>
            <div className={styles.hudBox}>
              <span className={styles.hudLabel}>STIG</span>
              <span className={styles.hudValue}>{score}</span>
            </div>
            <div className={styles.dots} aria-label={`Spurning ${Math.min(run.picks.length + 1, ROUND)} af ${ROUND}`}>
              {Array.from({ length: ROUND }, (_, i) => {
                const p = run.picks[i]
                const color = p ? (p.points ? TIER_INFO[p.points as Tier].color : '#ff5a5f') : undefined
                return <span key={i} className={`${styles.dot} ${i === run.picks.length && phase !== 'end' ? styles.dotNow : ''}`} style={color ? { background: color, borderColor: color } : undefined} />
              })}
              <span className={styles.dotsLabel}>SPURNING {Math.min(run.picks.length + (phase === 'reveal' || phase === 'end' ? 0 : 1), ROUND)} AF {ROUND}</span>
            </div>
            <div className={`${styles.hudBox} ${styles.hudRight}`}>
              <span className={styles.hudLabel}>{ahead ? 'NÆSTI VÖLLUR' : 'ÁFANGASTAÐUR'}</span>
              <span className={styles.hudNext}>{ahead ? ahead.name : 'Laugardalsvöllur'}</span>
              <span className={styles.hudSmall}>{ahead ? `${ahead.at - score} stig eftir` : 'Þú ert kominn!'}</span>
            </div>
          </div>
        )}

        {/* route map */}
        {phase !== 'title' && (
          <div className={styles.route} aria-hidden>
            <div className={styles.routeLine}><div className={styles.routeFill} style={{ width: `${Math.min(100, (score / STADIUMS[STADIUMS.length - 1].at) * 100)}%` }} /></div>
            {STADIUMS.map((s) => (
              <span key={s.id} className={`${styles.stop} ${score >= s.at ? styles.stopDone : ''}`} style={{ left: `${(s.at / STADIUMS[STADIUMS.length - 1].at) * 100}%` }} title={s.name} />
            ))}
          </div>
        )}

        {banner && (
          <div className={styles.banner} key={banner.id}>
            <span className={styles.bannerKicker}>ÞÚ ERT KOMINN Á</span>
            <span className={styles.bannerName}>{banner.name}</span>
            <span className={styles.bannerHome}>{banner.home}</span>
          </div>
        )}

        {/* title */}
        {phase === 'title' && (
          <div className={styles.title}>
            <h1 className={styles.logo} data-text="LEIÐIN">LEIÐIN</h1>
            <p className={styles.logoSub}>Á LAUGARDALSVÖLL</p>
            <p className={styles.tagline}>7 spurningar · 25 sekúndur á hverja · því sjaldgæfara svar, því lengra hleypur þú</p>

            <div className={styles.menu}>
              <button type="button" className={styles.linkish} onClick={() => setPanel(panel === 'how' ? 'none' : 'how')}>
                <ChevronDown size={12} aria-hidden style={{ transform: panel === 'how' ? 'rotate(180deg)' : undefined }} /> HVERNIG Á AÐ SPILA
              </button>
              {panel === 'how' && (
                <ul className={styles.how}>
                  <li>Þú færð <b>7 fótboltaspurningar</b>. Allir fá sömu spurningar í dag.</li>
                  <li>Þú hefur <b>25 sekúndur</b> til að skrifa <b>eitt</b> rétt svar.</li>
                  <li>Rétt svar gefur <b>10 til 100 stig</b>: svar sem allir myndu segja gefur 10, svar sem fáir muna gefur 100.</li>
                  <li>Rangt svar, eða ef tíminn rennur út, gefur 0 stig.</li>
                  <li>Stigin færa leikmanninn áfram eftir veginum, völl af velli: frá battavellinum á skólalóðinni á <b>Laugardalsvöll við 600 stig</b>.</li>
                  <li>Ein tilraun á dag. Ný leið kemur á miðnætti.</li>
                </ul>
              )}
            </div>

            <button type="button" className={styles.go} onClick={begin} disabled={!run}>
              <span aria-hidden>▶</span> {titleAction} <span aria-hidden>◀</span>
            </button>

            <div className={styles.subRow}>
              <span className={styles.roadNo}>{mode.kind === 'practice' ? 'ÆFING' : day !== null ? `LEIÐ #${roadNumber(day)}` : ''}</span>
              <div className={styles.subButtons}>
                <button type="button" className={styles.chip} onClick={() => setPanel(panel === 'kits' ? 'none' : 'kits')}><Shirt size={12} aria-hidden /> TREYJA</button>
                <button type="button" className={styles.chip} onClick={() => setPanel(panel === 'archive' ? 'none' : 'archive')}><Archive size={12} aria-hidden /> ELDRI LEIÐIR</button>
                <button type="button" className={styles.chip} onClick={() => startMode({ kind: 'practice', day: 30000 + Math.floor(Math.random() * 50000) })}><Endless size={12} aria-hidden /> ÆFING</button>
                {mode.kind !== 'daily' && <button type="button" className={styles.chip} onClick={() => startMode({ kind: 'daily' })}>LEIÐ DAGSINS</button>}
              </div>
            </div>

            {panel === 'kits' && (
              <div className={styles.kits}>
                {KITS.map((k) => (
                  <button key={k.id} type="button" className={`${styles.kit} ${k.id === kit.id ? styles.kitOn : ''}`} onClick={() => chooseKit(k)} aria-pressed={k.id === kit.id}>
                    <KitThumb kit={k} />
                    <span>{k.name}</span>
                  </button>
                ))}
              </div>
            )}
            {panel === 'archive' && (
              <div className={styles.archive}>
                {pastDays.length === 0 && <p>Fyrsta leiðin er í dag. Eldri leiðir safnast hér upp, ein á dag.</p>}
                {pastDays.map((d) => {
                  const r = restore(read(storageKey(d)), d)
                  return (
                    <button key={d} type="button" className={styles.archiveRow} onClick={() => startMode({ kind: 'archive', day: d })}>
                      <span>LEIÐ #{roadNumber(d)}</span>
                      <span>{r && isDone(r) ? `${total(r)} stig · ${reached(total(r)).stadium.name}` : r && r.picks.length ? 'Í gangi' : 'Óspiluð'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* the question */}
        {(phase === 'intro' || phase === 'answer') && question && run && (
          <div className={styles.card} key={question.id}>
            <span className={styles.kicker}>SPURNING {run.picks.length + 1} AF {ROUND}</span>
            <h2 className={styles.prompt}>{question.prompt}</h2>
            <p className={styles.context}>{question.context}</p>
            <span className={styles.hint}>Augljóst svar = <b>10 stig</b> · sjaldgæft svar = <b>100 stig</b></span>
          </div>
        )}
        {phase === 'intro' && (
          <div className={styles.introPill}>Lestu spurninguna. Klukkan fer af stað eftir augnablik.</div>
        )}

        {/* answer box */}
        {phase === 'answer' && question && (
          <div className={styles.dock}>
            {options.length > 0 && (
              <ul className={styles.options} role="listbox">
                {options.map((o, i) => (
                  <li key={o} role="option" aria-selected={i === active}>
                    <button type="button" className={i === active ? styles.optionOn : ''} onMouseDown={(e) => { e.preventDefault(); submit(o) }}>{o}</button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.timer} data-urgent={left <= 5 || undefined}>
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="15" className={styles.timerBg} />
                <circle cx="18" cy="18" r="15" className={styles.timerFg} style={{ strokeDashoffset: `${94.25 * (1 - left / SECONDS)}` }} />
              </svg>
              <span>{Math.ceil(left)}</span>
            </div>
            <input
              ref={inputRef}
              className={styles.input}
              value={guess}
              onChange={(e) => { setGuess(e.target.value); setActive(-1) }}
              onKeyDown={onKey}
              placeholder={`Skrifaðu ${KIND_WORD[question.kind]} og ýttu á Enter`}
              inputMode={question.kind === 'year' ? 'numeric' : 'text'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Svarið þitt"
            />
            <button type="button" className={styles.shoot} onClick={() => submit()} disabled={!guess.trim()}>SVARA</button>
            <div className={styles.timeBar}><div style={{ width: `${(left / SECONDS) * 100}%` }} /></div>
          </div>
        )}

        {/* the verdict */}
        {phase === 'reveal' && last && tier && lastQ && (
          <div className={styles.reveal} style={{ ['--tier' as string]: tier.color }}>
            <span className={styles.revealIcon} aria-hidden><TierBall color={tier.color} /></span>
            <span className={styles.revealName}>{tier.name.toUpperCase()}</span>
            {last.pick.outcome !== 'timeout' && (
              <span className={styles.revealGuess}>“{lastAnswer ? lastAnswer.label : last.pick.guess}”</span>
            )}
            <span className={styles.revealPoints}>{last.pick.points ? `+${last.pick.points} STIG` : '0 STIG'}{lastAnswer?.detail ? <em> · {lastAnswer.detail}</em> : null}</span>
            <span className={styles.revealLine}>{tier.line}</span>
            {shown && (
              <div className={styles.others}>
                {shown.common && <span><b>Svarið sem flestir hefðu sagt:</b> {shown.common.label} <i>(+10)</i></span>}
                {shown.rare && <span><b>Sjaldgæft svar sem gaf meira:</b> {shown.rare.label} <i>(+{shown.rare.points})</i></span>}
              </div>
            )}
            <button type="button" className={styles.next} onClick={next}>
              {run && isDone(run) ? 'SJÁ LEIÐARLOK' : 'ÁFRAM'} <span aria-hidden>▶</span>
            </button>
          </div>
        )}

        {/* the end */}
        {phase === 'end' && run && (
          <div className={styles.end}>
            <span className={styles.kicker}>{mode.kind === 'practice' ? 'ÆFINGALEIÐ LOKIÐ' : `LEIÐ #${roadNumber(run.day)} LOKIÐ`}</span>
            <h2 className={styles.endTitle}>{at.index === STADIUMS.length - 1 ? 'Þú komst á Laugardalsvöll!' : `Þú komst á ${at.stadium.name}`}</h2>
            <p className={styles.endHome}>{at.stadium.home}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={at.stadium.image} alt={at.stadium.name} className={styles.endImg} />
            <div className={styles.endScore}>
              <b>{score}</b><span>/ {PERFECT}</span>
            </div>
            <div className={styles.endDots}>
              {run.picks.map((p, i) => <span key={i} style={{ background: p.points ? TIER_INFO[p.points as Tier].color : '#3a3f4f' }} title={`${p.points} stig`} />)}
            </div>
            {ahead && <p className={styles.endAhead}>Vantaði {ahead.at - score} stig upp á {ahead.name}.</p>}
            {score === PERFECT && <p className={styles.endAhead}>Fullkomin leið. Sjö gullmolar. Goðsögn.</p>}
            <div className={styles.endButtons}>
              <button type="button" className={styles.go} onClick={share}>
                {copied ? <><Check size={14} aria-hidden /> AFRITAÐ</> : <><Share2 size={14} aria-hidden /> DEILA</>}
              </button>
              <button type="button" className={styles.chip} onClick={() => startMode({ kind: 'practice', day: 30000 + Math.floor(Math.random() * 50000) })}><Endless size={12} aria-hidden /> ÆFINGALEIÐ</button>
              {mode.kind !== 'daily' && <button type="button" className={styles.chip} onClick={() => startMode({ kind: 'daily' })}>LEIÐ DAGSINS</button>}
            </div>
            {mode.kind === 'daily' && <p className={styles.clock}>Næsta leið eftir <b>{clock}</b></p>}

            <ol className={styles.recap}>
              {run.picks.map((p, i) => {
                const q = road[i]
                if (!q) return null
                const a = q.answers.find((x) => x.id === p.answerId)
                const s = showcase(q, p.answerId)
                const t = tierOf(p)
                return (
                  <li key={q.id}>
                    <span className={styles.recapQ}>{q.prompt}</span>
                    <span className={styles.recapA}>
                      <i style={{ background: t.color }}>{p.points ? `+${p.points}` : '0'}</i>
                      {p.outcome === 'right' ? a?.label : p.outcome === 'timeout' ? 'Tíminn rann út' : <s>{p.guess}</s>}
                    </span>
                    <span className={styles.recapMore}>
                      {s.rare && <>Sjaldgæft svar: {s.rare.label} (+{s.rare.points})</>}{s.common && <>{s.rare ? ' · ' : ''}Algengasta svarið: {s.common.label}</>}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        <button type="button" className={styles.sound} onClick={toggleSound} aria-label={muted ? 'Kveikja á hljóði' : 'Slökkva á hljóði'}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      <p className={styles.footnote}>
        Myndirnar af völlunum eru pixlaðar eftir alvöru ljósmyndum. Svör og stig koma úr leikskýrslum KSÍ, gagnagrunni Bestu spárinnar og staðfestum listum.
        Augljósasta svarið gefur 10 stig, sjaldgæfustu 100.
      </p>
    </div>
  )
}

function KitThumb({ kit }: { kit: Kit }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const g = figure(runPose(0.12), kit.pattern), pal = palette(kit)
    ctx.clearRect(0, 0, FW, FH)
    for (let i = 0; i < g.length; i++) if (g[i]) { ctx.fillStyle = pal[g[i]]; ctx.fillRect(i % FW, Math.floor(i / FW), 1, 1) }
  }, [kit])
  return <canvas ref={ref} width={FW} height={FH} className={styles.kitCanvas} />
}

function TierBall({ color }: { color: string }) {
  const rows = ['..xxxx..', '.xxkkxx.', 'xxkkkkxx', 'xkxkkxkx', 'xkxkkxkx', 'xxkkkkxx', '.xxkkxx.', '..xxxx..']
  return (
    <svg viewBox="0 0 8 8" width="40" height="40" shapeRendering="crispEdges">
      {rows.flatMap((r, y) => [...r].map((ch, x) => ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={ch === 'k' ? '#141821' : color} />))}
    </svg>
  )
}
