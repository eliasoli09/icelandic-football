import type { Answer, Topp10List } from '../topp10/types'

export type OrderedQuestion = Topp10List & { ordering: string }
const alphabetically = (a: Answer, b: Answer) => a.label.localeCompare(b.label, 'is')

/** Preserve the full verified source sets; only the Tenaball view selects ten. */
export function orderedQuestion(source: Topp10List): OrderedQuestion {
  let answers = [...source.answers]
  let question = source.question
  let ordering: string
  if (source.id.includes('-lokastada-')) {
    answers.sort((a, b) => parseInt(a.detail) - parseInt(b.detail))
    ordering = 'Sæti 1–10 í lokatöflu tímabilsins.'
  } else if (source.id.includes('-lid-')) {
    answers.sort(alphabetically)
    question = source.question.replace(/^Nefndu 10 af \d+ liðum/, 'Nefndu fyrstu 10 lið').replace(/\.$/, ' í stafrófsröð.')
    ordering = 'Fyrstu tíu í íslenskri stafrófsröð, eftir nöfnunum sem leikurinn notar.'
  } else if (source.id === 'island-markakongar') {
    answers.sort((a, b) => Number(a.detail.match(/\d{4}/)?.[0]) - Number(b.detail.match(/\d{4}/)?.[0]) || alphabetically(a, b))
    ordering = 'Elsta markakóngsár fyrst. Sama ár: íslensk stafrófsröð.'
  } else {
    const score = (a: Answer) => source.id === 'evropa-baedi-timabil'
      ? [...a.detail.matchAll(/\d+/g)].reduce((sum, n) => sum + Number(n[0]), 0)
      : parseInt(a.detail)
    answers.sort((a, b) => score(b) - score(a) || alphabetically(a, b))
    const goals = source.kind === 'player'
    ordering = `${goals ? 'Flest mörk' : 'Flestir titlar'} fyrst. Jafnt: íslensk stafrófsröð eftir nafni. Aðeins fyrstu tíu gilda.`
    if (!goals) {
      question = source.question.replace('Nefndu 10 félög', 'Nefndu 10 sigursælustu félög')
      if (source.id === 'evropa-baedi-timabil') ordering = 'Flestir titlar samtals á báðum tímabilum fyrst. Jafnt: íslensk stafrófsröð.'
    }
  }
  const context = source.context
    .replace(' Allir sem voru jafnir í 10. sæti gilda.', '')
    .replace('Tíu lið eru rétt, í hvaða röð sem er.', 'Þú mátt svara í hvaða röð sem er.')
  return { ...source, question, context, ordering, answers: answers.slice(0, 10) }
}
