import type { Level } from '../level'
import { QUESTIONS, QUESTION_BY_ID } from '../tenaball/data'
import { dailyKey, dailyQuestion, restoreRound, LEVEL_KEY as TENABALL_LEVEL } from '../tenaball/game'
import { PLAYERS, SCHEDULE } from '../hver/data'
import { dailyPlayer, restore as restoreHver, storageKey as hverKey, puzzleNumber, LEVEL_KEY as HVER_LEVEL } from '../hver/game'
import { MATCHES } from '../xi/matches'
import { dailyMatch, restore as restoreXi, solvedCount, storageKey as xiKey, LEVEL_KEY as XI_LEVEL } from '../xi/game'
import { isLevel } from '../level'

/** How far a person has got with today's puzzle. */
export type Progress = 'new' | 'playing' | 'won' | 'lost' | 'none'

export interface RoomCard {
  id: 'tenaball' | 'hver' | 'byrjunarlid' | 'bikar'
  title: string
  href: string
  blurb: string
  /** what today holds, with nothing given away */
  today: string
  progress: Progress
  /** the person's own standing in this game, when there is one */
  mine: string | null
}

/** Whatever the browser has saved; a stub in a test. */
export type Saved = (key: string) => string | null

const levelOf = (read: Saved, key: string): Level => {
  const saved = read(key)
  return isLevel(saved) ? saved : 'medium'
}

/**
 * The room as it stands for one person on one day: what each game is asking
 * today, and how far they have got with it. Nothing here names an answer.
 */
export function roomCards(day: number, read: Saved): RoomCard[] {
  const tenaLevel = levelOf(read, TENABALL_LEVEL)
  const question = dailyQuestion(day, tenaLevel)
  const round = restoreRound(read(dailyKey(day, tenaLevel)), question.id)

  const hverLevel = levelOf(read, HVER_LEVEL)
  const player = dailyPlayer(PLAYERS, day, hverLevel, SCHEDULE)
  const hver = restoreHver(read(hverKey(player)), player)

  const xiLevel = levelOf(read, XI_LEVEL)
  const match = dailyMatch(MATCHES, day, xiLevel)
  const xi = restoreXi(read(xiKey(match)), match)
  const found = xi ? solvedCount(match, xi, 'home') + solvedCount(match, xi, 'away') : 0

  const best = Math.max(Number(read('bikar:best')) || 0, Number(read('bikar:best:nutid')) || 0)

  return [
    {
      id: 'tenaball',
      title: 'Tenaball',
      href: '/topp10',
      blurb: 'Tíu rétt svör úr einni spurningu. Þrjár tilraunir.',
      today: `${question.competition} · ${question.title}`,
      progress: round ? (round.status === 'playing' ? 'playing' : round.status) : 'new',
      mine: round && round.status !== 'playing' ? `${round.found.length} af 10 fundust` : null,
    },
    {
      id: 'hver',
      title: 'Hver er maðurinn?',
      href: '/hver',
      blurb: 'Félögin á ferlinum birtast eitt af öðru. Hver er leikmaðurinn?',
      today: `Þraut #${puzzleNumber(day)}`,
      progress: hver ? (hver.status === 'playing' ? 'playing' : hver.status) : 'new',
      mine: hver && hver.status !== 'playing' ? `${hver.guesses.length} ${hver.guesses.length === 1 ? 'gisk' : 'gisk'}` : null,
    },
    {
      id: 'byrjunarlid',
      title: 'Byrjunarliðið',
      href: '/byrjunarlid',
      blurb: 'Frægur leikur, tuttugu og tvö nöfn. Manstu liðin?',
      // the clubs are not named here: one of them could be the answer to
      // another game's puzzle of the day, and the room must give nothing away
      today: `${match.competition} · ${match.stage}`,
      progress: found === 22 ? 'won' : found > 0 ? 'playing' : 'new',
      mine: found > 0 ? `${found} af 22 fundnir` : null,
    },
    {
      id: 'bikar',
      title: 'Bikarmeistari',
      href: '/bikar',
      blurb: 'Draftaðu ellefu og reyndu að vinna bikarinn gegn bestu liðum sögunnar.',
      today: 'Nýtt lið í hverri tilraun',
      progress: 'none',
      mine: best > 0 ? `Besta lið til þessa: styrkur ${best}` : null,
    },
  ]
}

/** How many of today's puzzles are behind this person. */
export const finishedToday = (cards: RoomCard[]) =>
  cards.filter((c) => c.progress === 'won' || c.progress === 'lost').length

/** Every question, player and match the room can offer, for the line under the title. */
export const roomSize = () => ({
  tenaball: QUESTIONS.length,
  hver: PLAYERS.length,
  byrjunarlid: MATCHES.length,
  answers: Object.values(QUESTION_BY_ID).reduce((n, q) => n + q.answers.length, 0),
})
