'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pause, Play } from 'lucide-react'
import { NflFootball } from './NflFootball'
import styles from './NflStadium.module.css'

/** The front page's header: the ball, the name and the three ways in. */
export function HomeHero() {
  const [paused, setPaused] = useState(false)
  // on an NFL Sunday the line above the title says so; set after load, so the server and browser agree
  const [sunday, setSunday] = useState(false)
  useEffect(() => { setSunday(new Date().getUTCDay() === 0) }, [])
  return (
    <section className={`${styles.hero} ${styles.heroHome}`} data-paused={paused}>
      <div className={styles.heroArt} aria-hidden="true"><NflFootball paused={paused} /></div>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{sunday ? 'ÞAÐ ER NFL-SUNNUDAGUR' : 'BANDARÍSKI FÓTBOLTINN'}</p>
        <h1>NFL</h1>
        <p className={styles.subtitle}>Spár, staðan, spáleikur og greinar, á íslensku og íslenskum tíma.</p>
        <div className={styles.filters}>
          <Link href="/leikir" aria-pressed="true">Leikirnir</Link>
          <Link href="/spa">Spáleikurinn</Link>
          <Link href="/spar">Spár</Link>
        </div>
      </div>
      <button className={styles.motionToggle} aria-pressed={paused} onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Spila hreyfingar' : 'Gera hlé á hreyfingum'}>
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </section>
  )
}
