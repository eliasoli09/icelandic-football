import type { MatchEvent } from './types'
import { fetchPage } from './ksi'

const GOAL_PATH = 'M6.58 14.66'
const SUB_PATH = 'M12 7.5L14.5 5'
const YELLOW = 'bg-[#FAC83C]'
const RED = 'bg-[#DD3636]'

const unescape = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")

/**
 * Parse the events timeline of a KSÍ match page
 * (leikir-og-urslit/felagslid/leikur?id=N).
 *
 * Each event is a `<div class="match-event ..." data-event-id="...">` block.
 * Side: `l:justify-self-end` = home column, `l:justify-self-start` = away.
 * Type by icon: football svg path → goal, yellow/red colored rects → cards,
 * arrows svg → substitution (two player links: first shown = coming on).
 * Minute: last `N<span ...>’` occurrence before the block.
 */
export function parseEvents(html: string): MatchEvent[] {
  const events: MatchEvent[] = []
  const re = /<div class="match-event[^"]*"[^>]*data-event-id="(\d+)"/g
  const starts: { idx: number; eventId: number; cls: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    starts.push({ idx: m.index, eventId: Number(m[1]), cls: m[0] })
  }
  for (let i = 0; i < starts.length; i++) {
    const { idx, eventId, cls } = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1].idx : idx + 8000
    const block = html.slice(idx, Math.min(end, idx + 8000))
    const before = html.slice(Math.max(0, idx - 700), idx)

    const side: 'home' | 'away' = cls.includes('l:justify-self-end')
      ? 'home'
      : 'away'

    const minuteMatches = [...before.matchAll(/>(\d+)<span[^>]*>’<\/span>/g)]
    const minute = minuteMatches.length
      ? Number(minuteMatches[minuteMatches.length - 1][1])
      : 0

    const players = [
      ...block.matchAll(/leikmadur\?id=(\d+)"[^>]*>\s*([^<]+?)\s*</g),
    ].map((p) => ({ id: Number(p[1]), name: unescape(p[2]) }))
    if (players.length === 0) continue

    const text = block.replace(/<[^>]+>/g, ' ')
    const isOwnGoal = /sjálfsmark/i.test(text)
    const isPenalty = /víti/i.test(text)

    if (block.includes(YELLOW)) {
      events.push(ev(eventId, minute, 'yellow', players[0], side))
    } else if (block.includes(RED)) {
      events.push(ev(eventId, minute, 'red', players[0], side))
    } else if (block.includes(SUB_PATH)) {
      events.push(ev(eventId, minute, 'sub_in', players[0], side))
      if (players[1]) events.push(ev(eventId, minute, 'sub_out', players[1], side))
    } else if (block.includes(GOAL_PATH)) {
      const type = isOwnGoal ? 'owngoal' : isPenalty ? 'penalty' : 'goal'
      events.push(ev(eventId, minute, type, players[0], side))
    }
  }
  return events
}

function ev(
  eventId: number,
  minute: number,
  type: MatchEvent['type'],
  player: { id: number; name: string },
  side: 'home' | 'away',
): MatchEvent {
  return {
    eventId,
    minute,
    type,
    playerKsiId: player.id || null,
    playerName: player.name,
    side,
  }
}

/** Goals credited to a side (own goals count for the opposite side). */
export function goalsFor(events: MatchEvent[], side: 'home' | 'away'): number {
  const other = side === 'home' ? 'away' : 'home'
  return events.filter(
    (e) =>
      ((e.type === 'goal' || e.type === 'penalty') && e.side === side) ||
      (e.type === 'owngoal' && e.side === other),
  ).length
}

export function validateEvents(
  events: MatchEvent[],
  score: { homeGoals: number; awayGoals: number },
): string[] {
  const warnings: string[] = []
  const h = goalsFor(events, 'home')
  const a = goalsFor(events, 'away')
  if (h !== score.homeGoals)
    warnings.push(`home goals from events ${h} != score ${score.homeGoals}`)
  if (a !== score.awayGoals)
    warnings.push(`away goals from events ${a} != score ${score.awayGoals}`)
  return warnings
}

export async function fetchMatchEvents(ksiId: number): Promise<MatchEvent[]> {
  const html = await fetchPage(
    `https://www.ksi.is/leikir-og-urslit/felagslid/leikur?id=${ksiId}`,
  )
  return parseEvents(html)
}
