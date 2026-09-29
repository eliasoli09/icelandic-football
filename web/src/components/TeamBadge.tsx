import type { TeamInfo } from '@/lib/teamColors'
import { displayColor } from '@/lib/teamColors'

/** Club crest (from KSÍ) with a club-colored dot as fallback. */
export function TeamBadge({
  info,
  size = 18,
}: {
  info: TeamInfo | undefined
  size?: number
}) {
  if (info?.crest) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={info.crest}
        alt=""
        width={size}
        height={size}
        className="inline-block object-contain align-[-3px]"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="inline-block rounded-full align-[-2px]"
      style={{ width: size - 6, height: size - 6, background: displayColor(info), margin: 3 }}
    />
  )
}
