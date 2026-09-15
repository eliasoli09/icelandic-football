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

/**
 * The order the daily question walks through. Each region is spread evenly
 * over the cycle, so a week never becomes seven league tables in a row, and
 * within a region the order is scrambled but fixed.
 */
export function dailyOrder<T extends { id: string; region?: string }>(lists: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const list of [...lists].sort((a, b) => scramble(a.id) - scramble(b.id) || a.id.localeCompare(b.id))) {
    const key = list.region ?? ''
    groups.set(key, [...(groups.get(key) ?? []), list])
  }
  return [...groups.keys()].sort()
    .flatMap((key, g) => groups.get(key)!.map((item, i, all) => ({ item, at: (i + 0.5) / all.length, g })))
    .sort((a, b) => a.at - b.at || a.g - b.g)
    .map((k) => k.item)
}

/** The same question for everyone on a given day, cycling through all of them. */
export function dailyList<T extends { id: string; region?: string }>(lists: T[], date: Date): T | null {
  if (!lists.length) return null
  const order = dailyOrder(lists)
  const n = order.length
  return order[((dayNumber(date) % n) + n) % n]
}
