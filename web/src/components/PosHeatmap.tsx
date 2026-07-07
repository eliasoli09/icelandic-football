export function PosHeatmap({
  rows,
  middleLabel = 'Evrópa',
}: {
  rows: { team: string; posProbs: number[]; pTitle: number; pEurope: number; pRelegation: number }[]
  middleLabel?: string
}) {
  const n = rows[0]?.posProbs.length ?? 12
  const cell = (p: number) => {
    const alpha = Math.min(1, p * 2.2)
    return (
      <td
        className="text-center text-[11px] num px-0.5 py-1.5"
        style={{
          background: p > 0.005 ? `rgba(77, 141, 255, ${alpha})` : 'transparent',
          color: alpha > 0.55 ? '#fff' : 'var(--text-2)',
        }}
      >
        {p >= 0.005 ? Math.round(p * 100) : ''}
      </td>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="muted text-[11px]">
            <th className="text-left py-1 pr-2 font-medium">Lið</th>
            {Array.from({ length: n }, (_, i) => (
              <th key={i} className="font-medium px-0.5">{i + 1}</th>
            ))}
            <th className="px-1.5 font-medium">Meistari</th>
            <th className="px-1.5 font-medium">{middleLabel}</th>
            <th className="px-1.5 font-medium">Fall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{r.team}</td>
              {r.posProbs.map((p, i) => (
                <PosCell key={i} p={p} />
              ))}
              <td className="text-center text-xs num font-semibold" style={{ color: 'var(--accent)' }}>
                {pct(r.pTitle)}
              </td>
              <td className="text-center text-xs num font-semibold" style={{ color: 'var(--win)' }}>
                {pct(r.pEurope)}
              </td>
              <td className="text-center text-xs num font-semibold" style={{ color: 'var(--loss)' }}>
                {pct(r.pRelegation)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  function PosCell({ p }: { p: number }) {
    return cell(p)
  }
}

const pct = (p: number) =>
  p >= 0.995 ? '100%' : p >= 0.01 ? `${Math.round(p * 100)}%` : p > 0 ? '<1%' : '—'
