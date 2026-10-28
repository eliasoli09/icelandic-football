import type { Criterion } from './standings'
import type { NflGame } from './types'

// Formatted by hand: Node and the browser disagree on is-IS number output.
const dec = (n: number) => String(n).replace('.', ',')

/** nflverse spread_line is positive when the home side is favoured. */
export function spreadLabel(g: Pick<NflGame, 'home' | 'away' | 'spread_line'>): string | null {
  if (g.spread_line === null) return null
  if (g.spread_line === 0) return 'Jafnt'
  const fav = g.spread_line > 0 ? g.home : g.away
  return `${fav} −${dec(Math.abs(g.spread_line))}`
}

export const totalLabel = (t: number) => dec(t)
export const pctLabel = (p: number) => p.toFixed(3).replace('.', ',')
export const diffLabel = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

export const REASON_LABEL: Record<Criterion, string> = {
  h2h: 'raðað eftir innbyrðis viðureignum',
  division: 'raðað eftir árangri í riðli',
  common: 'raðað eftir árangri gegn sameiginlegum mótherjum',
  conference: 'raðað eftir árangri í deild',
  sov: 'raðað eftir styrk sigra',
  diff: 'raðað eftir stigamismun',
  alpha: 'jafnt á öllu, raðað eftir stafrófi',
}

export const probLabel = (p: number) => `${Math.round(p * 100)}%`

/** The model's margin on the same scale as Vegas, rounded to the half point. */
export const modelSpreadLabel = (home: string, away: string, spread: number) =>
  spreadLabel({ home, away, spread_line: Math.round(spread * 2) / 2 })

export const luminance = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0.5
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The club colour that will show on both themes: navy and black vanish on the dark one. */
export function barColor(team: { color: string; color2: string } | undefined): string {
  if (!team) return 'var(--text-2)'
  const ok = (c: string) => { const l = luminance(c); return l > 0.12 && l < 0.85 }
  return ok(team.color) ? team.color : ok(team.color2) ? team.color2 : 'var(--text-2)'
}

/** Elo movement with an arrow; a change that rounds to zero gets neither arrow nor colour. */
export function eloMove(change: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  const r = Math.round(change)
  if (r === 0) return { text: '0', dir: 'flat' }
  return r > 0 ? { text: `▲ ${r}`, dir: 'up' } : { text: `▼ ${-r}`, dir: 'down' }
}

/** Fantasy points to one decimal, Icelandic style: 1.234,5 and −12,3 (by hand, Gildrur 30). */
export function pointsLabel(x: number): string {
  const [int, frac] = Math.abs(x).toFixed(1).split('.')
  const s = `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`
  return x < 0 && s !== '0,0' ? `−${s}` : s
}
