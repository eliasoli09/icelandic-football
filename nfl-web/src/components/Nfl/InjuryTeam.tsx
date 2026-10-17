import { injuryLabel, STATUS_LABEL, STATUS_ORDER, type Injury } from '@/lib/nfl/injuries'
import type { NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'

const REPORT = new Set(['Out', 'Doubtful', 'Questionable'])
const COLOR: Record<string, string> = { Out: 'var(--loss)', Doubtful: 'var(--loss)', Questionable: 'var(--accent)' }
const byStatus = (a: Injury, b: Injury) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.position ?? '').localeCompare(b.position ?? '') || a.name.localeCompare(b.name)

/** One club's injury report for the round, worst first; the reserve list folded away under it. */
export function InjuryTeam({ team, abbr, rows }: { team: NflTeam | undefined; abbr: string; rows: Injury[] }) {
  const report = rows.filter((r) => REPORT.has(r.status)).sort(byStatus)
  const reserve = rows.filter((r) => !REPORT.has(r.status) && r.status !== 'Cut').sort(byStatus)
  return (
    <div className="grid gap-2 content-start min-w-0">
      <p className="flex items-center gap-2 font-semibold"><NflLogo team={team} size={22} /> {team?.name ?? abbr}</p>
      {report.length ? (
        <ul className="grid gap-1.5 text-sm">
          {report.map((r) => (
            <li key={r.player_id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 items-baseline">
              <span className="text-[11px] font-bold tracking-wide" style={{ color: COLOR[r.status] }}>{STATUS_LABEL[r.status].toUpperCase()}</span>
              <span className="min-w-0">
                <span className="font-medium">{r.name}</span>
                <span className="muted text-xs"> {r.position ?? ''}{r.injury ? ` · ${injuryLabel(r.injury)}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm muted">Enginn á meiðslaskýrslunni.</p>}
      {reserve.length > 0 && (
        <details className="text-xs">
          <summary className="muted cursor-pointer">{reserve.length} á meiðslalista eða varalista</summary>
          <ul className="mt-1.5 grid gap-1">
            {reserve.map((r) => <li key={r.player_id}><span className="font-medium">{r.name}</span> <span className="muted">{r.position ?? ''} · {STATUS_LABEL[r.status].toLowerCase()}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  )
}
