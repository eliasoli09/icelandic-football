'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Clock, Gamepad2, Trophy } from 'lucide-react'
import { dayNumber } from '@/lib/topp10/daily'
import { untilMidnight } from '@/lib/hver/game'
import { finishedToday, roomCards, roomSize, type Progress, type RoomCard } from '@/lib/room/today'
import { loadBoard } from '@/lib/leaderboard/store'
import { rank, type Row } from '@/lib/leaderboard/rank'
import styles from './Room.module.css'

const STATUS: Record<Progress, { label: string; kind: string } | null> = {
  new: { label: 'Óspiluð', kind: 'open' },
  playing: { label: 'Í gangi', kind: 'playing' },
  won: { label: 'Unnin', kind: 'won' },
  lost: { label: 'Lokið', kind: 'lost' },
  none: null,
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function GameRoom() {
  const [cards, setCards] = useState<RoomCard[] | null>(null)
  const [left, setLeft] = useState(0)
  const [top, setTop] = useState<Row[]>([])
  const size = roomSize()

  useEffect(() => {
    // the room is drawn from what this browser has saved, so it is built here
    const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
    const draw = () => setCards(roomCards(dayNumber(new Date()), read))
    draw()
    const tick = () => { const now = new Date(); const ms = untilMidnight(now); setLeft(ms); if (ms > 86_399_000) draw() }
    tick()
    const timer = setInterval(tick, 1000)
    void loadBoard().then((rows) => setTop(rank(rows, 'won').slice(0, 3))).catch(() => setTop([]))
    return () => clearInterval(timer)
  }, [])

  const done = cards ? finishedToday(cards) : 0
  const daily = cards ? cards.filter((c) => c.progress !== 'none').length : 3

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <p className={styles.kicker}><Gamepad2 size={13} aria-hidden /> LEIKJAHERBERGIÐ</p>
        <h1>Fjórar þrautir. Einn völlur.</h1>
        <p className={styles.subtitle}>
          Allir leikir Besta spáin á einum stað: {size.tenaball} Tenaball-þrautir, {size.hver} leikmenn í Hver er maðurinn,
          {' '}{size.byrjunarlid} frægir leikir í Byrjunarliðinu og bikarkeppni sem er aldrei eins.
        </p>
        <div className={styles.bar}>
          <span className={styles.count} aria-live="polite">{cards ? `${done} af ${daily} þrautum dagsins kláraðar` : 'Sæki stöðuna þína …'}</span>
          <span className={styles.clock}><Clock size={13} aria-hidden /> Nýjar þrautir eftir <b>{clock(left)}</b></span>
        </div>
      </header>

      <ul className={styles.grid}>
        {(cards ?? PLACEHOLDERS).map((card) => {
          const status = STATUS[card.progress]
          return (
            <li key={card.id}>
              <Link href={card.href} className={`${styles.card} ${styles[card.id]}`}>
                <div className={styles.cardHead}>
                  <h2>{card.title}</h2>
                  {status && <span className={`${styles.chip} ${styles[status.kind]}`}>
                    {card.progress === 'won' && <Check size={12} aria-hidden />}{status.label}
                  </span>}
                </div>
                <p className={styles.blurb}>{card.blurb}</p>
                <p className={styles.today}><span>Í DAG</span> {cards ? card.today : '…'}</p>
                <p className={styles.mine}>{card.mine ?? ' '}</p>
                <span className={styles.go}>Spila <ArrowRight size={15} aria-hidden /></span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link href="/hausabolti" className={styles.arcade}>
        <span className={styles.arcadeHeads} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ARCADE_HEADS.map((id) => <img key={id} src={`/spil/hausabolti/assets/players/p${id}_head.png`} alt="" width={52} height={64} loading="lazy" />)}
        </span>
        <span className={styles.arcadeText}>
          <span className={styles.arcadeKicker}>SPILASALURINN</span>
          <span className={styles.arcadeTitle}>Hausabolti</span>
          <span className={styles.arcadeBlurb}>Stórir hausar, eitt lyklaborð. Tveir saman eða einn á móti tölvunni.</span>
        </span>
        <span className={styles.go}>Spila <ArrowRight size={15} aria-hidden /></span>
      </Link>

      <section className={styles.board} aria-label="Efst á stigatöflunni">
        <div className={styles.boardHead}>
          <h2><Trophy size={16} aria-hidden /> Efst á stigatöflunni</h2>
          <Link href="/stigatafla" className={styles.boardLink}>Öll taflan <ArrowRight size={14} aria-hidden /></Link>
        </div>
        {top.length === 0
          ? <p className={styles.empty}>Enginn er kominn á töfluna ennþá. Kláraðu þraut og skráðu þig - sætið er laust.</p>
          : <ol className={styles.top}>
              {top.map((row, i) => (
                <li key={row.id}><span className={styles.place}>{i + 1}</span><span className={styles.name}>{row.name}</span>
                  <span className={styles.stat}>{row.won} sigrar</span><span className={styles.pct}>{row.winPct}%</span></li>
              ))}
            </ol>}
      </section>
    </div>
  )
}

/** Heads shown on the Hausabolti banner; the game ships them in public/spil/hausabolti. */
const ARCADE_HEADS = [2, 3, 6]

/** The shape of the room before the browser has been read, so nothing jumps. */
const PLACEHOLDERS: RoomCard[] = [
  { id: 'tenaball', title: 'Tenaball', href: '/topp10', blurb: 'Tíu rétt svör úr einni spurningu. Þrjár tilraunir.', today: '…', progress: 'none', mine: null },
  { id: 'hver', title: 'Hver er maðurinn?', href: '/hver', blurb: 'Félögin á ferlinum birtast eitt af öðru. Hver er leikmaðurinn?', today: '…', progress: 'none', mine: null },
  { id: 'byrjunarlid', title: 'Byrjunarliðið', href: '/byrjunarlid', blurb: 'Frægur leikur, tuttugu og tvö nöfn. Manstu liðin?', today: '…', progress: 'none', mine: null },
  { id: 'bikar', title: 'Bikarmeistari', href: '/bikar', blurb: 'Draftaðu ellefu og reyndu að vinna bikarinn gegn bestu liðum sögunnar.', today: '…', progress: 'none', mine: null },
]
