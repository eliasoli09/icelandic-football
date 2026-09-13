export function formatUefaNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const [whole, fraction] = value.toFixed(digits).split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? `,${fraction}` : '')
}

export function probabilityLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < .005) return '<1%'
  return `${Math.round(value * 100)}%`
}

/** A common 0–100% scale, independent of the other outcome columns. */
export const probabilityWidth = (value: number | null) =>
  value === null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value * 100))

export const strengthScale = (values: number[]) =>
  Math.max(100, Math.ceil(Math.max(0, ...values.filter(Number.isFinite)) / 100) * 100)

export type StandingsSort = 'rank' | 'club' | 'rating' | 'proj_points' | 'p_top8' | 'p_playoff' | 'p_out'
export type SortDirection = 'asc' | 'desc'
export interface SortableStanding {
  rank: number; club: string; rating: number | null; proj_points: number
  p_top8: number; p_playoff: number; p_out: number
}
export function sortStandings<T extends SortableStanding>(rows: T[], key: StandingsSort, direction: SortDirection): T[] {
  return [...rows].sort((a,b) => {
    const x=a[key], y=b[key]
    if (x == null) return y == null ? a.rank-b.rank : 1
    if (y == null) return -1
    const order = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y,'is') : Number(x)-Number(y)
    return order * (direction === 'asc' ? 1 : -1) || a.rank-b.rank
  })
}
