/**
 * Law 11 (offside position) evaluated in attack coordinates (see pitch.ts):
 * a player is in an offside position if any playable body part is
 *   – in the opponents' half (excluding the halfway line), and
 *   – nearer to the opponents' goal line than both the ball and the
 *     second-last opponent.
 * Level with either counts as onside.
 *
 * This decides *position* only. Whether it is an offence (interfering with
 * play/an opponent, gaining an advantage) is a referee judgement, and there
 * is no offside from a goal kick, throw-in or corner kick.
 */

export type Role = 'attacker' | 'defender' | 'keeper' | 'ignore'

export interface PitchPlayer {
  id: string
  role: Role
  /** Distance (m) of the player's most advanced ground point from the attacked goal line. */
  u: number
  v: number
}

export interface OffsideInput {
  players: PitchPlayer[]
  /** Ball distance from the goal line at the moment of the kick; null if unknown. */
  ballU: number | null
  /** Distance of the halfway line from the attacked goal line (pitch length / 2). */
  halfwayU: number
  /** Margins within ±tolerance metres are reported as too close to call. */
  tolerance: number
}

export type Status = 'offside' | 'onside' | 'close'

export interface Verdict {
  id: string
  status: Status
  /** Metres beyond the offside line; positive = offside side, negative = onside side. */
  margin: number
  reason: string
}

export interface OffsideResult {
  /** Offside line as distance from the goal line; null if it cannot be established. */
  lineU: number | null
  lineSource: 'defender' | 'ball' | null
  secondLastId: string | null
  /** True when no keeper was visible, so one is assumed behind the visible defenders. */
  keeperAssumed: boolean
  verdicts: Verdict[]
  warnings: string[]
}

export function evaluateOffside(input: OffsideInput): OffsideResult {
  const { players, ballU, halfwayU, tolerance } = input
  const warnings: string[] = []
  const opponents = players
    .filter((p) => p.role === 'defender' || p.role === 'keeper')
    .sort((a, b) => a.u - b.u)
  const keeperVisible = players.some((p) => p.role === 'keeper')

  // With the keeper out of frame we assume they are the last opponent (on or
  // near their line), which makes the deepest *visible* defender second-last.
  const secondLast = keeperVisible ? opponents[1] : opponents[0]
  const keeperAssumed = !keeperVisible
  if (keeperAssumed) warnings.push('Markvörður sést ekki — gert ráð fyrir að hann sé aftasti varnarmaður.')
  if (!secondLast) warnings.push('Of fáir varnarmenn merktir til að finna næstaftasta varnarmann.')
  if (ballU === null) warnings.push('Staðsetning bolta óþekkt — aðeins borið saman við varnarmann.')

  let lineU: number | null = secondLast ? secondLast.u : null
  let lineSource: OffsideResult['lineSource'] = secondLast ? 'defender' : null
  // Ball nearer the goal than the second-last defender → the ball is the line.
  // Without a defender we can still rule players behind the ball onside (below),
  // but cannot declare anyone offside.
  if (ballU !== null && lineU !== null && ballU < lineU) {
    lineU = ballU
    lineSource = 'ball'
  }

  const verdicts: Verdict[] = players
    .filter((p) => p.role === 'attacker')
    .map((p) => {
      if (p.u >= halfwayU) {
        return { id: p.id, status: 'onside', margin: lineU !== null ? lineU - p.u : 0, reason: 'Á eigin vallarhelmingi' } satisfies Verdict
      }
      if (ballU !== null && p.u >= ballU && lineU === null) {
        return { id: p.id, status: 'onside', margin: ballU - p.u, reason: 'Fyrir aftan boltann' } satisfies Verdict
      }
      if (lineU === null) {
        return { id: p.id, status: 'close', margin: 0, reason: 'Ekki hægt að ákvarða — vantar varnarmann' } satisfies Verdict
      }
      const margin = lineU - p.u
      const status: Status = Math.abs(margin) <= tolerance ? 'close' : margin > 0 ? 'offside' : 'onside'
      const ref = lineSource === 'ball' ? 'boltanum' : 'næstaftasta varnarmanni'
      const reason =
        status === 'close'
          ? `Innan við ${Math.round(tolerance * 100)} cm frá ${ref} — of tæpt til að skera úr`
          : margin > 0
            ? `${fmtM(margin)} nær marklínu en ${ref}`
            : `${fmtM(-margin)} fyrir aftan ${ref}`
      return { id: p.id, status, margin, reason } satisfies Verdict
    })

  return { lineU, lineSource, secondLastId: secondLast?.id ?? null, keeperAssumed, verdicts, warnings }
}

export const fmtM = (m: number) => (Math.abs(m) < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2).replace('.', ',')} m`)
