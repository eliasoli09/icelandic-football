export type SplitGroup = 'efri' | 'nedri'

interface PhasedMatch {
  phase: string
  home_team: number
  away_team: number
}

/**
 * Which clubs ended up in the upper and lower halves, read off the split
 * fixtures KSÍ publishes after round 22. Taking it from the fixtures rather
 * than re-deriving it from the table means the site follows KSÍ even if a
 * points deduction or tiebreak lands somewhere we would not have guessed.
 * Null until the split fixtures exist (and for leagues that never split —
 * lengjudeild's `umspil` is a knockout playoff, not a half).
 */
export function splitGroups(matches: PhasedMatch[]): Map<number, SplitGroup> | null {
  const groups = new Map<number, SplitGroup>()
  for (const m of matches) {
    if (m.phase !== 'efri' && m.phase !== 'nedri') continue
    groups.set(m.home_team, m.phase)
    groups.set(m.away_team, m.phase)
  }
  return groups.size ? groups : null
}

/**
 * Order a standings table by split half. The halves never mix again, so a
 * lower-half club cannot climb past 7th however many points it collects —
 * sorting on points alone would quietly misreport the league.
 * Input order is preserved within each half (it already carries the league's
 * points → goal difference → goals scored tiebreaks).
 */
export function applySplit<T extends { teamId: number }>(
  table: T[],
  groups: Map<number, SplitGroup> | null,
): (T & { group: SplitGroup | null })[] {
  if (!groups) return table.map((r) => ({ ...r, group: null }))
  const tagged = table.map((r) => ({ ...r, group: groups.get(r.teamId) ?? null }))
  const half = (g: SplitGroup | null) => (g === 'efri' ? 0 : g === 'nedri' ? 2 : 1)
  return tagged
    .map((r, i) => ({ r, i }))
    .sort((a, b) => half(a.r.group) - half(b.r.group) || a.i - b.i)
    .map(({ r }) => r)
}
