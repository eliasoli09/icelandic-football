'use client'

import type { CSSProperties } from 'react'
import type { ScoreKind } from '@/lib/nfl/celebrations'
import { effect } from './Effects'
import { GlyphMark } from './Glyphs'
import { themeFor } from './themes'
import './celebrate.css'

export interface CelebrationProps {
  kind: ScoreKind
  team: string
  logo: string
  /** "HOU 34-31 JAX · 4. lh 2:11" */
  score?: string
  play?: string
}

/** The word, with the club's mark for the A of MARK. */
const WORD: Record<ScoreKind, [string, string]> = { TD: ['SNERTIM', 'RK'], FG: ['VALLARM', 'RK'] }

/**
 * One score banner, about 4.8 s from open to close: the bar opens on the club's
 * colour, the logo crosses it and leaves the word behind, the club's effect plays
 * and the score drops in underneath. Mount it to play it; it plays once.
 */
export function Celebration({ kind, team, logo, score, play }: CelebrationProps) {
  const th = themeFor(team)
  const fx = effect(th.effect, th, team)
  const [a, b] = WORD[kind]
  const vars = { '--c1': th.c1, '--c2': th.c2, '--ink': th.ink, '--word': th.word } as CSSProperties
  return (
    <div className="cel" style={vars} role="status" aria-label={`${kind === 'TD' ? 'Snertimark' : 'Vallarmark'}: ${team}${score ? `, ${score}` : ''}`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="cel-rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="3.2" /></filter>
      </svg>
      <div className="cel-stage" data-type={th.type} style={{ animation: fx.stage?.join(', ') }}>
        <div className="cel-bar">
          <div className="cel-bg" />
          {fx.under && <div className="cel-fx clip under">{fx.under}</div>}
          <div className="cel-slash" />
          <span className="cel-abbr" aria-hidden>{team}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- static local PNG */}
          <img className="cel-slot" src={logo} alt="" />
          <div className="cel-word" data-type={th.type} aria-hidden><span className="cel-t">{a}</span><span className="cel-g"><GlyphMark glyph={th.glyph} size="0.95em" /></span><span className="cel-t">{b}</span></div>
          {fx.clip && <div className="cel-fx clip">{fx.clip}</div>}
          {fx.over && <div className="cel-fx">{fx.over}</div>}
          {/* eslint-disable-next-line @next/next/no-img-element -- static local PNG */}
          <img className="cel-runner" src={logo} alt="" />
        </div>
      </div>
      {score && <div className="cel-chip">{score}</div>}
      {play && <div className="cel-play">{play}</div>}
    </div>
  )
}
