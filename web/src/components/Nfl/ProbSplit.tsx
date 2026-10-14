import { barColor } from '@/lib/nfl/format'
import type { NflTeam } from '@/lib/nfl/types'

/** Two-colour win-probability bar, away on the left as in the game rows. */
export function ProbSplit({ pHome, home, away, height = 4 }: { pHome: number; home: NflTeam | undefined; away: NflTeam | undefined; height?: number }) {
  const pa = Math.round((1 - pHome) * 1000) / 10
  return (
    <div className="flex gap-0.5 w-full overflow-hidden rounded-full" style={{ height }} role="img"
      aria-label={`Sigurlíkur: ${away?.abbr ?? 'útilið'} ${Math.round(pa)}%, ${home?.abbr ?? 'heimalið'} ${Math.round(100 - pa)}%`}>
      <span style={{ width: `${pa}%`, background: barColor(away) }} />
      <span style={{ width: `${100 - pa}%`, background: barColor(home) }} />
    </div>
  )
}
