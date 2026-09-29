'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flag, HelpCircle, Share2, ShieldCheck, X } from 'lucide-react'
import { MATCHES } from '@/lib/xi/matches'
import { dayNumber } from '@/lib/topp10/daily'
import { dailyMatch, giveUp, guessPlayer, guessResult, LAUNCH_DAY, LEVEL_KEY, newState, puzzleNumber, restore, resultPoints, shareText, showsFirstLetter, slot, solvedCount, storageKey, teamOver, triesFor, type XiState } from '@/lib/xi/game'
import { LEVELS, isLevel, type Level } from '@/lib/level'
import { rows } from '@/lib/xi/layout'
import { letters, markGuess, type Mark } from '@/lib/xi/word'
import type { Side, XiMatch, XiPlayer } from '@/lib/xi/types'
import { StarBall } from '../Topp10/TenaballScene'
import { Shirt } from './Shirt'
import styles from './Xi.module.css'

const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const dateLabel = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${MONTHS[m - 1]} ${y}` }
const REGION_LABEL: Record<XiMatch['region'], string> = { island: 'Ísland', enska: 'England', evropa: 'Evrópa og HM' }
/** how long the letters take to turn: one tile after another */
const FLIP_STEP = 65, FLIP_TIME = 280
/** the colour a letter turns to at the half-way point of its flip */
const FACE: Record<Mark, string> = { hit: 'var(--hit)', near: 'var(--near)', miss: 'var(--miss)' }

const load = (match: XiMatch) => {
  try { return restore(localStorage.getItem(storageKey(match)), match) } catch { return null }
}
const save = (match: XiMatch, state: XiState) => {
  try { localStorage.setItem(storageKey(match), JSON.stringify(state)) } catch { /* play on without saving */ }
}

export function XiGame() {
  const [ready, setReady] = useState(false)
  const [today, setToday] = useState(LAUNCH_DAY)
  const [viewDay, setViewDay] = useState(LAUNCH_DAY)
  const [chosen, setChosen] = useState<string | null>(null)
  const [level, setLevel] = useState<Level>('medium')
  const match = useMemo(() => (chosen && MATCHES.find((m) => m.id === chosen)) || dailyMatch(MATCHES, viewDay, level), [chosen, viewDay, level])
  const [state, setState] = useState<XiState>(newState)
  const [side, setSide] = useState<Side>('home')
  const [picked, setPicked] = useState<number | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [askResult, setAskResult] = useState(false)
  /** the shirt that has just been solved, for one pulse of green */
  const [pulse, setPulse] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  // a team already complete when the page loads must not set off the confetti
  const celebrated = useRef<Record<Side, boolean>>({ home: false, away: false })
  const timers = useRef<number[]>([])
  const after = (ms: number, run: () => void) => { timers.current.push(window.setTimeout(run, ms)) }

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  useEffect(() => {
    const d = dayNumber(new Date())
    try { const saved = localStorage.getItem(LEVEL_KEY); if (isLevel(saved)) setLevel(saved) } catch { /* default level */ }
    setToday(d); setViewDay(d); setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    setState(load(match) ?? newState())
    setSide('home'); setPicked(null); setConfirmGiveUp(false); setCopied(false); setAskResult(false)
    celebrated.current = { home: false, away: false }
  }, [match, ready])

  const update = (next: XiState) => { setState(next); save(match, next) }
  const team = match[side]
  const over = teamOver(match, state, side)
  const number = chosen ? null : puzzleNumber(viewDay)
  const solved = solvedCount(match, state, side)
  const player = picked === null ? null : team.players.find((p) => p.number === picked) ?? null
  const formation = rows(team.players).slice(0, -1).reverse().map((row) => row.length).join('-')

  const onGuess = (typed: string) => {
    if (picked === null) return 'unknown' as const
    const result = guessPlayer(match, state, side, picked, typed)
    if (result.error) return result.error
    update(result.state)
    if (slot(result.state, side, picked).done === 'solved') {
      const done = solvedCount(match, result.state, side)
      after(FLIP_TIME + FLIP_STEP * typed.length, () => setPulse(picked))
      after(FLIP_TIME + FLIP_STEP * typed.length + 700, () => setPulse((n) => (n === picked ? null : n)))
      if (done === 11 && !celebrated.current[side]) {
        celebrated.current[side] = true
        after(FLIP_TIME + FLIP_STEP * typed.length, () => setCelebrate(true))
        after(FLIP_TIME + FLIP_STEP * typed.length + 1500, () => setCelebrate(false))
      }
    }
    return undefined
  }

  const share = async () => {
    const body = shareText(match, state, side, number, `${location.origin}/byrjunarlid`)
    if (navigator.share) { try { await navigator.share({ text: body }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(body); setCopied(true) } catch { /* blocked */ }
  }

  const chooseSide = (next: Side) => { setSide(next); setPicked(null); setConfirmGiveUp(false) }

  return (
    <div className={styles.shell}>
      <div className={styles.scenery} aria-hidden>
        <StarBall className={styles.ballLeft} />
        <StarBall className={styles.ballRight} />
      </div>

      <nav className={styles.crumbs} aria-label="Staðsetning">
        <span>Leikjaherbergið</span><span aria-hidden>/</span><strong aria-current="page">Byrjunarliðið</strong>
      </nav>

      <header className={styles.intro}>
        <div className={styles.introText}>
          <h1>Manstu byrjunarliðið?</h1>
          <p>Frægir leikir. Ellefu nöfn. Hvað manst þú?</p>
        </div>
        <div role="group" aria-label="Erfiðleikastig" className={styles.levels}>
          {LEVELS.map((l) => (
            <button key={l.id} className={styles.level} aria-pressed={!chosen && level === l.id} disabled={!ready}
              onClick={() => { setLevel(l.id); setChosen(null); try { localStorage.setItem(LEVEL_KEY, l.id) } catch { /* not saved */ } }}>
              {l.label}
            </button>
          ))}
        </div>
        <section className={styles.matchCard} aria-label="Leikurinn">
          <p className={styles.matchLine}>{match.blurb} <span aria-hidden>·</span> {dateLabel(match.date)}</p>
          <div className={styles.matchHead}>
            <Club name={match.home.name} color={match.home.color} ink={match.home.ink} />
            <span className={styles.score} aria-live="polite">{state.result ? `${match.score.home} : ${match.score.away}` : '? : ?'}</span>
            <Club name={match.away.name} color={match.away.color} ink={match.away.ink} />
            {state.result
              ? <span className={styles.points}>{resultPoints(state.result, match.score)}/3 stig</span>
              : <button className={styles.gold} onClick={() => setAskResult(true)}>Giska á úrslit</button>}
          </div>
          <p className={styles.matchMeta}><CalendarDays size={12} aria-hidden /> {match.competition} <span aria-hidden>·</span> {match.stage}
            {state.result && match.score.note ? <> <span aria-hidden>·</span> {match.score.note}</> : null}</p>
        </section>
      </header>

      <div className={styles.workspace}>
        <section className={styles.board} aria-label="Völlurinn">
          <div role="tablist" aria-label="Lið" className={styles.tabs}>
            {(['home', 'away'] as Side[]).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} aria-controls="xi-pitch" id={`xi-tab-${s}`}
                className={styles.tab} onClick={() => chooseSide(s)}>
                <Club name={match[s].name} color={match[s].color} ink={match[s].ink} small />
                <small>{solvedCount(match, state, s)}/11</small>
              </button>
            ))}
          </div>
          <div id="xi-pitch" role="tabpanel" aria-labelledby={`xi-tab-${side}`} className={styles.pitchWrap}>
            <div key={side} className={styles.pitch} aria-label={`Byrjunarlið ${team.name}`}>
              <div className={styles.lines} aria-hidden><i /><b /><u /><s /><em /></div>
              <span className={styles.formation} aria-label={`Leikkerfi ${formation}`}>{formation}</span>
              {rows(team.players).map((row, i) => (
                <div key={i} className={styles.row}>
                  {row.map((p) => (
                    <PlayerSpot key={p.number} player={p} color={team.color} ink={team.ink} firstLetter={showsFirstLetter(match)}
                      slotState={slot(state, side, p.number)} revealed={state.gaveUp[side]} selected={picked === p.number}
                      pulsing={pulse === p.number} onPick={() => { setPicked(p.number); setConfirmGiveUp(false) }} />
                  ))}
                </div>
              ))}
              {celebrate && <div className={styles.confetti} aria-hidden>
                {Array.from({ length: 26 }, (_, i) => <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--drift': `${(i % 2 ? 1 : -1) * (20 + i * 4)}px` } as CSSProperties} />)}
              </div>}
              {celebrate && <p className={styles.allEleven} role="status">11 AF 11!</p>}
            </div>
          </div>
        </section>

        <div className={styles.side}>
          <Finder key={`${match.id}:${side}`} match={match} side={side} player={player} state={state} solved={solved}
            onGuess={onGuess} onClose={() => setPicked(null)}
            onHelp={() => setShowHelp(true)} onShare={share} copied={copied}
            confirmGiveUp={confirmGiveUp} setConfirmGiveUp={setConfirmGiveUp}
            onGiveUp={() => { update(giveUp(state, side)); setConfirmGiveUp(false) }} over={over} />
          <button className={styles.another} aria-expanded={showPicker} onClick={() => setShowPicker(!showPicker)}>
            <ChevronLeft size={16} aria-hidden /> Velja annan leik
          </button>
        </div>
      </div>

      {showPicker && (
        <section className={styles.picker} aria-label="Velja annan leik">
          <div className={styles.pickerNav}>
            <button className={styles.ghost} disabled={!ready || (!chosen && puzzleNumber(viewDay) <= 1)} aria-label="Fyrri leikur"
              onClick={() => { if (chosen) setChosen(null); else setViewDay(viewDay - 1) }}><ChevronLeft size={16} aria-hidden /></button>
            <span>{chosen ? 'Valinn leikur' : ready ? `Leikur dagsins #${puzzleNumber(viewDay)}` : 'Leikur dagsins'}</span>
            <button className={styles.ghost} disabled={!ready || chosen !== null || viewDay >= today} aria-label="Næsti leikur"
              onClick={() => setViewDay(viewDay + 1)}><ChevronRight size={16} aria-hidden /></button>
          </div>
          <select className={styles.select} aria-label="Velja leik" value={chosen ?? ''} disabled={!ready} onChange={(e) => setChosen(e.target.value || null)}>
            <option value="">Leikur dagsins</option>
            {(['island', 'enska', 'evropa'] as const).map((r) => (
              <optgroup key={r} label={REGION_LABEL[r]}>
                {MATCHES.filter((m) => m.region === r).sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
                  <option key={m.id} value={m.id}>{m.home.name} - {m.away.name}, {m.competition} ({LEVELS.find((l) => l.id === m.level)!.label})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </section>
      )}

      <details className={styles.sources}>
        <summary><ShieldCheck size={14} aria-hidden /> Staðfestar heimildir</summary>
        <p>Byrjunarlið, númer og úrslit borin saman í tveimur heimildum og sammála, staðfest {match.verifiedAt.split('-').reverse().join('.')}:{' '}
          {match.sources.map((s, i) => <Fragment key={s.url}>{i > 0 && ' og '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></Fragment>)}.
          {' '}{match.layout}. Fyrirliðaband og mörk sjást aðeins þar sem báðar heimildir eru sammála.</p>
      </details>

      {askResult && <ResultDialog match={match} onClose={() => setAskResult(false)}
        onGuess={(h, a) => { update(guessResult(state, h, a)); setAskResult(false) }} />}
      {showHelp && <HelpDialog match={match} onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function Club({ name, color, ink, small }: { name: string; color: string; ink: string; small?: boolean }) {
  return (
    <span className={`${styles.club} ${small ? styles.clubSmall : ''}`}>
      <svg className={styles.crest} viewBox="0 0 28 30" aria-hidden focusable="false">
        <path d="M14 1.5 26 5v11c0 6.4-4.8 10.9-12 13C6.8 26.9 2 22.4 2 16V5Z" fill={color} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 1.5 26 5v11c0 6.4-4.8 10.9-12 13Z" fill="#00000026" />
      </svg>
      <span className={styles.clubName}>{name}</span>
    </span>
  )
}

function PlayerSpot({ player, color, ink, firstLetter, slotState, revealed, selected, pulsing, onPick }: {
  player: XiPlayer; color: string; ink: string; firstLetter: boolean
  slotState: { guesses: string[]; done: 'solved' | 'failed' | null }
  revealed: boolean; selected: boolean; pulsing: boolean; onPick: () => void
}) {
  const shown = slotState.done !== null || revealed
  const solved = slotState.done === 'solved'
  const label = shown ? player.name : firstLetter ? `${player.word[0]}${'·'.repeat(player.word.length - 1)}` : '·'.repeat(player.word.length)
  return (
    <button type="button" className={styles.spot} aria-pressed={selected} onClick={onPick}
      data-state={solved ? 'solved' : slotState.done === 'failed' ? 'failed' : revealed ? 'shown' : 'open'}
      aria-label={shown
        ? `Nr. ${player.number}, ${player.name}${solved ? ', fundinn' : ''}`
        : `Nr. ${player.number}, ${player.word.length} stafa nafn, ${slotState.guesses.length} tilraunir notaðar`}>
      <span className={`${styles.shirtWrap} ${pulsing ? styles.pulse : ''}`}>
        {selected && <span className={styles.ring} aria-hidden />}
        <Shirt number={player.number} color={color} ink={ink} />
        {player.captain && <span className={styles.captain} aria-label="Fyrirliði">C</span>}
        {player.goals ? <span className={styles.goals} aria-label={`${player.goals} mörk`}>{player.goals}</span> : null}
      </span>
      <span className={styles.nameTag} data-shown={shown}>
        {shown && solved && <Check size={11} aria-hidden />}
        <span>{label}</span>
      </span>
    </button>
  )
}

function Finder({ match, side, player, state, solved, onGuess, onClose, onHelp, onShare, copied, over, confirmGiveUp, setConfirmGiveUp, onGiveUp }: {
  match: XiMatch; side: Side; player: XiPlayer | null; state: XiState; solved: number
  onGuess: (typed: string) => string | undefined
  onClose: () => void; onHelp: () => void; onShare: () => void; copied: boolean; over: boolean
  confirmGiveUp: boolean; setConfirmGiveUp: (v: boolean) => void; onGiveUp: () => void
}) {
  const team = match[side]
  const tries = triesFor(match)
  const current = player ? slot(state, side, player.number) : { guesses: [], done: null as null | 'solved' | 'failed' }
  const finished = current.done !== null || state.gaveUp[side]
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(0)
  /** the row that is turning over, so older rows do not turn again on a redraw */
  const [flipping, setFlipping] = useState(-1)
  const sending = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const len = player?.word.length ?? 0

  useEffect(() => { setTyped(''); setMessage(''); setFlipping(-1); sending.current = false }, [player?.number])
  useEffect(() => {
    // the keyboard follows a deliberate choice of shirt, never a hover
    if (player && !finished) input.current?.focus({ preventScroll: true })
  }, [player?.number, finished])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!player || finished || sending.current) return
    if (typed.length !== len) {
      setMessage(`Nafnið er ${len} stafir`)
      setShake((n) => n + 1)
      return
    }
    sending.current = true
    const row = current.guesses.length
    const error = onGuess(typed)
    if (error) {
      setMessage(error === 'repeat' ? 'Þú ert búin(n) að reyna þetta nafn' : 'Þessi ágiskun gengur ekki')
      setShake((n) => n + 1)
      sending.current = false
      return
    }
    setFlipping(row)
    setTyped('')
    setMessage('')
    window.setTimeout(() => { sending.current = false }, FLIP_TIME + FLIP_STEP * len)
  }

  const head = (
    <div className={styles.finderHead}>
      <h2>Finndu leikmanninn</h2>
      {player && !finished && <span className={styles.tryCount}>Tilraun {current.guesses.length + 1} af {tries}</span>}
      <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Loka"><X size={18} aria-hidden /></button>
    </div>
  )

  return (
    <section className={styles.finder} aria-label="Finndu leikmanninn" data-open={player !== null}>
      {head}
      {!player ? (
        <p className={styles.empty}>Veldu treyju á vellinum til að giska á leikmanninn.</p>
      ) : (
        <div key={player.number} className={styles.finderBody}>
          <div className={styles.chosen}>
            <Shirt number={player.number} color={team.color} ink={team.ink} className={styles.bigShirt} />
            <div className={styles.chosenText}>
              <span className={styles.chip}>Valinn leikmaður · #{player.number}</span>
              <p className={styles.ask}>{finished ? (current.done === 'solved' ? 'Rétt hjá þér' : 'Nafnið var') : 'Giskaðu á eftirnafnið'}</p>
              {finished
                ? <p className={styles.answerName}>{player.name}</p>
                : <form onSubmit={submit} className={styles.entry}>
                    <div key={shake} className={`${styles.boxes} ${shake ? styles.shakeOnce : ''}`} style={{ ['--len' as string]: len }} aria-hidden>
                      {Array.from({ length: len }, (_, i) => (
                        <span key={i} className={styles.box} data-filled={typed[i] ? 'yes' : 'no'}>{typed[i] ?? ''}</span>
                      ))}
                    </div>
                    <label className={styles.srOnly} htmlFor="xi-entry">Eftirnafn leikmanns númer {player.number}, {len} stafir</label>
                    <input id="xi-entry" ref={input} className={styles.entryInput} value={typed} inputMode="text" autoComplete="off"
                      autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="send" maxLength={len}
                      onChange={(e) => setTyped(letters(e.target.value, team.icelandic).slice(0, len))} />
                  </form>}
            </div>
          </div>

          <div className={styles.attempts}>
            <ol className={styles.grid} aria-label="Tilraunir">
              {Array.from({ length: tries }, (_, r) => {
                const guess = current.guesses[r]
                const marks = guess ? markGuess(guess, player.word) : null
                return (
                  <li key={r} className={styles.gridRow} style={{ ['--len' as string]: len }}>
                    <span className={styles.rowNumber}>{r + 1}</span>
                    {Array.from({ length: len }, (_, c) => (
                      <span key={c} className={`${styles.tile} ${marks ? styles[marks[c]] : ''} ${flipping === r ? styles.flip : ''}`}
                        style={{ ['--i' as string]: c, ['--face' as string]: marks ? FACE[marks[c]] : undefined }}>{guess ? guess[c] : ''}</span>
                    ))}
                  </li>
                )
              })}
            </ol>
            <div className={styles.attemptSide}>
              {!finished && <button type="button" className={styles.gold} onClick={submit}>Staðfesta</button>}
              <ul className={styles.legend}>
                <li><i className={styles.hit} /> Réttur staður</li>
                <li><i className={styles.near} /> Annar staður</li>
                <li><i className={styles.miss} /> Ekki í nafni</li>
              </ul>
            </div>
          </div>
          <p className={styles.message} role="status">{message || (current.done === 'solved' ? `Rétt! ${player.name}` : finished ? `Þetta var ${player.name}` : showsFirstLetter(match) ? `Nafnið byrjar á ${player.word[0]}` : '')}</p>
        </div>
      )}

      <footer className={styles.finderFoot}>
        <div className={styles.progressLine}>
          <strong aria-live="polite">{solved} af 11 fundnir</strong>
          <div className={styles.actions}>
            <button type="button" className={styles.link} onClick={onHelp}><HelpCircle size={14} aria-hidden /> Svona spilarðu</button>
            {over
              ? <button type="button" className={styles.link} onClick={onShare}><Share2 size={14} aria-hidden /> {copied ? 'Afritað' : 'Deila'}</button>
              : confirmGiveUp
                ? <span className={styles.confirm}>
                    <button type="button" className={styles.link} onClick={onGiveUp}>Já, sýna liðið</button>
                    <button type="button" className={styles.link} onClick={() => setConfirmGiveUp(false)}>Hætta við</button>
                  </span>
                : <button type="button" className={styles.link} onClick={() => setConfirmGiveUp(true)}><Flag size={14} aria-hidden /> Gefast upp</button>}
          </div>
        </div>
        <ol className={styles.pips} aria-hidden>
          {[...team.players].sort((a, b) => a.line - b.line || a.x - b.x).map((p) => (
            <li key={p.number} data-done={slot(state, side, p.number).done === 'solved'} />
          ))}
        </ol>
      </footer>
    </section>
  )
}

function ResultDialog({ match, onClose, onGuess }: { match: XiMatch; onClose: () => void; onGuess: (home: number, away: number) => void }) {
  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus() }, [])
  // counted from the value at the moment of the click, so two quick taps add two
  const stepper = (label: string, value: number, set: (next: (n: number) => number) => void) => (
    <div className={styles.stepper}>
      <button type="button" aria-label={`Færri mörk ${label}`} onClick={() => set((n) => Math.max(0, n - 1))}>-</button>
      <output aria-label={`Mörk ${label}`}>{value}</output>
      <button type="button" aria-label={`Fleiri mörk ${label}`} onClick={() => set((n) => Math.min(20, n + 1))}>+</button>
    </div>
  )
  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Giska á úrslit" className={styles.dialog}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className={styles.dialogHead}><h2>Hvernig fór leikurinn?</h2>
          <button type="button" className={styles.ghost} onClick={onClose} aria-label="Loka"><X size={18} aria-hidden /></button></div>
        <p className={styles.dialogText}>Giskaðu á lokatöluna. Þrjú stig fyrir rétta markatölu, eitt fyrir réttan sigurvegara.</p>
        <div className={styles.scoreRow}>
          <div><span>{match.home.name}</span>{stepper(match.home.name, home, setHome)}</div>
          <span aria-hidden>-</span>
          <div><span>{match.away.name}</span>{stepper(match.away.name, away, setAway)}</div>
        </div>
        <button type="button" className={styles.gold} onClick={() => onGuess(home, away)}>Staðfesta úrslit</button>
      </div>
    </div>
  )
}

function HelpDialog({ match, onClose }: { match: XiMatch; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus() }, [])
  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Svona spilarðu" className={styles.dialog}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className={styles.dialogHead}><h2>Svona spilarðu</h2>
          <button type="button" className={styles.ghost} onClick={onClose} aria-label="Loka"><X size={18} aria-hidden /></button></div>
        <ol className={styles.steps}>
          <li>Veldu treyju á vellinum. Þá opnast leikmaðurinn hér til hliðar.</li>
          <li>Skrifaðu eftirnafnið og staðfestu. Grænn stafur er á réttum stað, gulur er í nafninu en annars staðar, grár er ekki í því.</li>
          <li>Þú færð {triesFor(match)} tilraunir á hvern leikmann.{showsFirstLetter(match) ? ' Á léttu stigi sést fyrsti stafurinn.' : ''}</li>
          <li>Giskaðu líka á úrslitin: þrjú stig fyrir rétta markatölu, eitt fyrir réttan sigurvegara.</li>
        </ol>
      </div>
    </div>
  )
}
