/**
 * Framlagsstuðull — a per-player contribution index computed from the
 * SofaScore season snapshot (top-150 Besta deild players).
 *
 * Categories (per appearance, z-scored across the player pool):
 *  - sköpun:  big chances created + key passes + assists + dribbles
 *  - vörn:    tackles + interceptions + clearances + duels won
 *  - sendingar: accurate-pass % weighted by passing volume
 *  - framsækni: accurate long balls + crosses + passes into final third
 *    (progressive-passing proxies — activates only when the SofaScore drop
 *    includes those columns; otherwise neutral for everyone)
 *  - markvarsla: saves + clean sheets + penalty saves (goalkeepers only)
 *
 * The index is expressed in Elo-points (capped ±80) and added to the
 * event-based player Elo for a combined rating. Goals and cards are NOT
 * included here — they already drive the event Elo.
 */

export interface SofaPlayerInput {
  name: string
  appearances: number | null
  assists: number | null
  extra: Record<string, unknown> | null
}

export interface CompositeBreakdown {
  creation: number
  defense: number
  passing: number
  progression: number
  goalkeeping: number
  total: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function zScores(values: number[]): (v: number) => number {
  const n = values.length
  if (!n) return () => 0
  const mean = values.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1
  return (v: number) => (v - mean) / sd
}

const W_CREATION = 14
const W_DEFENSE = 12
const W_PASSING = 7
const W_PROGRESSION = 8
const W_GK = 18
const CAP = 80
const MIN_APPS = 4

export function computeComposite(
  players: SofaPlayerInput[],
): Map<string, CompositeBreakdown> {
  const rows = players
    .filter((p) => (p.appearances ?? 0) >= MIN_APPS)
    .map((p) => {
      const e = p.extra ?? {}
      const apps = p.appearances!
      const creation =
        (num(e['Big Chances Created']) +
          0.5 * num(e['Key Passes']) +
          2 * num(p.assists) +
          0.3 * num(e['Successful Dribbles'])) / apps
      const defense =
        (num(e['Tackles']) +
          num(e['Interceptions']) +
          0.5 * num(e['Clearances']) +
          0.25 * num(e['Total Duels Won'])) / apps
      const passVolume = num(e['Accurate Passes']) / apps
      const passing = num(e['Accurate Passes %']) * Math.min(1, passVolume / 30)
      const progression =
        (num(e['Accurate Long Balls']) +
          num(e['Accurate Crosses']) +
          num(e['Passes into Final Third'])) / apps
      const isGk = num(e['Saves']) > 0
      const goalkeeping = isGk
        ? (num(e['Saves']) + 2 * num(e['Penalty Saves'])) / apps +
          2 * (num(e['Clean Sheets']) / apps)
        : 0
      return { name: p.name, creation, defense, passing, progression, goalkeeping, isGk }
    })

  const zc = zScores(rows.map((r) => r.creation))
  const zd = zScores(rows.map((r) => r.defense))
  const zp = zScores(rows.map((r) => r.passing))
  const zpr = zScores(rows.map((r) => r.progression))
  const anyProgression = rows.some((r) => r.progression > 0)
  const gks = rows.filter((r) => r.isGk)
  const zg = zScores(gks.map((r) => r.goalkeeping))

  const out = new Map<string, CompositeBreakdown>()
  for (const r of rows) {
    const creation = W_CREATION * zc(r.creation)
    const defense = W_DEFENSE * zd(r.defense)
    const passing = W_PASSING * zp(r.passing)
    const progression = anyProgression ? W_PROGRESSION * zpr(r.progression) : 0
    const goalkeeping = r.isGk ? W_GK * zg(r.goalkeeping) : 0
    const raw = creation + defense + passing + progression + goalkeeping
    out.set(r.name, {
      creation: Math.round(creation),
      defense: Math.round(defense),
      passing: Math.round(passing),
      progression: Math.round(progression),
      goalkeeping: Math.round(goalkeeping),
      total: Math.round(Math.max(-CAP, Math.min(CAP, raw))),
    })
  }
  return out
}
