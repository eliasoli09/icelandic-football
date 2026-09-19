import type { CSSProperties } from 'react'
import styles from './Xi.module.css'

/**
 * A football shirt in the club's colours. The number sits over it as its own
 * text, not as part of the drawing, so it stays selectable and scales with the
 * page. The data gives one colour per club, so there are no kit patterns.
 */
export function Shirt({ number, color, ink, className = '', style }: {
  number: number
  color: string
  ink: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`${styles.shirt} ${className}`} style={{ ...style, ['--kit' as string]: color, ['--ink' as string]: ink }}>
      <svg viewBox="0 0 64 60" aria-hidden focusable="false">
        <path className={styles.kit} d="M22.5 2 16 4.5 2 12l5.5 11.5L14 20v38h36V20l6.5 3.5L62 12 48 4.5 41.5 2A10 10 0 0 1 32 9 10 10 0 0 1 22.5 2Z" />
        <path className={styles.kitShade} d="M32 9a10 10 0 0 0 9.5-7L48 4.5 62 12l-5.5 11.5L50 20v38H32Z" />
        <path className={styles.kitCollar} d="M22.5 2 32 9l9.5-7-3-1.4L32 5.6 25.5.6Z" />
      </svg>
      <span className={styles.number}>{number}</span>
    </span>
  )
}
