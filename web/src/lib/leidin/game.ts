import { normalise } from '../topp10/normalise'
import { dailyOrder } from '../topp10/daily'
import QUESTIONS_JSON from './questions.json'
import NAMES_JSON from './names.json'
import type { Kind, LeidAnswer, LeidQuestion, Slot, Tier } from './types'
import { PERFECT, reached } from './road'

export const QUESTIONS = QUESTIONS_JSON as LeidQuestion[]
export const QUESTION_BY_ID: Record<string, LeidQuestion> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))
export const NAMES = NAMES_JSON as Record<Kind, string[]>

export const ROUND = 7
export const SECONDS = 25
/** 6 October 2026, the first road. Road numbers count from it. */
export const LAUNCH_DAY = 20732

export const roadNumber = (day: number) => day - LAUNCH_DAY + 1
export const storageKey = (day: number) => `leidin:v1:${day}`
export const KIT_KEY = 'leidin:treyja'
export const SOUND_KEY = 'leidin:hljod'

// ---------------------------------------------------------------- the day

/** A fixed scramble of an id, so an order does not follow the alphabet. */
function scramble(id: string): number {
  let h = 0x811c9dc5
  for (const ch of id) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * What a question is "about", so two about the same thing are kept apart:
 * the club for the club questions (scored for Fram 2024, scored against Fram
 * 2025), and the question without its season for the rest (late goals 2024,
 * late goals 2025).
 */
export function family(q: LeidQuestion): string {
  const parts = q.id.split('-')
  if (q.slot === 'lidid') return parts[1]
  return q.id.replace(/-\d{4}$/, '')
}

const bySlot = new Map<Slot, LeidQuestion[]>()
function inSlot(slot: Slot): LeidQuestion[] {
  if (!bySlot.has(slot)) {
    const items = QUESTIONS.filter((q) => q.slot === slot)
    const order = dailyOrder(items.map((q) => ({ id: q.id, competition: family(q) })))
    bySlot.set(slot, order.map((o) => QUESTION_BY_ID[o.id]))
  }
  return bySlot.get(slot)!
}

/** a seeded random number generator, the same numbers for the same seed */
function seeded(seed: string) {
  let h = scramble(seed)
  return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}
function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/** the Icelandic kinds; abroad ('utlond') is added on its own every other day */
const ICELAND: Slot[] = ['felog', 'ar', 'markaskorarar', 'lidid', 'serstakt', 'landslid']
/** no road asks more than this many questions of one kind */
const MOST_OF_A_KIND = 2
/** roads this far from the first one are practice roads, not days */
export const PRACTICE_FROM = 100_000

const roads: string[][] = []
const credit = new Map<Slot, number>(ICELAND.map((s) => [s, 0]))
const nextOf = new Map<Slot, number>()
const take = (slot: Slot) => {
  const list = inSlot(slot), i = nextOf.get(slot) ?? 0
  nextOf.set(slot, i + 1)
  return list[i % list.length]
}

/**
 * Lays out the roads day by day from the first one. Each kind walks through
 * its own fixed order and never goes round again until every question of the
 * kind has been asked; the kinds take turns in proportion to how many
 * questions they hold (a smooth weighted round robin), at most two of a kind
 * a day. So every day is a new road, and with 240 questions a question comes
 * back only after weeks.
 */
function layOut(n: number) {
  const weight = new Map(ICELAND.map((s) => [s, inSlot(s).length]))
  const sum = [...weight.values()].reduce((a, b) => a + b, 0)
  while (roads.length <= n) {
    const i = roads.length
    const abroad = i % 2 === 0 && inSlot('utlond').length > 0
    const used = new Map<Slot, number>()
    const ids: string[] = []
    while (ids.length < ROUND - (abroad ? 1 : 0)) {
      for (const s of ICELAND) credit.set(s, credit.get(s)! + weight.get(s)!)
      const open = ICELAND.filter((s) => (used.get(s) ?? 0) < MOST_OF_A_KIND && weight.get(s)! > 0)
      const best = open.reduce((a, b) => (credit.get(b)! > credit.get(a)! ? b : a))
      credit.set(best, credit.get(best)! - sum)
      used.set(best, (used.get(best) ?? 0) + 1)
      ids.push(take(best).id)
    }
    if (abroad) ids.push(take('utlond').id)
    roads.push(shuffle(ids, seeded(`leid-${LAUNCH_DAY + i}`)))
  }
}

/**
 * The seven questions everyone gets on a day: mostly Icelandic, one from
 * abroad every other day, in an order shuffled by the day. A practice road
 * (a "day" far from the real ones) is drawn at random the same way, one
 * question from each Icelandic kind and one from abroad.
 */
export function dailyRoad(day: number): LeidQuestion[] {
  const n = day - LAUNCH_DAY
  if (n < 0 || n >= PRACTICE_FROM) {
    const rand = seeded(`aefing-${day}`)
    const one = (slot: Slot) => { const l = inSlot(slot); return l[Math.floor(rand() * l.length)] }
    return shuffle([...ICELAND.map(one), one('utlond')], rand)
  }
  layOut(n)
  return roads[n].map((id) => QUESTION_BY_ID[id])
}

// ---------------------------------------------------------------- answers

/** Optimal string alignment distance: a swapped pair of letters is one slip. */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

const known = new Map<Kind, Set<string>>()
const knownNames = (kind: Kind) => {
  if (!known.has(kind)) known.set(kind, new Set(NAMES[kind].map(normalise)))
  return known.get(kind)!
}

/**
 * The answer a guess names, or null. An exact spelling first; failing that, a
 * typo of one letter (two in a long name) - but only when exactly one answer
 * is that close, and never when the guess is itself the name of someone else
 * the game knows: "Aron Jóhannsson" must not become "Aron Jónsson". Years are
 * never stretched: 2015 is one letter from 2016 and a different title.
 */
export function judge(q: LeidQuestion, text: string): LeidAnswer | null {
  const key = normalise(text)
  if (!key) return null
  const exact = q.answers.filter((a) => a.accept.includes(key))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1 || q.kind === 'year' || key.length < 5) return null
  if (knownNames(q.kind).has(key)) return null
  const room = key.length >= 10 ? 2 : 1
  const close = q.answers.filter((a) => a.accept.some((k) => Math.abs(k.length - key.length) <= room && k.length >= 5 && distance(k, key) <= room))
  return close.length === 1 ? close[0] : null
}

/** Names offered while typing: the same wide pool for every question of a kind. */
export function suggest(kind: Kind, text: string, limit = 6): string[] {
  const key = normalise(text)
  if (key.length < 2 || kind === 'year') return []
  const starts: string[] = [], inside: string[] = []
  for (const name of NAMES[kind]) {
    const n = normalise(name)
    if (n.startsWith(key)) starts.push(name)
    else if (n.split(' ').some((w) => w.startsWith(key)) || n.includes(` ${key}`)) inside.push(name)
    if (starts.length >= limit) break
  }
  return [...starts, ...inside].slice(0, limit)
}

// ---------------------------------------------------------------- tiers

export interface TierInfo { points: Tier | 0; name: string; line: string; color: string }

export const TIER_INFO: Record<Tier, TierInfo> = {
  10: { points: 10, name: 'Augljóst', line: 'Rétt, en þetta svar hefðu flestir sagt.', color: '#9aa7b8' },
  25: { points: 25, name: 'Algengt', line: 'Rétt, og nokkuð algengt svar.', color: '#6fcf6a' },
  50: { points: 50, name: 'Snjallt', line: 'Rétt! Ekki allir hefðu munað þetta.', color: '#4fb3ff' },
  75: { points: 75, name: 'Sjaldgæft', line: 'Rétt! Þetta muna fáir.', color: '#c77dff' },
  100: { points: 100, name: 'Gullmoli', line: 'Rétt! Nánast enginn annar hefði sagt þetta.', color: '#ffd23f' },
}
export const WRONG: TierInfo = { points: 0, name: 'Rangt', line: 'Þetta svar er ekki á listanum yfir rétt svör.', color: '#ff5a5f' }
export const TIMEOUT: TierInfo = { points: 0, name: 'Flautað af', line: 'Tíminn rann út áður en þú svaraðir.', color: '#ff5a5f' }

export const tierOf = (p: Pick): TierInfo =>
  p.outcome === 'right' ? TIER_INFO[p.points as Tier] : p.outcome === 'timeout' ? TIMEOUT : WRONG

/** The answers a reveal shows besides the player's: the obvious one, and a gem. */
export function showcase(q: LeidQuestion, except: string | null): { common: LeidAnswer | null; rare: LeidAnswer | null } {
  const others = q.answers.filter((a) => a.id !== except)
  const common = others.find((a) => a.points === 10) ?? null
  const top = Math.max(...others.map((a) => a.points))
  const rares = others.filter((a) => a.points === top && top > 10)
  return { common, rare: rares.length ? rares[scramble(q.id + except) % rares.length] : null }
}

// ---------------------------------------------------------------- a road

export interface Pick {
  questionId: string
  guess: string
  answerId: string | null
  points: number
  outcome: 'right' | 'wrong' | 'timeout'
}

export interface Run {
  day: number
  picks: Pick[]
  /** the question on screen when the page was left, counted as run out */
  open: number | null
}

export const newRun = (day: number): Run => ({ day, picks: [], open: null })
export const total = (run: Run) => run.picks.reduce((s, p) => s + p.points, 0)
export const isDone = (run: Run) => run.picks.length >= ROUND

/** The question is on screen and the clock is going: leaving now costs it. */
export function openQuestion(run: Run): Run {
  return { ...run, open: run.picks.length }
}

export function answer(run: Run, q: LeidQuestion, guess: string): { run: Run; pick: Pick } {
  const hit = judge(q, guess)
  const pick: Pick = hit
    ? { questionId: q.id, guess, answerId: hit.id, points: hit.points, outcome: 'right' }
    : { questionId: q.id, guess, answerId: null, points: 0, outcome: 'wrong' }
  return { run: { ...run, picks: [...run.picks, pick], open: null }, pick }
}

export function timeout(run: Run, q: LeidQuestion): { run: Run; pick: Pick } {
  const pick: Pick = { questionId: q.id, guess: '', answerId: null, points: 0, outcome: 'timeout' }
  return { run: { ...run, picks: [...run.picks, pick], open: null }, pick }
}

/**
 * A saved road, or null if it is damaged or belongs to another day. A
 * question left open (the page was closed or reloaded while the clock ran) is
 * scored as run out, so a reload is never a second look.
 */
export function restore(raw: string | null, day: number): Run | null {
  try {
    if (!raw) return null
    const s = JSON.parse(raw) as Run
    if (s.day !== day || !Array.isArray(s.picks) || s.picks.length > ROUND) return null
    const road = dailyRoad(day)
    for (const [i, p] of s.picks.entries()) {
      const q = road[i]
      if (!q || p.questionId !== q.id || !['right', 'wrong', 'timeout'].includes(p.outcome)) return null
      const a = q.answers.find((x) => x.id === p.answerId)
      if (p.outcome === 'right' ? !a || a.points !== p.points : p.points !== 0 || p.answerId !== null) return null
    }
    let run: Run = { day, picks: s.picks, open: null }
    if (s.open !== null && s.open === s.picks.length && s.open < ROUND) run = timeout(run, road[s.open]).run
    return run
  } catch { return null }
}

const SQUARE: Record<number, string> = { 0: '⬛', 10: '⬜', 25: '🟩', 50: '🟦', 75: '🟪', 100: '🟨' }

/** Spoiler-free: points per question and where the road ended, never the answers. */
export function shareText(run: Run, url: string): string {
  const score = total(run)
  return [
    `Leiðin á Laugardalsvöll #${roadNumber(run.day)}`,
    `${run.picks.map((p) => SQUARE[p.points] ?? '⬛').join('')} ${score}/${PERFECT}`,
    `Komst á ${reached(score).stadium.name}`,
    url,
  ].join('\n')
}
