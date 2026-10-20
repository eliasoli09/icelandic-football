import { useId } from 'react'
import { luminance, probLabel } from '@/lib/nfl/format'
import type { WpPoint } from '@/lib/nfl/winChart'
import type { NflTeam } from '@/lib/nfl/types'

const W = 300, H = 100

/** The club's colour that shows on the dark page: the secondary one when the main one is near black or navy. */
const visible = (t: NflTeam | undefined, fallback: string) => {
  if (!t) return fallback
  return luminance(t.color) >= 0.12 || luminance(t.color2) < luminance(t.color) ? t.color : t.color2
}
const close = (a: string, b: string) => {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) < 90
}

/**
 * The game's win chance over time, ESPN style: above the middle the home club
 * is ahead on the chance, below the away club, each in its colour, with ticks
 * where points were scored and a line at each quarter.
 */
export function WinChart({ points, home, away, homeAbbr, awayAbbr, pre = null, height = 120 }: { points: WpPoint[]; home: NflTeam | undefined; away: NflTeam | undefined; homeAbbr: string; awayAbbr: string; pre?: number | null; height?: number }) {
  const id = `wc${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const pts = [...(pre !== null && (points[0]?.progress ?? 1) > 0 ? [{ progress: 0, p_home: pre, home_score: 0, away_score: 0, status: 'NS' }] : []), ...points]
  if (pts.length < 2) return null
  const x = (p: number) => p * W
  const y = (p: number) => (1 - p) * H
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.progress).toFixed(1)} ${y(p.p_home).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const area = `${line} L${x(last.progress).toFixed(1)} ${H / 2} L${x(pts[0].progress).toFixed(1)} ${H / 2} Z`
  const scored = pts.filter((p, i) => i > 0 && (p.home_score !== pts[i - 1].home_score || p.away_score !== pts[i - 1].away_score))
  const hc = visible(home, '#2f6bff'), ac0 = visible(away, '#a855f7')
  // two clubs in the same colour: the away side goes grey
  const ac = /^#[0-9a-f]{6}$/i.test(hc) && /^#[0-9a-f]{6}$/i.test(ac0) && close(hc, ac0) ? '#9aa8c7' : ac0
  return (
    <figure className="grid gap-1" aria-label={`Sigurlíkur: ${homeAbbr} ${probLabel(last.p_home)}, ${awayAbbr} ${probLabel(1 - last.p_home)}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
          <defs>
            <clipPath id={`${id}t`}><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
            <clipPath id={`${id}b`}><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
          </defs>
          {[0.25, 0.5, 0.75].map((q) => <line key={q} x1={x(q)} x2={x(q)} y1="0" y2={H} stroke="var(--border)" vectorEffect="non-scaling-stroke" />)}
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--border-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={hc} opacity={0.45} clipPath={`url(#${id}t)`} />
          <path d={area} fill={ac} opacity={0.45} clipPath={`url(#${id}b)`} />
          {scored.map((p, i) => <line key={i} x1={x(p.progress)} x2={x(p.progress)} y1={H - 6} y2={H} stroke="var(--text-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
          <path d={line} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute left-1.5 top-1 text-[11px] font-bold num">{homeAbbr} {probLabel(last.p_home)}</span>
        <span className="absolute left-1.5 bottom-1 text-[11px] font-bold num">{awayAbbr} {probLabel(1 - last.p_home)}</span>
      </div>
      <figcaption className="grid grid-cols-4 text-[10px] muted text-center num">
        <span>1. lh</span><span>2. lh</span><span>3. lh</span><span>4. lh</span>
      </figcaption>
    </figure>
  )
}
