import type { Answer, Topp10List } from '../topp10/types'

export type OrderedQuestion = Topp10List & { ordering: string }
const alphabetically = (a: Answer, b: Answer) => a.label.localeCompare(b.label, 'is')

/** What a player question counts, read from the word after the number: "34 leikir á 6 mótum". */
function mostOf(detail: string) {
  if (/^\d+ landsleik/.test(detail)) return 'Flestir landsleikir'
  if (/^\d+ (?:leikur|leikir)/.test(detail)) return 'Flestir leikir'
  if (/^\d+ mínút/.test(detail)) return 'Flestar mínútur'
  return 'Flest mörk'
}

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
    const players = source.kind === 'player'
    ordering = `${players ? mostOf(answers[0].detail) : 'Flestir titlar'} fyrst. Jafnt: íslensk stafrófsröð eftir nafni. Aðeins fyrstu tíu gilda.`
    if (!players) {
      question = source.question.replace('Nefndu 10 félög', 'Nefndu 10 sigursælustu félög')
      if (source.id === 'evropa-baedi-timabil') ordering = 'Flestir titlar samtals á báðum tímabilum fyrst. Jafnt: íslensk stafrófsröð.'
    }
  }
  const context = source.context
    .replace(' Allir sem voru jafnir í 10. sæti gilda.', '')
    .replace(' Efstu tíu, og allir jafnir þeim tíunda.', '')
    .replace('Tíu lið eru rétt, í hvaða röð sem er.', 'Þú mátt svara í hvaða röð sem er.')
  return { ...source, question, context, ordering, answers: answers.slice(0, 10) }
}
