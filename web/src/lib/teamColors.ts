export interface TeamInfo {
  name: string
  crest: string | null
  color: string | null
}

const FALLBACK = '#5a6577'

/** Club color, or a neutral gray for clubs without one (historical IBA etc.). */
export function teamColor(info: TeamInfo | undefined): string {
  return info?.color ?? FALLBACK
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')

/** Mix a color towards white so near-black club colors (KR, FH, ÍBV)
 * stay visible on dark surfaces. */
export function displayColor(info: TeamInfo | undefined): string {
  const hex = teamColor(info)
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance >= 0.22) return hex
  const k = 0.55
  return toHex(r + (255 - r) * k * (0.22 - luminance) * 4, g + (255 - g) * k * (0.22 - luminance) * 4, b + (255 - b) * k * (0.22 - luminance) * 4)
}

/** rgba() string of the club color for tinted backgrounds. */
export function tint(info: TeamInfo | undefined, alpha: number): string {
  const [r, g, b] = hexToRgb(teamColor(info))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
