import type { SofaPlayerInput } from './playerComposite'

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Markmenn',
  DF: 'Varnarmenn',
  MF: 'Miðjumenn',
  FW: 'Sóknarmenn',
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Accent-insensitive name normalization so SofaScore spellings
 * ("Hallgrimur Mar Steingrimsson", "Óskar Borgthórsson") match KSÍ's
 * ("Hallgrímur Már Steingrímsson", "Óskar Borgþórsson").
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll('ð', 'd')
    .replaceAll('þ', 'th')
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Position inference from the season stat profile — SofaScore's export has
 * no position column. Goalkeepers are exact (saves > 0); outfielders get
 * the profile (defending / playmaking / attacking) they z-score highest on.
 */
export function inferPositions(players: SofaPlayerInput[]): Map<string, Position> {
  const out = new Map<string, Position>()
  const outfield: { name: string; def: number; mid: number; att: number }[] = []

  for (const p of players) {
    const e = p.extra ?? {}
    const apps = Math.max(1, num(p.appearances))
    if (num(e['Saves']) > 0) {
      out.set(p.name, 'GK')
      continue
    }
    outfield.push({
      name: p.name,
      def: (num(e['Tackles']) + num(e['Interceptions']) + 1.5 * num(e['Clearances'])) / apps,
      mid: (num(e['Key Passes']) + 2 * num(e['Big Chances Created']) + num(e['Accurate Passes']) / 12) / apps,
      att: (2 * num(p.goals) + num(e['Total Shots']) + num(e['Big Chances Missed'])) / apps,
    })
  }

  const z = (vals: number[]) => {
    const n = vals.length
    if (!n) return () => 0
    const mean = vals.reduce((a, b) => a + b, 0) / n
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1
    return (v: number) => (v - mean) / sd
  }
  const zd = z(outfield.map((o) => o.def))
  const zm = z(outfield.map((o) => o.mid))
  const za = z(outfield.map((o) => o.att))

  for (const o of outfield) {
    const scores: [Position, number][] = [
      ['DF', zd(o.def)],
      ['MF', zm(o.mid)],
      ['FW', za(o.att)],
    ]
    scores.sort((a, b) => b[1] - a[1])
    out.set(o.name, scores[0][0])
  }
  return out
}
