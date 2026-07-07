import { describe, expect, it } from 'vitest'
import { filterTransfers, groupByDay, type TransferItem } from '../src/lib/transfers'

const mk = (over: Partial<TransferItem>, id: number): TransferItem => ({
  id,
  published_at: '2026-07-06',
  headline: 'x',
  url: `https://www.fotbolti.net/news/${id}`,
  player: null,
  from_team: null,
  to_team: null,
  from_team_id: null,
  to_team_id: null,
  status: 'ordromur',
  scope: 'erlent',
  summary: null,
  ...over,
})

const items: TransferItem[] = [
  mk({ published_at: '2026-07-07', status: 'stadfest', scope: 'innanlands' }, 1),
  mk({ published_at: '2026-07-07', status: 'ordromur', scope: 'innanlands' }, 2),
  mk({ published_at: '2026-07-06', status: 'stadfest', scope: 'erlent' }, 3),
  mk({ published_at: '2026-07-05', status: 'ordromur', scope: 'islendingar_erlendis' }, 4),
]

describe('filterTransfers', () => {
  it('returns everything for allt/allt', () => {
    expect(filterTransfers(items, 'allt', 'allt')).toHaveLength(4)
  })
  it('filters by status', () => {
    expect(filterTransfers(items, 'stadfest', 'allt').map((t) => t.id)).toEqual([1, 3])
  })
  it('filters by scope', () => {
    expect(filterTransfers(items, 'allt', 'innanlands').map((t) => t.id)).toEqual([1, 2])
  })
  it('combines status and scope', () => {
    expect(filterTransfers(items, 'ordromur', 'islendingar_erlendis').map((t) => t.id)).toEqual([4])
  })
})

describe('groupByDay', () => {
  it('groups preserving order, newest day first', () => {
    const days = groupByDay(items)
    expect(days.map(([d]) => d)).toEqual(['2026-07-07', '2026-07-06', '2026-07-05'])
    expect(days[0][1].map((t) => t.id)).toEqual([1, 2])
  })
})
