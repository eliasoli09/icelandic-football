'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Gamepad2, Keyboard, Maximize2 } from 'lucide-react'
import styles from './Hausabolti.module.css'

/**
 * The game itself is a separate Phaser build served statically from
 * public/spil/hausabolti (source: the big-head-football repo, `npm run build:site`).
 * This page frames it in the site and hands it keyboard focus.
 */
export const GAME_SRC = '/spil/hausabolti/index.html'

export function Hausabolti() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [touchOnly, setTouchOnly] = useState(false)

  useEffect(() => {
    setTouchOnly(matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)
  }, [])

  const focusGame = () => frame.current?.focus()
  const fullscreen = () => { void frame.current?.requestFullscreen?.().then(focusGame).catch(() => {}) }

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <Link href="/leikjaherbergi" className={styles.back}><ArrowLeft size={13} aria-hidden /> Leikjaherbergið</Link>
        <p className={styles.kicker}><Gamepad2 size={13} aria-hidden /> HAUSABOLTI</p>
        <h1>Stórir hausar. Stór mörk.</h1>
        <p className={styles.subtitle}>
          Tveir á móti hvor öðrum á sama lyklaborðinu eða einn á móti tölvunni. Fyrstur í fimm mörk eða 90 sekúndur.
        </p>
      </header>

      {touchOnly && (
        <p className={styles.notice}><Keyboard size={15} aria-hidden /> Hausabolti er spilaður á lyklaborði. Opnaðu síðuna í tölvu til að spila.</p>
      )}

      <div className={styles.stage}>
        <iframe
          ref={frame}
          src={GAME_SRC}
          title="Hausabolti"
          className={styles.frame}
          allow="autoplay; fullscreen"
          onLoad={focusGame}
        />
      </div>

      <div className={styles.tools}>
        <div className={styles.keys}>
          <span><b>Leikmaður 1</b> A / D hreyfa · W hoppa · Bil sparka</span>
          <span><b>Leikmaður 2</b> ← / → hreyfa · ↑ hoppa · Enter sparka</span>
          <span><b>Esc</b> hlé</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={fullscreen}><Maximize2 size={14} aria-hidden /> Fullur skjár</button>
          <a className={styles.action} href={GAME_SRC} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden /> Opna sér</a>
        </div>
      </div>
    </div>
  )
}
