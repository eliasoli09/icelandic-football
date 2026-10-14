import type { NflTeam } from '@/lib/nfl/types'

export function NflLogo({ team, size = 24 }: { team: NflTeam | undefined; size?: number }) {
  if (!team) return <span style={{ width: size, height: size }} className="inline-block" aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element -- static local PNGs, no optimisation needed
  return <img src={team.logo} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
}
