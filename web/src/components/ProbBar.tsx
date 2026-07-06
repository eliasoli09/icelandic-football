export function ProbBar({
  pHome,
  pDraw,
  pAway,
  compact = false,
}: {
  pHome: number
  pDraw: number
  pAway: number
  compact?: boolean
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const h = compact ? 'h-6' : 'h-8'
  return (
    <div>
      <div className={`flex w-full ${h} rounded-lg overflow-hidden text-xs font-semibold num`}>
        <div
          className="flex items-center justify-center text-white"
          style={{ width: pct(pHome), background: 'var(--accent)', minWidth: 34 }}
        >
          {pct(pHome)}
        </div>
        <div
          className="flex items-center justify-center"
          style={{ width: pct(pDraw), background: 'var(--surface-2)', color: 'var(--text-2)', minWidth: 34 }}
        >
          {pct(pDraw)}
        </div>
        <div
          className="flex items-center justify-center text-white"
          style={{ width: pct(pAway), background: 'var(--accent-2)', minWidth: 34 }}
        >
          {pct(pAway)}
        </div>
      </div>
      {!compact && (
        <div className="flex justify-between text-[11px] mt-1 muted">
          <span>Heimasigur</span>
          <span>Jafntefli</span>
          <span>Útisigur</span>
        </div>
      )}
    </div>
  )
}
