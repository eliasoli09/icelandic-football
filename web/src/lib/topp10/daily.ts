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

/** The same list for everyone on a given day, cycling through all of them. */
export function dailyList<T extends { id: string }>(lists: T[], date: Date): T | null {
  if (!lists.length) return null
  const ordered = [...lists].sort((a, b) => a.id.localeCompare(b.id))
  const n = ordered.length
  return ordered[((dayNumber(date) % n) + n) % n]
}
