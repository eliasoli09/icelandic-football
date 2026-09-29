import { LISTS } from '../topp10/lists'
import { dailyOrder } from '../topp10/daily'
import { orderedQuestion, type OrderedQuestion } from './order'
import type { Kind, Region } from '../topp10/types'

export type Question = OrderedQuestion

/** Ten fixed, ordered answers derived from the full verified source sets. */
export const QUESTIONS: Question[] = dailyOrder(LISTS).map(orderedQuestion)
export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))

export const REGIONS: { id: Region; label: string }[] = [
  { id: 'island', label: 'Ísland' },
  { id: 'enska', label: 'England' },
  { id: 'evropa', label: 'Evrópa' },
]

/** The words a round uses, which depend on whether it asks for clubs or players. */
export function words(kind: Kind) {
  return kind === 'club'
    ? {
        many: 'félög', ofMany: 'félögum', field: 'Nafn félags', placeholder: 'Skrifaðu félag …',
        prompt: 'Hvaða félag kemur fyrst upp í hugann?', already: 'er þegar komið', all: 'Öll tíu félögin fundin.',
      }
    : {
        many: 'leikmenn', ofMany: 'leikmönnum', field: 'Nafn leikmanns', placeholder: 'Skrifaðu leikmann …',
        prompt: 'Hvaða leikmaður kemur fyrst upp í hugann?', already: 'er þegar kominn', all: 'Allir tíu leikmennirnir fundnir.',
      }
}
