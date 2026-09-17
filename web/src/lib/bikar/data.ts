import data from './sides.json'
import type { CupSide, EuropeTie } from './types'

/** The verified greatest sides, best first. Built by scripts/bikar/teams.mts and squads.mts. */
export const SIDES = (data as unknown as { sides: CupSide[] }).sides
export const SOURCES = (data as unknown as { sources: { name: string; url: string }[] }).sources

const COMPETITION: Record<string, string> = {
  'European Cup / UEFA Champions League': 'Meistaradeildar Evrópu',
  'UEFA Europa League': 'Evrópudeildarinnar',
  'UEFA Conference League': 'Sambandsdeildarinnar',
}
const STAGE: [RegExp, string][] = [
  [/knockout phase play-offs/i, 'umspil útsláttarkeppni'],
  [/league phase|league stage/i, 'deildarkeppni'],
  [/group stage/i, 'riðlakeppni'],
  [/play-off/i, 'umspil'],
  [/third qualifying/i, '3. umferð forkeppni'],
  [/second qualifying/i, '2. umferð forkeppni'],
  [/first qualifying/i, '1. umferð forkeppni'],
  [/preliminary/i, 'forkeppni'],
  [/second round/i, '2. umferð'],
  [/first round/i, '1. umferð'],
]

/** "Komst í riðlakeppni Sambandsdeildarinnar", from the furthest European round that summer. */
export function europeLine(ties: EuropeTie[]): string | null {
  const last = ties[ties.length - 1]
  if (!last) return null
  const [competition, round] = last.round.split(': ')
  const stage = STAGE.find(([re]) => re.test(round))?.[1]
  const comp = COMPETITION[competition]
  if (!stage || !comp) return null
  return `Evrópa: ${last.through && !/deildarkeppni|riðlakeppni/.test(stage) ? 'vann einvígi í' : 'komst í'} ${stage} ${comp}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`

export function honoursLine(side: CupSide): string {
  const title = side.champion ? (side.cupDouble ? 'Íslands- og bikarmeistari' : 'Íslandsmeistari') : `${side.position}. sæti${side.cupDouble ? ', bikarmeistari' : ''}`
  const r = side.record
  return `${title} · ${plural(r.w, 'sigur', 'sigrar')}, ${plural(r.d, 'jafntefli', 'jafntefli')}, ${plural(r.l, 'tap', 'töp')} · ${r.gf}:${r.ga}`
}
