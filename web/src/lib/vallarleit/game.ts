import { normalise } from '../topp10/normalise'
import clubsData from './clubs.json'
import { LEAGUES, type LeagueDef } from './leagues'
import { distanceM, heat } from './geo'
import type { VClub } from './types'

export const CLUBS = clubsData as VClub[]
export const BY_ID = new Map(CLUBS.map((c) => [c.id, c]))
export const LEAGUE = new Map<string, LeagueDef>(LEAGUES.map((l) => [l.key, l]))

export type Level = 'easy' | 'medium' | 'hard' | 'impossible'
export const LEVELS: { key: Level; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Létt', blurb: 'Stórlið úr fimm stærstu deildunum' },
  { key: 'medium', label: 'Miðlungs', blurb: 'Rótgróin félög úr fimm stærstu deildunum' },
  { key: 'hard', label: 'Erfitt', blurb: 'Minni félögin í fimm stærstu deildunum' },
  { key: 'impossible', label: 'Ómögulegt', blurb: `Hvaða lið sem er af ${CLUBS.length} í ${LEAGUES.length} deildum Evrópu` },
]

/** 13 Oct 2026, the first Vallarleit */
export const LAUNCH_DAY = 20739
export const URL = 'https://islensk-fotbolti.vercel.app/vallarleit'

/**
 * The big five's clubs, best known first. Fame is the number of Wikipedia
 * language editions with an article on the club - Barcelona 154, Elversberg 36 -
 * which tracks "would people know where they play" better than results do.
 */
export const TOP5 = CLUBS.filter((c) => LEAGUE.get(c.league)?.top5).sort((a, b) => b.fame - a.fame || a.id.localeCompare(b.id))
const third = Math.round(TOP5.length / 3)
export const POOLS: Record<Exclude<Level, 'impossible'>, VClub[]> = {
  easy: TOP5.slice(0, third),
  medium: TOP5.slice(third, 2 * third),
  hard: TOP5.slice(2 * third),
}

/** the clubs a level lets you guess - and draws on the map */
export const guessable = (level: Level) => (level === 'impossible' ? CLUBS : TOP5)

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs]
  const rnd = mulberry(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const SEED: Record<Exclude<Level, 'impossible'>, number> = { easy: 1101, medium: 2202, hard: 3303 }
/**
 * Each daily level walks a fixed shuffle of its pool, so no club comes back
 * until every other club in the pool has had its day.
 */
export function dailyClub(level: Exclude<Level, 'impossible'>, day: number): VClub {
  const order = shuffled(POOLS[level], SEED[level])
  const i = (((day - LAUNCH_DAY) % order.length) + order.length) % order.length
  return order[i]
}

export const puzzleNumber = (day: number) => day - LAUNCH_DAY + 1

export function randomClub(rnd = Math.random, not?: string): VClub {
  for (;;) {
    const c = CLUBS[Math.floor(rnd() * CLUBS.length)]
    if (c.id !== not) return c
  }
}

// ---------------------------------------------------------------- a game

export interface Game {
  level: Level
  /** the day for daily levels, null for impossible */
  day: number | null
  answer: string
  guesses: string[]
  gaveUp?: boolean
}

export interface Guess {
  club: VClub
  m: number
  heat: number
  /** same ground, different club: Inter on San Siro when it is Milan */
  sameGround: boolean
  correct: boolean
}

export function evaluate(game: Game): Guess[] {
  const answer = BY_ID.get(game.answer)!
  return game.guesses.flatMap((id) => {
    const club = BY_ID.get(id)
    if (!club) return []
    const m = club.id === answer.id ? 0 : distanceM(club, answer)
    return [{ club, m, heat: club.id === answer.id ? 1 : heat(m), sameGround: club.id !== answer.id && m < 150, correct: club.id === answer.id }]
  })
}

export const won = (game: Game) => game.guesses.includes(game.answer)
export const isOver = (game: Game) => won(game) || !!game.gaveUp

export function addGuess(game: Game, id: string): Game {
  if (isOver(game) || game.guesses.includes(id) || !BY_ID.has(id)) return game
  return { ...game, guesses: [...game.guesses, id] }
}

export const storageKey = (level: Level, day: number | null) => (level === 'impossible' ? 'vallarleit:impossible' : `vallarleit:${level}:${day}`)
export const STATS_KEY = (level: Level) => `vallarleit:stats:${level}`

/** a saved game, only if it still makes sense against today's data */
export function restore(raw: string | null, level: Level, day: number | null): Game | null {
  if (!raw) return null
  try {
    const g = JSON.parse(raw) as Game
    if (g.level !== level || !BY_ID.has(g.answer) || !Array.isArray(g.guesses)) return null
    if (level !== 'impossible' && g.day !== day) return null
    return { ...g, guesses: g.guesses.filter((id) => BY_ID.has(id)) }
  } catch {
    return null
  }
}

export function newGame(level: Level, day: number, rnd = Math.random, not?: string): Game {
  if (level === 'impossible') return { level, day: null, answer: randomClub(rnd, not).id, guesses: [] }
  return { level, day, answer: dailyClub(level, day).id, guesses: [] }
}

// ---------------------------------------------------------------- stats

export interface Stats { played: number; won: number; streak: number; best: number; guesses: number[]; last?: number }
export const emptyStats = (): Stats => ({ played: 0, won: 0, streak: 0, best: 0, guesses: [] })

/** record a finished game once; `stamp` is the day, or a running id for impossible */
export function record(stats: Stats, game: Game, stamp: number): Stats {
  if (stats.last === stamp) return stats
  const w = won(game)
  const streak = w ? (game.level === 'impossible' || stats.last === stamp - 1 ? stats.streak + 1 : 1) : 0
  return {
    played: stats.played + 1,
    won: stats.won + (w ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    guesses: w ? [...stats.guesses, game.guesses.length].slice(-200) : stats.guesses,
    last: stamp,
  }
}

// ---------------------------------------------------------------- search

const haystack = new Map<string, string[]>(CLUBS.map((c) => [c.id, [c.name, ...c.aliases].map(normalise)]))

export function suggest(query: string, level: Level, exclude: Set<string>, limit = 8): VClub[] {
  const q = normalise(query)
  if (!q) return []
  const scored: { c: VClub; s: number }[] = []
  for (const c of guessable(level)) {
    if (exclude.has(c.id)) continue
    const names = haystack.get(c.id)!
    let s = -1
    for (const n of names) {
      if (n === q) s = Math.max(s, 4)
      else if (n.startsWith(q)) s = Math.max(s, 3)
      else if (n.split(' ').some((w) => w.startsWith(q))) s = Math.max(s, 2)
      else if (q.length >= 3 && n.includes(q)) s = Math.max(s, 1)
    }
    if (s >= 0) scored.push({ c, s })
  }
  return scored.sort((a, b) => b.s - a.s || b.c.fame - a.c.fame).slice(0, limit).map((x) => x.c)
}

// ---------------------------------------------------------------- sharing

const square = (g: Guess) => (g.correct ? '🏟️' : g.heat >= 0.8 ? '🟥' : g.heat >= 0.6 ? '🟧' : g.heat >= 0.4 ? '🟨' : '⬜')

export function shareText(game: Game): string {
  const list = evaluate(game)
  const label = LEVELS.find((l) => l.key === game.level)!.label
  const head = game.level === 'impossible' ? `Vallarleit · ${label}` : `Vallarleit #${puzzleNumber(game.day!)} · ${label}`
  const best = Math.min(...list.filter((g) => !g.correct).map((g) => g.m), Infinity)
  const line = won(game)
    ? `Fann völlinn í ${game.guesses.length}. ágiskun`
    : `Gafst upp eftir ${game.guesses.length} ágiskanir${Number.isFinite(best) ? `, næst ${Math.round(best / 1000)} km` : ''}`
  const squares = list.map(square)
  const rows: string[] = []
  for (let i = 0; i < squares.length; i += 8) rows.push(squares.slice(i, i + 8).join(''))
  return [head, line, ...rows, URL].join('\n')
}
