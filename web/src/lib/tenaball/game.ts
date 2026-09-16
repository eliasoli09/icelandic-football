import { dailyList, dailyOrder } from '../topp10/daily'
import { matchGuess } from '../topp10/match'
import { normalise } from '../topp10/normalise'
import type { Level } from '../level'
import { QUESTIONS, QUESTION_BY_ID, type Question } from './data'

export const TARGET = 10
/** wrong answers allowed: more on the easy questions, fewer on the hard */
export const LIVES_BY_LEVEL: Record<Level, number> = { easy: 5, medium: 3, hard: 2 }
export const livesFor = (q: Question) => LIVES_BY_LEVEL[q.level]
/** the level last chosen in this browser */
export const LEVEL_KEY = 'tenaball:level'
/** a free round, kept in this tab */
export const SAVE_KEY = 'tenaball:round:v3'
/** whether this tab was last playing the daily question or free rounds */
export const MODE_KEY = 'tenaball:mode'
/** the daily round at a level, kept in this browser for the rest of the day */
export const dailyKey = (day: number, level: Level) => `tenaball:daily:v2:${day}:${level}`

const DAY = 86_400_000

export interface Round {
  questionId: string
  /** answer ids, in the question’s fixed order */
  found: string[]
  lives: number
  hints: Record<string, number>
  status: 'playing' | 'won' | 'lost'
  lastSubmission: string | null
}
export interface Feedback { kind: 'correct' | 'incorrect' | 'duplicate' | 'empty' | 'over' | 'ignored'; answerId?: string }

export function newRound(q: Question): Round {
  return { questionId: q.id, found: [], hints: {}, lives: livesFor(q), status: 'playing', lastSubmission: null }
}

const byLevel = new Map<Level, Question[]>()
/** A level's questions in the order its daily question walks through them. */
export function questionsAt(level: Level): Question[] {
  if (!byLevel.has(level)) byLevel.set(level, dailyOrder(QUESTIONS.filter((q) => q.level === level)))
  return byLevel.get(level)!
}

/** Everyone gets the same question at a level on a given day (days counted in UTC). */
export function dailyQuestion(day: number, level: Level): Question {
  return dailyList(questionsAt(level), new Date(day * DAY))!
}

/**
 * Free play walks back through earlier days' questions at the same level, so
 * it never gives away tomorrow's.
 */
export function nextQuestion(id: string): Question {
  const level = QUESTION_BY_ID[id]?.level ?? 'medium'
  const pool = questionsAt(level)
  const i = pool.findIndex((q) => q.id === id)
  return pool[(i - 1 + pool.length) % pool.length]
}

export function submitAnswer(q: Question, state: Round, text: string, submission: string): { state: Round; feedback: Feedback } {
  if (state.status !== 'playing') return { state, feedback: { kind: 'over' } }
  if (state.lastSubmission === submission) return { state, feedback: { kind: 'ignored' } }
  const value = normalise(text)
  if (!value) return { state, feedback: { kind: 'empty' } }
  const hits = matchGuess(q, value)
  const answer = hits.length === 1 ? q.answers[hits[0]] : undefined
  if (!answer) {
    const lives = Math.max(0, state.lives - 1)
    return { state: { ...state, lives, status: lives ? 'playing' : 'lost', lastSubmission: submission }, feedback: { kind: 'incorrect' } }
  }
  if (state.found.includes(answer.id)) return { state: { ...state, lastSubmission: submission }, feedback: { kind: 'duplicate', answerId: answer.id } }
  const found = q.answers.filter(a => a.id === answer.id || state.found.includes(a.id)).map(a => a.id)
  return { state: { ...state, found, status: found.length === TARGET ? 'won' : 'playing', lastSubmission: submission }, feedback: { kind: 'correct', answerId: answer.id } }
}

/** A saved round, or null if it is damaged, or belongs to another question than `expected`. */
export function restoreRound(raw: string | null, expected?: string): Round | null {
  try {
    if (!raw) return null
    const s = JSON.parse(raw) as Round
    const q = QUESTION_BY_ID[s.questionId]
    if (!q || (expected !== undefined && s.questionId !== expected)) return null
    const ids = new Set(q.answers.map((a) => a.id))
    if (!Array.isArray(s.found) || s.found.length > TARGET || new Set(s.found).size !== s.found.length || !s.found.every((id) => ids.has(id))) return null
    if (!Number.isInteger(s.lives) || s.lives < 0 || s.lives > livesFor(q) || (s.lastSubmission !== null && typeof s.lastSubmission !== 'string')) return null
    // Old saves predate hints; adding an empty map preserves their progress.
    if (s.hints === undefined) s.hints = {}
    if (!s.hints || typeof s.hints !== 'object' || Array.isArray(s.hints)
      || Object.entries(s.hints).some(([id, stage]) => !ids.has(id) || !Number.isInteger(stage) || stage < 1 || stage > 3)) return null
    if (s.found.length === TARGET && s.lives === 0) return null
    const status = s.found.length === TARGET ? 'won' : s.lives === 0 ? 'lost' : 'playing'
    return s.status === status ? { ...s, found: q.answers.filter(a => s.found.includes(a.id)).map(a => a.id) } : null
  } catch { return null }
}

/** Spoiler-free: how many were found, never which. */
export function shareText(q: Question, round: Round, date: string | null, url: string): string {
  const n = round.found.length
  return [
    `Tenaball${date ? ` · ${date}` : ''}`,
    q.title,
    `${n}/${TARGET} ${'🟩'.repeat(n)}${'⬛'.repeat(TARGET - n)}`,
    url,
  ].join('\n')
}
