import type { Answer } from '../topp10/types'
import type { Question } from './data'
import type { Round } from './game'
import { CLUB_HINTS, GOLDEN_BOOT_CLUBS, PLAYER_COUNTRIES } from './hint-data'

export function hintDetails(question: Question, answer: Answer) {
  const first = { label: 'Fyrsti stafur', value: Array.from(answer.label)[0] }
  if (question.kind === 'club') {
    const club = CLUB_HINTS[answer.id]
    return [first, { label: 'Land', value: club?.country }, { label: 'Borg / bær', value: club?.city }]
  }
  const team = question.id === 'island-markakongar'
    ? GOLDEN_BOOT_CLUBS[answer.id]
    : answer.detail.match(/^\d+ (?:mörk|mark), (.+)$/)?.[1]
  return [first, { label: 'Þjóðerni', value: PLAYER_COUNTRIES[answer.id] }, { label: 'Félag á tímabilinu', value: team }]
}

export function requestHint(question: Question, round: Round, answerId: string): Round {
  if (round.questionId !== question.id || round.status !== 'playing' || round.found.includes(answerId)
    || !question.answers.some(a => a.id === answerId) || (round.hints[answerId] ?? 0) >= 3) return round
  return { ...round, hints: { ...round.hints, [answerId]: (round.hints[answerId] ?? 0) + 1 } }
}
