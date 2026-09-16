'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Flag, Share2, ShieldCheck, Trophy, X } from 'lucide-react'
import { MATCHES } from '@/lib/xi/matches'
import { dayNumber } from '@/lib/topp10/daily'
import { dailyMatch, giveUp, guessPlayer, guessResult, LAUNCH_DAY, LEVEL_KEY, newState, puzzleNumber, restore, resultPoints, shareText, showsFirstLetter, slot, solvedCount, storageKey, teamOver, triesFor, type XiState } from '@/lib/xi/game'
import { LEVELS, isLevel, type Level } from '@/lib/level'
import { rows } from '@/lib/xi/layout'
import { ICELANDIC_LETTERS, letters, markGuess, type Mark } from '@/lib/xi/word'
import type { Side, XiMatch, XiPlayer } from '@/lib/xi/types'
import styles from './Xi.module.css'

const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const dateLabel = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${MONTHS[m - 1]} ${y}` }
const REGION_LABEL: Record<XiMatch['region'], string> = { island: 'Ísland', enska: 'England', evropa: 'Evrópa og HM' }
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 }

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
  const [open, setOpen] = useState<number | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const d = dayNumber(new Date())
    try { const saved = localStorage.getItem(LEVEL_KEY); if (isLevel(saved)) setLevel(saved) } catch { /* default level */ }
    setToday(d); setViewDay(d); setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    setState(load(match) ?? newState())
    setSide('home'); setOpen(null); setConfirmGiveUp(false); setCopied(false)
  }, [match, ready])

  const update = (next: XiState) => { setState(next); save(match, next) }
  const team = match[side]
  const over = teamOver(match, state, side)
  const number = chosen ? null : puzzleNumber(viewDay)
  const solved = solvedCount(match, state, side)
  const formation = rows(team.players).slice(0, -1).reverse().map((row) => row.length).join('–')

  const share = async () => {
    const body = shareText(match, state, side, number, `${location.origin}/byrjunarlid`)
    if (navigator.share) { try { await navigator.share({ text: body }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(body); setCopied(true) } catch { /* blocked */ }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <div>
          <p className={styles.kicker}><span /> {chosen ? 'ÚR FÓTBOLTASÖGUNNI' : 'LEIKUR DAGSINS'}</p>
          <h1>Manstu byrjunarliðið?</h1>
          <p className={styles.subtitle}>Frægir leikir. Ellefu nöfn. Hvað manst þú?</p>
        </div>
        <div className={styles.difficulty}>
          <span className={styles.controlLabel}>Erfiðleikastig</span>
          <div role="group" aria-label="Erfiðleikastig" className={styles.levels}>
            {LEVELS.map((l) => (
              <button key={l.id} className={styles.level} aria-pressed={!chosen && level === l.id} disabled={!ready}
                onClick={() => { setLevel(l.id); setChosen(null); try { localStorage.setItem(LEVEL_KEY, l.id) } catch { /* not saved */ } }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.matchCard} aria-label="Leikurinn">
        <p className={styles.eyebrow}><Trophy size={13} aria-hidden /> {match.competition} <span>·</span> {match.stage}</p>
        <div className={styles.head}>
          <TeamBadge name={match.home.name} color={match.home.color} />
          <div className={styles.score} aria-live="polite">
            {state.result ? `${match.score.home} : ${match.score.away}` : '? : ?'}
            <span>{state.result ? 'LOKATÖLUR' : 'MANSTU ÚRSLITIN?'}</span>
          </div>
          <TeamBadge name={match.away.name} color={match.away.color} />
        </div>
        <div className={styles.matchMeta}>
          <span><CalendarDays size={13} aria-hidden /> {dateLabel(match.date)}</span>
          <span className={styles.metaDivider}>/</span>
          <span>{match.blurb}</span>
        </div>
        {state.result && match.score.note && <p className={styles.note}>{match.score.note}</p>}
      </section>

      <div className={styles.workspace}>
        <section className={styles.board} aria-label="Finndu byrjunarliðið">
          <div role="tablist" aria-label="Lið" className={styles.tabs}>
            {(['home', 'away'] as Side[]).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} aria-controls="xi-pitch" id={`xi-tab-${s}`} className={styles.tab} onClick={() => { setSide(s); setConfirmGiveUp(false) }}>
                <span className={styles.teamDot} style={{ background: match[s].color }} />
                <span>{match[s].name}</span><small>{solvedCount(match, state, s)}/11</small>
              </button>
            ))}
          </div>
          <div className={styles.pitchHeading}><span>BYRJUNARLIÐIÐ</span><span>{formation}</span></div>
          <div id="xi-pitch" role="tabpanel" aria-labelledby={`xi-tab-${side}`}>
            <div className={styles.pitch} aria-label={`Byrjunarlið ${team.name}`}>
              <div className={styles.pitchLines} aria-hidden="true"><i /><b /><span /></div>
              {rows(team.players).map((row, i) => (
                <div key={i} className={styles.row}>
                  {row.map((p) => (
                    <PlayerSpot key={p.number} player={p} color={team.color} ink={team.ink} firstLetter={showsFirstLetter(match)}
                      slotState={slot(state, side, p.number)} revealed={state.gaveUp[side]}
                      onOpen={() => setOpen(p.number)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.footer}>
            <div className={styles.legend}><span><i /> Rétt</span><span><i /> Ófundið</span></div>
            {!over && (confirmGiveUp
              ? <div className={styles.confirmActions}>
                  <button className={styles.primary} onClick={() => { update(giveUp(state, side)); setConfirmGiveUp(false) }}>Já, sýna liðið</button>
                  <button className={styles.ghost} onClick={() => setConfirmGiveUp(false)}>Hætta við</button>
                </div>
              : <button className={styles.ghost} onClick={() => setConfirmGiveUp(true)}><Flag size={14} aria-hidden /> Gefast upp</button>)}
            {over && <button className={styles.primary} onClick={share}><Share2 size={15} aria-hidden />{copied ? 'Afritað' : 'Deila'}</button>}
          </div>
        </section>

        <aside className={styles.sidebar} aria-label="Framvinda og úrslit">
          <section className={`${styles.panel} ${styles.progressPanel}`}>
            <div className={styles.panelHeading}><h2>Þín framvinda</h2><span className={styles.puzzleBadge}>{chosen ? 'VALINN LEIKUR' : `#${ready ? number : '—'}`}</span></div>
            <p className={styles.progressTeam}>{team.name}</p>
            <div className={styles.progressValue} aria-live="polite">{solved}<span>/ 11</span><span className={styles.progressCaption}>leikmenn fundnir</span></div>
            <progress className={styles.progress} value={solved} max={11} aria-label={`Fundnir leikmenn ${team.name}`} />
            <p className={styles.progressHint}>{solved === 11 ? 'Allir ellefu! Vel gert.' : over ? 'Liðið er upplýst. Prófaðu hitt liðið eða annan leik.' : 'Smelltu á treyju til að finna næsta leikmann.'}</p>
          </section>
          {ready && <ResultGuess key={match.id} match={match} state={state} onGuess={(h, a) => update(guessResult(state, h, a))} />}
          <section className={`${styles.panel} ${styles.instructions}`}>
            <h2>Svona spilarðu</h2>
            <ol>
              <li><span>1</span>Veldu treyju og giskaðu á nafn leikmannsins.</li>
              <li><span>2</span>Grænn stafur er réttur. Gulur stafur er á öðrum stað.</li>
              <li><span>3</span>Þú færð {triesFor(match)} tilraunir á hvern leikmann.{showsFirstLetter(match) ? ' Fyrsti stafurinn er gefinn.' : ''}</li>
            </ol>
          </section>
        </aside>
      </div>

      <section className={styles.archive} aria-label="Veldu annan leik">
        <div className={styles.archiveTitle}><CalendarDays size={18} aria-hidden /><div><h2>Annar leikur?</h2><p>Rifjaðu upp fleiri eftirminnilega leiki.</p></div></div>
        <div className={styles.nav}>
          <button className={styles.ghost} disabled={!ready || (!chosen && puzzleNumber(viewDay) <= 1)} aria-label="Fyrri leikur"
            onClick={() => { if (chosen) setChosen(null); else setViewDay(viewDay - 1) }}><ChevronLeft size={16} aria-hidden /></button>
          <span className={styles.number}>{chosen ? 'Valinn leikur' : ready ? `Leikur #${puzzleNumber(viewDay)}` : 'Leikur dagsins'}</span>
          <button className={styles.ghost} disabled={!ready || chosen !== null || viewDay >= today} aria-label="Næsti leikur" onClick={() => setViewDay(viewDay + 1)}><ChevronRight size={16} aria-hidden /></button>
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
      <details className={styles.sources}>
        <summary><ShieldCheck size={14} aria-hidden /> Staðfestar heimildir <span>Gögn og uppstilling</span></summary>
        <p>Byrjunarlið, númer og úrslit borin saman í tveimur heimildum og sammála, staðfest {match.verifiedAt.split('-').reverse().join('.')}:{' '}
          {match.sources.map((s, i) => <Fragment key={s.url}>{i > 0 && ' og '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></Fragment>)}.
          {' '}{match.layout}. Fyrirliðaband og mörk sjást aðeins þar sem báðar heimildir eru sammála.</p>
      </details>

      {open !== null && (
        <WordleDialog key={`${match.id}:${side}:${open}`} match={match} side={side} player={team.players.find((p) => p.number === open)!} state={state}
          onGuess={(typed) => { const r = guessPlayer(match, state, side, open, typed); if (!r.error) update(r.state); return r.error }}
          onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function TeamBadge({ name, color }: { name: string; color: string }) {
  return (
    <div className={styles.team}>
      <svg className={styles.teamIcon} viewBox="0 0 34 30" aria-hidden>
        <path d="M7 1h7l1.5 3h3L20 1h7l7 7-4 6-3-2v17H7V12l-3 2-4-6z" fill={color} stroke="#111" strokeWidth="1.5" />
      </svg>
      <span>{name}</span>
    </div>
  )
}

function ResultGuess({ match, state, onGuess }: { match: XiMatch; state: XiState; onGuess: (home: number, away: number) => void }) {
  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)
  if (state.result) {
    const points = resultPoints(state.result, match.score)
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeading}><h2>Rétt úrslit</h2><Trophy size={16} aria-hidden /></div>
        <p style={{ margin: 0, fontSize: 14 }}>
          Þú giskaðir á {state.result.home}-{state.result.away}.{' '}
          {points === 3 ? 'Hárrétt, 3 stig!' : points === 1 ? 'Rétt úrslit en ekki markatalan, 1 stig.' : 'Ekki rétt, 0 stig.'}
        </p>
      </div>
    )
  }
  const stepper = (label: string, value: number, set: (n: number) => void) => (
    <div className={styles.stepper}>
      <button aria-label={`Færri mörk ${label}`} onClick={() => set(Math.max(0, value - 1))}>-</button>
      <output aria-label={`Mörk ${label}`}>{value}</output>
      <button aria-label={`Fleiri mörk ${label}`} onClick={() => set(Math.min(20, value + 1))}>+</button>
    </div>
  )
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeading}><h2>Hvernig fór leikurinn?</h2><Trophy size={16} aria-hidden /></div>
      <p className={styles.panelDescription}>Giskaðu á lokatöluna. Allt að 3 stig í boði.</p>
      <div className={styles.stepperRow}>
        <div className={styles.scoreInput}><span>{match.home.name}</span>{stepper(match.home.name, home, setHome)}</div>
        <span style={{ fontWeight: 900 }}>-</span>
        <div className={styles.scoreInput}><span>{match.away.name}</span>{stepper(match.away.name, away, setAway)}</div>
        <button className={styles.primary} onClick={() => onGuess(home, away)}>Giska á úrslit <ArrowUpRight size={15} aria-hidden /></button>
      </div>
    </div>
  )
}

function PlayerSpot({ player, color, ink, firstLetter, slotState, revealed, onOpen }: {
  player: XiPlayer; color: string; ink: string; firstLetter: boolean; slotState: { guesses: string[]; done: 'solved' | 'failed' | null }; revealed: boolean; onOpen: () => void
}) {
  const shown = slotState.done !== null || revealed
  const status = slotState.done === 'solved' ? styles.solved : slotState.done === 'failed' ? styles.failed : revealed ? styles.revealed : ''
  return (
    <button className={`${styles.player} ${status}`} onClick={onOpen}
      aria-label={shown ? `Nr. ${player.number}, ${player.name}` : `Nr. ${player.number}, ${player.word.length} stafir, ${slotState.guesses.length} tilraunir`}
      title={shown ? player.name : undefined}>
      <span className={styles.shirtWrap}>
        <span className={styles.shirt} style={{ background: color, color: ink }}>{player.number}</span>
        {player.captain && <span className={styles.captain} aria-label="Fyrirliði">C</span>}
        {player.goals ? <span className={styles.ball} aria-label={`${player.goals} mörk`}>{'⚽'.repeat(Math.min(player.goals, 3))}</span> : null}
      </span>
      <span className={styles.label}>
        <span className={styles.blank}>{shown ? player.word : firstLetter ? player.word[0] + '.'.repeat(player.word.length - 1) : '.'.repeat(player.word.length)}</span>
        <span className={styles.tries}>{slotState.done === 'solved' ? <Check size={11} aria-hidden /> : slotState.done === 'failed' ? <X size={11} aria-hidden /> : slotState.guesses.length}</span>
      </span>
    </button>
  )
}

function WordleDialog({ match, side, player, state, onGuess, onClose }: {
  match: XiMatch; side: Side; player: XiPlayer; state: XiState
  onGuess: (typed: string) => string | undefined; onClose: () => void
}) {
  const team = match[side]
  const current = slot(state, side, player.number)
  const finished = current.done !== null || state.gaveUp[side]
  const [typed, setTypedState] = useState('')
  // kept in a ref as well, so keys pressed faster than a render still arrive in order
  const typedRef = useRef('')
  const setTyped = (next: string) => { typedRef.current = next; setTypedState(next) }
  const [message, setMessage] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const len = player.word.length

  const keyMarks = useMemo(() => {
    const best = new Map<string, Mark>()
    for (const g of current.guesses) markGuess(g, player.word).forEach((m, i) => {
      const prev = best.get(g[i])
      if (!prev || RANK[m] > RANK[prev]) best.set(g[i], m)
    })
    return best
  }, [current.guesses, player.word])

  const press = useCallback((key: string) => {
    if (finished) return
    const current = typedRef.current
    if (key === 'ENTER') {
      if (current.length !== len) { setMessage(`Nafnið er ${len} stafir`); return }
      const error = onGuess(current)
      if (error === 'repeat') setMessage('Þú ert búin(n) að reyna þetta')
      else if (!error) { setTyped(''); setMessage('') }
      return
    }
    if (key === 'DELETE') { setTyped(current.slice(0, -1)); return }
    const letter = letters(key, team.icelandic)
    if (letter.length === 1 && current.length < len) setTyped(current + letter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, len, onGuess, team.icelandic])

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter') { e.preventDefault(); press('ENTER') }
      else if (e.key === 'Backspace') press('DELETE')
      else if (e.key.length === 1) press(e.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, onClose])

  const tile = `min(46px, calc((100vw - 48px) / ${len} - 4px))`
  const keyRows = team.icelandic ? [KEY_ROWS[0], KEY_ROWS[1], ICELANDIC_LETTERS.join(''), KEY_ROWS[2]] : KEY_ROWS

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Leikmaður númer ${player.number}`} className={styles.dialog}>
        <div className={styles.dialogHead}>
          <h2>{team.name} · nr. {player.number}</h2>
          <button className={styles.ghost} onClick={onClose} aria-label="Loka"><X size={18} /></button>
        </div>
        <div className={styles.grid} style={{ ['--tile' as string]: tile }}>
          {Array.from({ length: triesFor(match) }, (_, r) => {
            const guess = current.guesses[r]
            const marks = guess ? markGuess(guess, player.word) : null
            const live = !guess && r === current.guesses.length && !finished
            return (
              <div key={r} className={styles.gridRow}>
                {Array.from({ length: len }, (_, c) => {
                  const ch = guess ? guess[c] : live ? typed[c] ?? '' : ''
                  const cls = marks ? styles[marks[c]] : ch ? styles.typed : ''
                  return <span key={c} className={`${styles.tile} ${cls}`}>{ch}</span>
                })}
              </div>
            )
          })}
        </div>
        <p className={styles.message} aria-live="polite">
          {current.done === 'solved' ? `Rétt! ${player.name}` : finished ? `Þetta var ${player.name}` : message || (showsFirstLetter(match) ? `Byrjar á ${player.word[0]}` : '')}
        </p>
        {!finished && (
          <div className={styles.keyboard}>
            {keyRows.map((row, i) => (
              <div key={row} className={styles.keyRow}>
                {i === keyRows.length - 1 && <button className={`${styles.key} ${styles.wide}`} onClick={() => press('DELETE')}>Eyða</button>}
                {[...row].map((k) => (
                  <button key={k} className={`${styles.key} ${keyMarks.get(k) ? styles[keyMarks.get(k)!] : ''}`} onClick={() => press(k)}>{k}</button>
                ))}
                {i === keyRows.length - 1 && <button className={`${styles.key} ${styles.wide}`} onClick={() => press('ENTER')}>Senda</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
