'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Check, Crosshair, Flag as FlagIcon, HelpCircle, Home, Minus, Plus, RefreshCw, Search, Share2, Shuffle, Volume2, VolumeX, X } from 'lucide-react'
import { dayNumber } from '@/lib/topp10/daily'
import {
  BY_ID, CLUBS, LEAGUE, LEVELS, STATS_KEY, addGuess, emptyStats, evaluate, guessable, isOver, newGame, puzzleNumber,
  record, restore, shareText, storageKey, suggest, won, type Game, type Level, type Stats,
} from '@/lib/vallarleit/game'
import { LEAGUES } from '@/lib/vallarleit/leagues'
import { formatKm, formatM, heatColor, heatWord } from '@/lib/vallarleit/geo'
import type { VClub } from '@/lib/vallarleit/types'
import { EUROPE, Globe, type Flag } from './globe'
import { sfx, setMuted } from './sfx'
import styles from './Vallarleit.module.css'

const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } }
const LEVEL_KEY = 'vallarleit:level'
const SOUND_KEY = 'vallarleit:sound'

const where = (c: VClub) => {
  const l = LEAGUE.get(c.league)!
  return `${l.land} · ${l.name}`
}

function useCountdown() {
  const [left, setLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000))
      setLeft(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return left
}

/** counts up to a distance the first time a row appears */
function Metres({ m, animate }: { m: number; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : m)
  useEffect(() => {
    if (!animate) { setShown(m); return }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      setShown(m * (1 - (1 - t) ** 3))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [m, animate])
  return <>{formatM(shown)}</>
}

export function VallarleitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<Globe | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [today, setToday] = useState<number | null>(null)
  const [level, setLevel] = useState<Level>('easy')
  const [game, setGame] = useState<Game | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [tip, setTip] = useState<{ club: VClub; x: number; y: number } | null>(null)
  const [picked, setPicked] = useState<{ club: VClub; x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<'none' | 'help' | 'stats'>('none')
  const [stats, setStats] = useState<Stats>(emptyStats())
  const [muted, setMute] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const [statuses, setStatuses] = useState<Record<Level, 'open' | 'playing' | 'won' | 'lost'>>({ easy: 'open', medium: 'open', hard: 'open', impossible: 'open' })
  const countdown = useCountdown()
  const bornAt = useRef(new Map<string, number>())

  // ---- start up
  useEffect(() => {
    const d = dayNumber(new Date())
    setToday(d)
    const saved = read(LEVEL_KEY) as Level | null
    if (saved && LEVELS.some((l) => l.key === saved)) setLevel(saved)
    const m = read(SOUND_KEY) === 'off'
    setMute(m); setMuted(m)
    if (read('vallarleit:seen') !== '1') { setPanel('help'); write('vallarleit:seen', '1') }
  }, [])

  // ---- the globe
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const globe = new Globe(canvas, {
      hover: (club, x, y) => setTip(club ? { club, x, y } : null),
      pick: (club) => setPicked((p) => (p?.club.id === club.id ? null : { club, x: 0, y: 0 })),
    })
    globeRef.current = globe
    const dark = () => globe.setDark(document.documentElement.classList.contains('dark'))
    dark()
    const mo = new MutationObserver(dark)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const ro = new ResizeObserver(() => globe.resize())
    ro.observe(canvas)
    fetch('/vallarleit/europe.json').then((r) => r.json()).then((geo) => globe.setLand(geo)).catch(() => {})
    globe.flyTo(EUROPE, 2400)
    return () => { mo.disconnect(); ro.disconnect(); globe.destroy(); globeRef.current = null }
  }, [])

  // ---- the game for this level
  useEffect(() => {
    if (today === null) return
    const day = level === 'impossible' ? null : today
    const g = restore(read(storageKey(level, day)), level, day) ?? newGame(level, today)
    write(storageKey(level, day), JSON.stringify(g))
    bornAt.current = new Map()
    setGame(g)
    setFresh(null)
    setShowEnd(isOver(g))
    setPicked(null)
    setQuery('')
    try { setStats({ ...emptyStats(), ...JSON.parse(read(STATS_KEY(level)) ?? '{}') }) } catch { setStats(emptyStats()) }
    write(LEVEL_KEY, level)
  }, [level, today])

  // ---- the little status dot on each level tab
  useEffect(() => {
    if (today === null) return
    const next = {} as Record<Level, 'open' | 'playing' | 'won' | 'lost'>
    for (const l of LEVELS) {
      const g = level === l.key && game ? game : restore(read(storageKey(l.key, l.key === 'impossible' ? null : today)), l.key, l.key === 'impossible' ? null : today)
      next[l.key] = !g || !g.guesses.length ? 'open' : won(g) ? 'won' : g.gaveUp ? 'lost' : 'playing'
    }
    setStatuses(next)
  }, [game, level, today])

  const guesses = useMemo(() => (game ? evaluate(game) : []), [game])
  const sorted = useMemo(() => [...guesses].sort((a, b) => a.m - b.m), [guesses])
  const answer = game ? BY_ID.get(game.answer)! : null
  const over = game ? isOver(game) : false
  const victory = game ? won(game) : false

  // ---- keep the globe in step with the game
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !game) return
    globe.setDots(guessable(game.level))
    const flags: Flag[] = guesses.map((g) => ({ club: g.club, heat: g.heat, m: g.m, correct: g.correct, sameGround: g.sameGround, born: bornAt.current.get(g.club.id) ?? 0 }))
    globe.setFlags(flags)
    globe.setReveal(game.gaveUp && !won(game) ? answer : null)
  }, [game, guesses, answer])

  const save = useCallback((g: Game) => {
    write(storageKey(g.level, g.day), JSON.stringify(g))
    setGame(g)
  }, [])

  const finish = useCallback((g: Game) => {
    const stamp = g.level === 'impossible' ? Date.now() : g.day!
    let s: Stats = emptyStats()
    try { s = { ...emptyStats(), ...JSON.parse(read(STATS_KEY(g.level)) ?? '{}') } } catch { /* fresh */ }
    const next = record(s, g, stamp)
    write(STATS_KEY(g.level), JSON.stringify(next))
    setStats(next)
  }, [])

  const guess = useCallback((club: VClub) => {
    if (!game || over) return
    if (game.guesses.includes(club.id)) { sfx.nope(); return }
    const g = addGuess(game, club.id)
    bornAt.current.set(club.id, performance.now())
    save(g)
    setFresh(club.id)
    setQuery('')
    setActive(0)
    setPicked(null)
    const globe = globeRef.current
    const ev = evaluate(g).find((x) => x.club.id === club.id)!
    setTimeout(() => sfx.plant(ev.heat), 520)
    if (ev.correct) {
      globe?.flyTo({ lon: club.lon, lat: club.lat, k: 9 }, 1500)
      globe?.celebrate(club)
      setTimeout(() => sfx.win(), 900)
      finish(g)
      setTimeout(() => setShowEnd(true), 2300)
    } else {
      // closer guesses earn a closer look
      globe?.flyTo({ lon: club.lon, lat: club.lat, k: Math.max(3.2, 2.4 + ev.heat * 7) }, 1250)
    }
  }, [game, over, save, finish])

  const giveUp = () => {
    if (!game || over || !answer) return
    const g = { ...game, gaveUp: true }
    save(g)
    finish(g)
    globeRef.current?.flyTo({ lon: answer.lon, lat: answer.lat, k: 7 }, 1600)
    setTimeout(() => setShowEnd(true), 1700)
  }

  const another = () => {
    if (today === null) return
    const g = newGame('impossible', today, Math.random, game?.answer)
    bornAt.current = new Map()
    save(g)
    setFresh(null)
    setShowEnd(false)
    globeRef.current?.home()
  }

  const exclude = useMemo(() => new Set(game?.guesses ?? []), [game])
  const options = useMemo(() => (query.trim() ? suggest(query, level, exclude) : []), [query, level, exclude])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && options[active]) { e.preventDefault(); guess(options[active]) }
    else if (e.key === 'Escape') setQuery('')
  }

  const share = async () => {
    if (!game) return
    const text = shareText(game)
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    } catch { /* cancelled */ }
  }

  const toggleSound = () => { const m = !muted; setMute(m); setMuted(m); write(SOUND_KEY, m ? 'off' : 'on') }

  const best = sorted.find((g) => !g.correct)
  const levelInfo = LEVELS.find((l) => l.key === level)!
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0
  const avg = stats.guesses.length ? (stats.guesses.reduce((a, b) => a + b, 0) / stats.guesses.length).toFixed(1).replace('.', ',') : '-'

  return (
    <div className={styles.shell}>
      <div className={styles.topline}>
        <Link href="/leikjaherbergi" className={styles.back}><ArrowLeft size={15} /> Leikjaherbergið</Link>
        <div className={styles.tools}>
          <button type="button" onClick={toggleSound} aria-label={muted ? 'Kveikja á hljóði' : 'Slökkva á hljóði'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button type="button" onClick={() => setPanel(panel === 'stats' ? 'none' : 'stats')} aria-label="Tölfræði"><BarChart3 size={16} /></button>
          <button type="button" onClick={() => setPanel(panel === 'help' ? 'none' : 'help')} aria-label="Hvernig á að spila"><HelpCircle size={16} /></button>
        </div>
      </div>

      <header className={styles.head}>
        <p className={styles.kicker}><Crosshair size={13} /> HVAR ER VÖLLURINN?{today !== null && level !== 'impossible' ? ` · #${puzzleNumber(today)}` : ''}</p>
        <h1>Vallarleit</h1>
        <p className={styles.sub}>Giskaðu á lið. Fáni rís á heimavelli þess og liturinn segir hve nálægt þú ert vellinum sem leitað er að - og hve margir metrar skilja á milli.</p>
      </header>

      <nav className={styles.levels} aria-label="Erfiðleiki">
        {LEVELS.map((l) => (
          <button key={l.key} type="button" className={`${styles.level} ${level === l.key ? styles.levelOn : ''} ${styles[l.key]}`} onClick={() => setLevel(l.key)} aria-pressed={level === l.key}>
            <span className={styles.levelName}>{l.label}{statuses[l.key] !== 'open' && <i className={`${styles.dot} ${styles[statuses[l.key]]}`} />}</span>
            <span className={styles.levelSub}>{l.key === 'impossible' ? 'Endalaust' : 'Dagsins'}</span>
          </button>
        ))}
      </nav>

      <div className={styles.board}>
        <div className={styles.stage} ref={stageRef}>
          <canvas ref={canvasRef} className={styles.canvas} aria-label="Hnöttur með heimavöllum félaga" />
          <div className={styles.mapTools}>
            <button type="button" onClick={() => globeRef.current?.zoomBy(1.6)} aria-label="Þysja inn"><Plus size={16} /></button>
            <button type="button" onClick={() => globeRef.current?.zoomBy(1 / 1.6)} aria-label="Þysja út"><Minus size={16} /></button>
            <button type="button" onClick={() => globeRef.current?.home()} aria-label="Aftur til Evrópu"><Home size={15} /></button>
          </div>
          <div className={styles.legend} aria-hidden>
            <span>Kalt</span><i /><span>Sjóðheitt</span>
          </div>
          {tip && !picked && (
            <div className={styles.tip} style={{ left: tip.x, top: tip.y }}>
              <b>{tip.club.name}</b>
              <span>{where(tip.club)}</span>
            </div>
          )}
          {picked && !over && (
            <div className={styles.pick}>
              <div>
                <b>{picked.club.name}</b>
                <span>{picked.club.stadium ?? picked.club.city ?? where(picked.club)}</span>
              </div>
              <button type="button" className={styles.primary} onClick={() => guess(picked.club)}><FlagIcon size={14} /> Giska</button>
              <button type="button" className={styles.ghost} onClick={() => setPicked(null)} aria-label="Hætta við"><X size={15} /></button>
            </div>
          )}
          {game && over && showEnd && answer && (
            <div className={`${styles.end} ${victory ? styles.endWin : ''}`}>
              <button type="button" className={styles.close} onClick={() => setShowEnd(false)} aria-label="Loka"><X size={16} /></button>
              <p className={styles.endKicker}>{victory ? `FUNDINN Í ${game.guesses.length}. ÁGISKUN` : 'VÖLLURINN VAR'}</p>
              <h2>{answer.stadium ?? answer.name}</h2>
              <p className={styles.endClub}><b>{answer.name}</b> · {answer.city ? `${answer.city.split('(')[0].trim()}, ` : ''}{LEAGUE.get(answer.league)!.land}</p>
              <div className={styles.endStats}>
                <div><b>{stats.played}</b><span>Leikir</span></div>
                <div><b>{winPct}%</b><span>Sigrar</span></div>
                <div><b>{stats.streak}</b><span>Í röð</span></div>
                <div><b>{avg}</b><span>Meðaltal</span></div>
              </div>
              <div className={styles.endActions}>
                <button type="button" className={styles.primary} onClick={share}>{copied ? <><Check size={15} /> Afritað</> : <><Share2 size={15} /> Deila</>}</button>
                {level === 'impossible'
                  ? <button type="button" className={styles.secondary} onClick={another}><Shuffle size={15} /> Nýtt lið</button>
                  : <span className={styles.next}>Nýr völlur eftir <b>{countdown}</b></span>}
              </div>
            </div>
          )}
          {game && over && !showEnd && (
            <button type="button" className={styles.reopen} onClick={() => setShowEnd(true)}>{victory ? 'Sjá úrslit' : 'Sjá svarið'}</button>
          )}
        </div>

        <aside className={styles.side}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              ref={inputRef}
              className={styles.search}
              value={query}
              disabled={!game || over}
              placeholder={over ? (victory ? 'Völlurinn fundinn!' : 'Leik lokið') : level === 'impossible' ? 'Hvaða lið sem er í Evrópu…' : 'Lið í fimm stærstu deildunum…'}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKey}
              aria-label="Giska á lið"
              autoComplete="off"
              spellCheck={false}
            />
            {options.length > 0 && (
              <ul className={styles.options} role="listbox">
                {options.map((c, i) => (
                  <li key={c.id} role="option" aria-selected={i === active}>
                    <button type="button" className={i === active ? styles.optOn : ''} onMouseEnter={() => setActive(i)} onClick={() => guess(c)}>
                      <b>{c.name}</b><span>{where(c)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.summary}>
            <div><span>Ágiskanir</span><b>{guesses.length}</b></div>
            <div><span>Næst til þessa</span><b>{victory ? 'Rétt!' : best ? (best.sameGround ? 'Sami völlur' : formatKm(best.m)) : '-'}</b></div>
          </div>

          {!guesses.length && (
            <div className={styles.empty}>
              <p><b>{levelInfo.label}:</b> {levelInfo.blurb}.</p>
              <p>Skrifaðu nafn liðs, eða smelltu á punkt á kortinu. Hver punktur er heimavöllur.</p>
            </div>
          )}

          <ol className={styles.list}>
            {sorted.map((g) => (
              <li key={g.club.id} className={`${styles.row} ${g.club.id === fresh ? styles.rowNew : ''}`} style={{ ['--heat' as string]: g.correct ? '#f6c445' : g.sameGround ? '#ec4899' : heatColor(g.heat) }}>
                <i className={styles.chip} />
                <div className={styles.rowMain}>
                  <b>{g.club.name}</b>
                  <span>{g.correct ? (g.club.stadium ?? 'Rétti völlurinn') : g.sameGround ? 'Sami völlur, annað lið!' : where(g.club)}</span>
                </div>
                <div className={styles.rowDist}>
                  <b>{g.correct ? '0 m' : <Metres m={g.m} animate={g.club.id === fresh} />}</b>
                  <span>{g.correct ? 'Rétt!' : heatWord(g.m)}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.sideFoot}>
            {!over && guesses.length > 0 && <button type="button" className={styles.ghostWide} onClick={giveUp}><FlagIcon size={14} /> Gefast upp</button>}
            {level === 'impossible' && (over || guesses.length === 0) && <button type="button" className={styles.ghostWide} onClick={another}><RefreshCw size={14} /> {over ? 'Nýtt lið' : 'Annað lið'}</button>}
          </div>
        </aside>
      </div>

      {panel !== 'none' && (
        <div className={styles.modal} role="dialog" aria-modal onClick={() => setPanel('none')}>
          <div className={styles.card} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.close} onClick={() => setPanel('none')} aria-label="Loka"><X size={16} /></button>
            {panel === 'help' ? (
              <>
                <h2>Hvernig á að spila</h2>
                <p>Á hverjum degi er leitað að einum heimavelli í hverjum erfiðleika. Giskaðu á lið: fáni rís á heimavelli þess og sýnir hve langt hann er frá vellinum sem leitað er að.</p>
                <div className={styles.scale}><i /><span>Ískalt</span><span>Volgt</span><span>Heitt</span><span>Sjóðheitt</span></div>
                <ul>
                  <li><b>Létt, Miðlungs, Erfitt</b> - eitt lið á dag úr ensku, spænsku, ítölsku, þýsku og frönsku úrvalsdeildunum. Létt eru stóru nöfnin, Erfitt litlu félögin.</li>
                  <li><b>Ómögulegt</b> - hvaða lið sem er af {CLUBS.length} í efstu deildum allra {LEAGUES.length - 5} Evrópulandanna auk B-deilda stóru fimm. Nýtt lið eins oft og þú vilt.</li>
                  <li>Bleikur fáni þýðir sami völlur en rangt lið - Inter og AC Milan deila San Siro.</li>
                  <li>Dragðu til að snúa hnettinum, skrunaðu eða klíptu til að þysja.</li>
                </ul>
                <p className={styles.small}>Lið og vellir tímabilsins 2026-27 (2026 þar sem leikið er á almanaksári), samkvæmt Wikipedia og Wikidata.</p>
              </>
            ) : (
              <>
                <h2>Tölfræði · {levelInfo.label}</h2>
                <div className={styles.endStats}>
                  <div><b>{stats.played}</b><span>Leikir</span></div>
                  <div><b>{winPct}%</b><span>Sigrar</span></div>
                  <div><b>{stats.streak}</b><span>Í röð</span></div>
                  <div><b>{stats.best}</b><span>Best í röð</span></div>
                </div>
                <p className={styles.small}>Meðalfjöldi ágiskana í unnum leikjum: <b>{avg}</b></p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
