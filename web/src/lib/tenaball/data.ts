import { LISTS } from '../topp10/lists'
import { dailyOrder } from '../topp10/daily'
import type { Kind, Region, Topp10List } from '../topp10/types'

export type Question = Topp10List

/**
 * Every question scripts/topp10/build.mts verified against two sources, in
 * the order the daily question walks through them. Any ten different answers
 * from a question's set win the round.
 */
export const QUESTIONS: Question[] = dailyOrder(LISTS)
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
