/** Coordinates use a 1600 × 900 stage. Time is elapsed seconds, never frame count. */
const TAU = Math.PI * 2
const fmt = (value: number) => value.toFixed(2)

/** Nested straight V contours share a moving apex and slope, keeping every arm parallel. */
export function chevronContour(index: number, seconds: number, group = 0, amplitude = 1): string {
  const phase = seconds / [18, 22, 14][group % 3] * TAU + group * 1.9
  const centers = [[1300, 190], [-145, 440], [1700, 680]]
  const [cx, cy] = centers[group % 3]
  const x = cx + Math.sin(phase) * 10 * amplitude
  const y = cy + index * 17 + Math.cos(phase * .8) * 12 * amplitude
  const spread = 650
  const rise = 370 + Math.sin(phase + .7) * 17 * amplitude
  return `M ${fmt(x - spread)} ${fmt(y - rise)} L ${fmt(x)} ${fmt(y)} L ${fmt(x + spread)} ${fmt(y - rise)}`
}

/** Two joined cubics form each ribbon; adjacent strands share the entire deformation field. */
export function conferenceRibbon(index: number, seconds: number, group = 0, amplitude = 1): string {
  const phase = seconds / [20, 22, 17][group % 3] * TAU + group * 2.1
  const wave = Math.sin(phase) * 28 * amplitude
  const swell = Math.sin(phase * .73 + 1.2) * 21 * amplitude
  const drift = Math.sin(phase * 1.17 + 2.3) * 15 * amplitude
  const shapes = [
    [420, -120, 800, -140, 850, 300, 1130, 205, 1470, 35, 1720, 170],
    [-300, -100, 170, 50, -190, 290, 20, 420, 420, 680, -240, 970],
    [1590, -230, 1170, -30, 1720, 250, 1520, 430, 1150, 730, 1810, 920],
  ]
  const p = shapes[group % 3]
  const dx = index * 9.5, dy = index * 12
  const point = (x: number, y: number) => `${fmt(x + dx)} ${fmt(y + dy)}`
  const anchorX = p[6] + wave, anchorY = p[7] + swell
  const handleX = p[4] + drift, handleY = p[5] - wave * .5
  // Mirrored handle at the join gives identical incoming and outgoing derivatives.
  return `M ${point(p[0], p[1])} C ${point(p[2] + swell, p[3] + drift)} ${point(handleX, handleY)} ${point(anchorX, anchorY)} C ${point(2 * anchorX - handleX, 2 * anchorY - handleY)} ${point(p[8] - swell, p[9] + wave)} ${point(p[10], p[11])}`
}
