const DAY = 86_400_000

/**
 * Days since the epoch, counted in UTC. Iceland keeps UTC all year with no
 * summer time, so this rolls over at midnight in Reykjavík for everyone.
 */
export function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY,
  )
}

/** A fixed scramble of an id, so the order does not follow the alphabet. */
function scramble(id: string): number {
  let h = 0x811c9dc5
  for (const ch of id) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

interface Ordered { id: string; region?: string; competition?: string }

/**
 * The competition without the season, so two Champions League finals are the
 * same thing to the rotation even when they are years apart. A competition
 * that carries no year is left as it is.
 */
const family = (competition = '') => competition.replace(/\s+\d{4}(?:\/\d{2,4})?$/, '').trim()

/**
 * The order the daily question walks through. Spreading by region alone left
 * four English league tables in a row, because a region holds many more of one
 * competition than another; the day is decided by competition instead, and the
 * region only breaks a tie. Two days running never ask about the same
 * competition unless nothing else is left, and the competition with most
 * questions is taken most often, so no group is saved up for the end.
 */
export function dailyOrder<T extends Ordered>(lists: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const list of [...lists].sort((a, b) => scramble(a.id) - scramble(b.id) || a.id.localeCompare(b.id))) {
    const key = family(list.competition) || list.region || ''
    groups.set(key, [...(groups.get(key) ?? []), list])
  }
  const order: T[] = []
  let lastKey = '', lastRegion: string | undefined
  while (order.length < lists.length) {
    const left = [...groups.entries()].filter(([, items]) => items.length)
    // anything but the competition just asked about, if there is anything else
    const allowed = left.filter(([key]) => key !== lastKey)
    const pool = allowed.length ? allowed : left
    const best = pool.sort((a, b) =>
      b[1].length - a[1].length ||
      Number(a[1][0].region === lastRegion) - Number(b[1][0].region === lastRegion) ||
      scramble(a[1][0].id) - scramble(b[1][0].id))[0]
    const item = best[1].shift()!
    order.push(item)
    lastKey = best[0]
    lastRegion = item.region
  }
  return order
}

/** The same question for everyone on a given day, cycling through all of them. */
export function dailyList<T extends Ordered>(lists: T[], date: Date): T | null {
  if (!lists.length) return null
  const order = dailyOrder(lists)
  const n = order.length
  return order[((dayNumber(date) % n) + n) % n]
}
