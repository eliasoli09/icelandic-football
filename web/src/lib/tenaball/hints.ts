import type { Answer } from '../topp10/types'
import type { Question } from './data'
import type { Round } from './game'
import { CLUB_HINTS, GOLDEN_BOOT_CLUBS, OTHER_HINTS, PLAYER_COUNTRIES } from './hint-data'

export function hintDetails(question: Question, answer: Answer) {
  const first = { label: 'Fyrsti stafur', value: Array.from(answer.label)[0] }
  if (question.kind === 'club') {
    const club = CLUB_HINTS[answer.id]
    return [first, { label: 'Land', value: club?.country }, { label: 'Borg / bær', value: club?.city }]
  }
  const nationality = { label: 'Þjóðerni', value: PLAYER_COUNTRIES[answer.id] }
  // a career, not a season: the third hint is whatever that question can say
  const other = OTHER_HINTS[question.id]
  if (other) return [first, nationality, { label: other.label, value: other.values[answer.id] }]
  const team = question.id === 'island-markakongar'
    ? GOLDEN_BOOT_CLUBS[answer.id]
    : answer.detail.match(/^\d+ (?:mörk|mark), (.+)$/)?.[1]
  return [first, nationality, { label: 'Félag á tímabilinu', value: team }]
}

export function requestHint(question: Question, round: Round, answerId: string): Round {
  if (round.questionId !== question.id || round.status !== 'playing' || round.found.includes(answerId)
    || !question.answers.some(a => a.id === answerId) || (round.hints[answerId] ?? 0) >= 3) return round
  return { ...round, hints: { ...round.hints, [answerId]: (round.hints[answerId] ?? 0) + 1 } }
}
