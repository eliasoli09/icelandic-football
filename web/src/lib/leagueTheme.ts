/**
 * A competition's accent colour.
 *
 * The two Icelandic leagues have hand-picked colours defined in globals.css.
 * Everything else gets a stable colour derived from its key, so adding a
 * league is a row in a table rather than a CSS edit — and the same league
 * always looks the same without anyone maintaining a palette of hundreds.
 */
export interface LeagueTheme {
  /** dark theme accent */
  accent: string
  /** light theme accent — darker, for contrast on white */
  accentLight: string
  /** text colour that reads on the accent */
  ink: string
  inkLight: string
  glow: string
}

/**
 * The leagues the site was built around keep their hand-tuned identity. These
 * are the exact values globals.css uses, so anything reading the theme in
 * JavaScript — the hero waves, a canvas, an OG image — paints the same colour
 * the stylesheet does rather than a near-miss.
 */
const PINNED: Record<string, { accent: string; accentLight: string; ink: string }> = {
  besta: { accent: '#e8b93c', accentLight: '#8a6410', ink: '#171104' },
  lengjudeild: { accent: '#2f9df4', accentLight: '#1a6fc0', ink: '#051220' },
}

/** Hues that read as muddy or near-invisible on the dark surface. */
const AVOID: [number, number][] = [[52, 68], [232, 258]]

function hueFrom(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let hue = Math.abs(h) % 360
  for (const [from, to] of AVOID) {
    if (hue >= from && hue <= to) hue = (to + 12) % 360
  }
  return hue
}

/**
 * @param override explicit hex from the league row, when someone has picked one
 */
export function leagueTheme(key: string, override?: string | null): LeagueTheme {
  if (override && /^#[0-9a-f]{6}$/i.test(override)) {
    return {
      accent: override,
      accentLight: override,
      ink: '#0d0d0d',
      inkLight: '#ffffff',
      glow: hexGlow(override, 0.07),
    }
  }
  const pin = PINNED[key]
  if (pin) {
    return { ...pin, inkLight: '#ffffff', glow: hexGlow(pin.accent, 0.06) }
  }
  const h = hueFrom(key)
  const s = 72
  return {
    accent: `hsl(${h} ${s}% 62%)`,
    accentLight: `hsl(${h} ${Math.min(100, s + 8)}% 32%)`,
    // a light accent needs dark text, a dark one needs light
    ink: `hsl(${h} 40% 8%)`,
    inkLight: '#ffffff',
    glow: `hsl(${h} ${s}% 62% / 0.07)`,
  }
}

function hexGlow(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** CSS custom properties to hang on a wrapper element. */
export function leagueVars(theme: LeagueTheme): Record<string, string> {
  return {
    '--accent': theme.accent,
    '--accent-ink': theme.ink,
    '--glow': theme.glow,
  }
}
