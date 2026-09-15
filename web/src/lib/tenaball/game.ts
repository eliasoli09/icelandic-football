import { normalise } from '../topp10/normalise'
import { CLUBS, QUESTIONS, type Question } from './data'

export const TARGET = 10
export const LIVES = 3
export const SAVE_KEY = 'tenaball:round:v1'
export interface Round {
  questionId: string
  found: string[]
  lives: number
  status: 'playing' | 'won' | 'lost'
  lastSubmission: string | null
}
export interface Feedback { kind: 'correct' | 'incorrect' | 'duplicate' | 'empty' | 'over' | 'ignored'; clubId?: string }
export function newRound(q: Question): Round {
  return { questionId: q.id, found: [], lives: LIVES, status: 'playing', lastSubmission: null }
}
export function nextQuestion(id: string): Question {
  return QUESTIONS[(QUESTIONS.findIndex(q => q.id === id) + 1) % QUESTIONS.length]
}
export function submitAnswer(q: Question, state: Round, text: string, submission: string): { state: Round; feedback: Feedback } {
  if (state.status !== 'playing') return { state, feedback: { kind: 'over' } }
  if (state.lastSubmission === submission) return { state, feedback: { kind: 'ignored' } }
  const value = normalise(text)
  if (!value) return { state, feedback: { kind: 'empty' } }
  const matches = CLUBS.filter(c => [c.label, ...c.accept].some(a => normalise(a) === value))
  const club = matches.length === 1 ? matches[0] : undefined
  if (!club || !q.clubIds.includes(club.id)) {
    const lives = Math.max(0, state.lives - 1)
    return { state: { ...state, lives, status: lives ? 'playing' : 'lost', lastSubmission: submission }, feedback: { kind: 'incorrect' } }
  }
  if (state.found.includes(club.id)) return { state: { ...state, lastSubmission: submission }, feedback: { kind: 'duplicate', clubId: club.id } }
  const found = [...state.found, club.id]
  return { state: { ...state, found, status: found.length === TARGET ? 'won' : 'playing', lastSubmission: submission }, feedback: { kind: 'correct', clubId: club.id } }
}
export function restoreRound(raw: string | null): Round | null {
  try {
    if (!raw) return null
    const s = JSON.parse(raw) as Round
    const q = QUESTIONS.find(q => q.id === s.questionId)
    if (!q || !Array.isArray(s.found) || s.found.length > TARGET || new Set(s.found).size !== s.found.length || !s.found.every(id => q.clubIds.includes(id))) return null
    if (!Number.isInteger(s.lives) || s.lives < 0 || s.lives > LIVES || (s.lastSubmission !== null && typeof s.lastSubmission !== 'string')) return null
    if (s.found.length === TARGET && s.lives === 0) return null
    const status = s.found.length === TARGET ? 'won' : s.lives === 0 ? 'lost' : 'playing'
    return s.status === status ? s : null
  } catch { return null }
}
