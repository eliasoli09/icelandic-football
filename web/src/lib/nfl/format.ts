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
