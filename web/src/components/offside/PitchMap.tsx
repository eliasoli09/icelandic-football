'use client'

import { IFAB, type PitchDims } from '@/lib/offside/pitch'
import type { OffsideResult, PitchPlayer } from '@/lib/offside/offside'
import { ROLE_COLOUR } from './draw'

/** Top-down view of the attacked half: goal on the right, u grows to the left. */
export function PitchMap({
  dims, players, labels, ballU, ballV, result, receiverId,
}: {
  dims: PitchDims
  players: PitchPlayer[]
  labels: Map<string, string>
  ballU: number | null
  ballV: number | null
  result: OffsideResult | null
  receiverId: string | null
}) {
  const half = dims.length / 2
  const W = dims.width / 2
  const X = (u: number) => half - u
  const Y = (v: number) => v + W
  const { boxDepth: bd, boxHalfWidth: bw, goalAreaDepth: gd, goalAreaHalfWidth: gw, circleRadius: r } = IFAB
  const line = 'rgba(255,255,255,0.7)'
  const arcHalf = Math.acos((bd - IFAB.penaltySpot) / r)
  const arcPt = (a: number) => `${X(IFAB.penaltySpot + r * Math.cos(a))} ${Y(r * Math.sin(a))}`
  const status = result?.verdicts.find((v) => v.id === receiverId)?.status
  return (
    <svg viewBox={`-3 -3 ${half + 6} ${dims.width + 6}`} className="w-full rounded-lg" role="img" aria-label="Yfirlitsmynd af vellinum">
      <rect x={-3} y={-3} width={half + 6} height={dims.width + 6} fill="#1f7a3f" />
      {Array.from({ length: Math.ceil(half / 5.25) }, (_, i) => (
        <rect key={i} x={X((i + 1) * 5.25)} y={0} width={5.25} height={dims.width} fill={i % 2 ? '#1d7340' : '#23843f'} />
      ))}
      <g fill="none" stroke={line} strokeWidth={0.25}>
        <rect x={0} y={0} width={half} height={dims.width} />
        <rect x={X(bd)} y={Y(-bw)} width={bd} height={2 * bw} />
        <rect x={X(gd)} y={Y(-gw)} width={gd} height={2 * gw} />
        <path d={`M ${arcPt(-arcHalf)} A ${r} ${r} 0 0 0 ${arcPt(arcHalf)}`} />
        <path d={`M 0 ${Y(-r)} A ${r} ${r} 0 0 1 0 ${Y(r)}`} />
        <rect x={half} y={Y(-IFAB.goalWidth / 2)} width={1.5} height={IFAB.goalWidth} fill="rgba(255,255,255,0.3)" />
      </g>
      <circle cx={X(IFAB.penaltySpot)} cy={Y(0)} r={0.3} fill={line} />

      {result?.lineU != null && (
        <line x1={X(result.lineU)} x2={X(result.lineU)} y1={-2} y2={dims.width + 2} stroke="#3d8bff" strokeWidth={0.45} />
      )}
      {players.map((p) => {
        const rec = p.id === receiverId
        return (
          <g key={p.id} opacity={p.role === 'ignore' ? 0.4 : 1}>
            {rec && (
              <line x1={X(p.u)} x2={X(p.u)} y1={-2} y2={dims.width + 2} stroke={status === 'offside' ? '#ff4d5a' : status === 'close' ? '#f5b700' : '#22c58b'} strokeWidth={0.35} strokeDasharray="1.2 0.8" />
            )}
            <circle cx={X(p.u)} cy={Y(p.v)} r={rec ? 1.4 : 1.05} fill={ROLE_COLOUR[p.role]} stroke={rec ? '#fff' : 'rgba(0,0,0,0.6)'} strokeWidth={rec ? 0.4 : 0.2} />
            <text x={X(p.u)} y={Y(p.v) - 1.8} fontSize={2} textAnchor="middle" fill="#fff" fontWeight={600}>
              {labels.get(p.id)}
            </text>
          </g>
        )
      })}
      {ballU != null && ballV != null && <circle cx={X(ballU)} cy={Y(ballV)} r={0.7} fill="#ffe14d" stroke="#000" strokeWidth={0.15} />}
    </svg>
  )
}
