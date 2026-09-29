/**
 * Pitch geometry in "attack coordinates":
 *   u = distance (m) from the goal line being attacked, growing into the field
 *   v = lateral offset (m) from the pitch's long axis; negative = far touchline
 *       (top of a normal broadcast frame), positive = near touchline.
 *
 * Offside only ever compares distances to the attacked goal line, so working
 * in u makes the rule a one-dimensional comparison regardless of which end of
 * the screen the goal is on.
 *
 * Pitch length/width vary by stadium, but the markings inside them are fixed
 * by IFAB Law 1 — that is what calibration uses, so the metric scale does not
 * depend on knowing the exact pitch size.
 */

import type { Pt } from './homography'

export const IFAB = {
  goalWidth: 7.32,
  goalAreaDepth: 5.5,
  goalAreaHalfWidth: 7.32 / 2 + 5.5, // 9.16
  boxDepth: 16.5,
  boxHalfWidth: 7.32 / 2 + 16.5, // 20.16
  penaltySpot: 11,
  circleRadius: 9.15,
} as const

/** Typical Besta deild pitch (e.g. Laugardalsvöllur). Only used for the halfway check and drawing. */
export const DEFAULT_PITCH = { length: 105, width: 68 }

export interface PitchDims {
  length: number
  width: number
}

export interface CalibPoint {
  key: string
  label: string
  hint: string
  pitch: Pt // (u, v) as {x: u, y: v}
}

export type TemplateId = 'box' | 'halfway'

/** v where the penalty arc meets the 16.5 m line. */
const ARC_V = Math.sqrt(IFAB.circleRadius ** 2 - (IFAB.boxDepth - IFAB.penaltySpot) ** 2) // ≈ 7.31

export function templatePoints(id: TemplateId, dims: PitchDims = DEFAULT_PITCH): CalibPoint[] {
  const { boxDepth: bd, boxHalfWidth: bw, goalAreaDepth: gd, goalAreaHalfWidth: gw } = IFAB
  if (id === 'box') {
    return [
      { key: 'gl-box-far', label: 'Endalína × vítateigur (fjær)', hint: 'Þar sem hliðarlína vítateigs fjær myndavél mætir endalínu', pitch: { x: 0, y: -bw } },
      { key: 'gl-ga-far', label: 'Endalína × markteigur (fjær)', hint: 'Horn markteigs á endalínu, fjær', pitch: { x: 0, y: -gw } },
      { key: 'gl-ga-near', label: 'Endalína × markteigur (nær)', hint: 'Horn markteigs á endalínu, nær', pitch: { x: 0, y: gw } },
      { key: 'gl-box-near', label: 'Endalína × vítateigur (nær)', hint: 'Þar sem hliðarlína vítateigs nær myndavél mætir endalínu', pitch: { x: 0, y: bw } },
      { key: 'ga-near', label: 'Markteigshorn (nær)', hint: 'Fremra horn markteigs, nær myndavél', pitch: { x: gd, y: gw } },
      { key: 'ga-far', label: 'Markteigshorn (fjær)', hint: 'Fremra horn markteigs, fjær myndavél', pitch: { x: gd, y: -gw } },
      { key: 'box-far', label: 'Vítateigshorn (fjær)', hint: 'Fremra horn vítateigs, fjær myndavél', pitch: { x: bd, y: -bw } },
      { key: 'arc-far', label: 'Vítabogi × vítateigslína (fjær)', hint: 'Þar sem boginn byrjar á vítateigslínunni, fjær', pitch: { x: bd, y: -ARC_V } },
      { key: 'arc-near', label: 'Vítabogi × vítateigslína (nær)', hint: 'Þar sem boginn endar á vítateigslínunni, nær', pitch: { x: bd, y: ARC_V } },
      { key: 'box-near', label: 'Vítateigshorn (nær)', hint: 'Fremra horn vítateigs, nær myndavél', pitch: { x: bd, y: bw } },
      { key: 'spot', label: 'Vítapunktur', hint: 'Miðja vítapunktsins', pitch: { x: IFAB.penaltySpot, y: 0 } },
    ]
  }
  const h = dims.length / 2
  const r = IFAB.circleRadius
  return [
    { key: 'hw-c-far', label: 'Miðlína × miðhringur (fjær)', hint: 'Þar sem miðhringurinn sker miðlínuna fjær myndavél', pitch: { x: h, y: -r } },
    { key: 'centre', label: 'Miðpunktur', hint: 'Miðja miðpunktsins', pitch: { x: h, y: 0 } },
    { key: 'hw-c-near', label: 'Miðlína × miðhringur (nær)', hint: 'Þar sem miðhringurinn sker miðlínuna nær myndavél', pitch: { x: h, y: r } },
    { key: 'c-attack', label: 'Miðhringur, sóknarmegin', hint: 'Ysti punktur hringsins í átt að markinu sem sótt er á', pitch: { x: h - r, y: 0 } },
    { key: 'c-defend', label: 'Miðhringur, hinum megin', hint: 'Ysti punktur hringsins í hina áttina', pitch: { x: h + r, y: 0 } },
  ]
}

export type Polyline = Pt[]

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 32): Polyline {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** Pitch markings as polylines in (u, v), used to draw the calibration overlay. */
export function pitchLines(dims: PitchDims = DEFAULT_PITCH): Polyline[] {
  const L = dims.length
  const W = dims.width / 2
  const { boxDepth: bd, boxHalfWidth: bw, goalAreaDepth: gd, goalAreaHalfWidth: gw, circleRadius: r } = IFAB
  const lines: Polyline[] = [
    // outline
    [{ x: 0, y: -W }, { x: L, y: -W }],
    [{ x: 0, y: W }, { x: L, y: W }],
    [{ x: 0, y: -W }, { x: 0, y: W }],
    [{ x: L, y: -W }, { x: L, y: W }],
    [{ x: L / 2, y: -W }, { x: L / 2, y: W }],
    arc(L / 2, 0, r, 0, 2 * Math.PI, 64),
  ]
  for (const [g, dir] of [[0, 1], [L, -1]] as const) {
    lines.push([{ x: g, y: -bw }, { x: g + dir * bd, y: -bw }, { x: g + dir * bd, y: bw }, { x: g, y: bw }])
    lines.push([{ x: g, y: -gw }, { x: g + dir * gd, y: -gw }, { x: g + dir * gd, y: gw }, { x: g, y: gw }])
    const spot = g + dir * IFAB.penaltySpot
    lines.push(arc(spot, 0, 0.25, 0, 2 * Math.PI, 12))
    // Penalty arc: the part of the r=9.15 circle outside the box.
    const half = Math.acos((bd - IFAB.penaltySpot) / r)
    lines.push(dir > 0 ? arc(spot, 0, r, -half, half) : arc(spot, 0, r, Math.PI - half, Math.PI + half))
  }
  return lines
}
