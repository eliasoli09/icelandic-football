export type TransferStatus = 'stadfest' | 'ordromur'
export type TransferScope = 'innanlands' | 'islendingar_erlendis' | 'erlent'

export interface TransferItem {
  id: number
  published_at: string
  headline: string
  url: string
  player: string | null
  from_team: string | null
  to_team: string | null
  from_team_id: number | null
  to_team_id: number | null
  status: TransferStatus
  scope: TransferScope
  summary: string | null
}

export const SCOPE_LABELS: Record<TransferScope, string> = {
  innanlands: 'Ísland',
  islendingar_erlendis: 'Íslendingar erlendis',
  erlent: 'Erlent',
}

export const STATUS_LABELS: Record<TransferStatus, string> = {
  stadfest: 'Staðfest',
  ordromur: 'Orðrómur',
}

export function filterTransfers(
  items: TransferItem[],
  status: TransferStatus | 'allt',
  scope: TransferScope | 'allt',
): TransferItem[] {
  return items.filter(
    (t) =>
      (status === 'allt' || t.status === status) &&
      (scope === 'allt' || t.scope === scope),
  )
}

/** Group by publish date, newest day first; input is assumed pre-sorted desc. */
export function groupByDay(items: TransferItem[]): [string, TransferItem[]][] {
  const byDay = new Map<string, TransferItem[]>()
  for (const t of items) {
    byDay.set(t.published_at, [...(byDay.get(t.published_at) ?? []), t])
  }
  return [...byDay]
}
