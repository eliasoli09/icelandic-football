/**
 * Dixon-Coles: attack and defence per club, fitted by maximum likelihood.
 *
 * Elo answers one question — who is stronger — and throws the scoreline away.
 * A match tells us more than that: who created, who conceded, and by how much.
 * This model gives every club two numbers instead of one, learned from every
 * score it has been part of, and adds the two corrections the original 1997
 * paper is named for:
 *
 *   · a home-advantage term shared by the league, rather than a fixed rating
 *     bonus that has to be guessed
 *   · a dependence correction on the four low scorelines, because 0-0, 1-0,
 *     0-1 and 1-1 occur more often than two independent Poissons predict
 *
 * Matches are weighted down as they age, and attack and defence are pulled
 * towards the league average. That last part is what makes a promoted club
 * behave: with little history of its own it simply sits near average for the
 * division it has joined, with no special case anywhere in the code.
 *
 * On its own it does NOT beat Elo. Walk-forward across fourteen leagues,
 * refitted fortnightly, held out from July 2024:
 *
 *   Elo                     1.03616
 *   Dixon-Coles             1.03816   worse by 0.00200 +/-0.00190
 *   0.7 Elo + 0.3 this      1.03497   better by 0.00119 +/-0.00058
 *
 * So it is worth about a third of a vote, not the whole thing. Elo carries
 * decades of history through a club's rating and follows it between divisions;
 * this sees one league at a time but reads the whole scoreline rather than
 * only who won. They disagree in useful ways, and the average of the two beats
 * either alone.
 */

export interface DcMatch {
  home: string
  away: string
  homeGoals: number
  awayGoals: number
  /** days before the moment the fit is made; 0 is the most recent */
  ageDays: number
}

export interface DcParams {
  attack: Map<string, number>
  defence: Map<string, number>
  /** log multiplier applied to the home side's expectation */
  homeAdvantage: number
  /** low-score dependence; 0 makes the two Poissons independent */
  rho: number
  /** mean goals per side across the fitted window, on the log scale */
  base: number
  logLikelihood: number
  iterations: number
  converged: boolean
}

export interface DcOptions {
  /** matches lose half their weight after this many days */
  halfLifeDays?: number
  /**
   * How many matches of "perfectly average" a club is credited with before its
   * own results count. This is the whole newcomer story: a promoted club with
   * two games behind it sits near the division average until it has played
   * enough to have earned something else.
   */
  priorMatches?: number
  maxIterations?: number
  learningRate?: number
  tolerance?: number
}

/**
 * Chosen on 28,425 matches before July 2024 and only then measured on the
 * 18,129 after, across the fourteen leagues with enough history to fit.
 */
export const DC_DEFAULTS = {
  halfLifeDays: 365,
  priorMatches: 16,
  maxIterations: 400,
  learningRate: 0.06,
  tolerance: 1e-7,
} as const

/**
 * How much of the final probability comes from this model rather than Elo.
 * Swept 0 to 1; 0.3 and 0.4 were level on held-out data, and 0.3 is the more
 * conservative of the two.
 */
export const DC_BLEND = 0.3

/** rho may not drive the correction to zero or below for a plausible scoreline */
const RHO_LIMIT = 0.35
const clampRho = (r: number) => Math.min(RHO_LIMIT, Math.max(-RHO_LIMIT, r))

/**
 * The Dixon-Coles correction. Only the four low scorelines are touched; every
 * other pair keeps the independent probability.
 */
export function tau(x: number, y: number, lh: number, la: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lh * la * rho
  if (x === 0 && y === 1) return 1 + lh * rho
  if (x === 1 && y === 0) return 1 + la * rho
  if (x === 1 && y === 1) return 1 - rho
  return 1
}

const poisson = (lambda: number, k: number) => {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

/** The two goal expectations for a fixture, from a fitted model. */
export function expectations(p: DcParams, home: string, away: string) {
  const ah = p.attack.get(home) ?? 0
  const dh = p.defence.get(home) ?? 0
  const aa = p.attack.get(away) ?? 0
  const da = p.defence.get(away) ?? 0
  return {
    home: Math.exp(p.base + ah - da + p.homeAdvantage),
    away: Math.exp(p.base + aa - dh),
  }
}

export interface DcPrediction {
  pHome: number
  pDraw: number
  pAway: number
  lambdaHome: number
  lambdaAway: number
  /** most likely exact score */
  score: { home: number; away: number }
}

const MAX_GOALS = 10

/** Turn a fitted model into 1X2 probabilities and a likeliest scoreline. */
export function predict(p: DcParams, home: string, away: string): DcPrediction {
  const { home: lh, away: la } = expectations(p, home, away)
  let h = 0
  let d = 0
  let a = 0
  let best = -1
  let bh = 0
  let ba = 0
  const ph: number[] = []
  const pa: number[] = []
  for (let i = 0; i <= MAX_GOALS; i++) {
    ph.push(poisson(lh, i))
    pa.push(poisson(la, i))
  }
  for (let x = 0; x <= MAX_GOALS; x++) {
    for (let y = 0; y <= MAX_GOALS; y++) {
      const prob = ph[x] * pa[y] * Math.max(0.001, tau(x, y, lh, la, p.rho))
      if (x > y) h += prob
      else if (x === y) d += prob
      else a += prob
      if (prob > best) { best = prob; bh = x; ba = y }
    }
  }
  const total = h + d + a
  return {
    pHome: h / total, pDraw: d / total, pAway: a / total,
    lambdaHome: lh, lambdaAway: la,
    score: { home: bh, away: ba },
  }
}

/**
 * Fit attack, defence, home advantage and rho to a set of played matches.
 *
 * Gradient ascent on the weighted log-likelihood with Adam, which needs no
 * matrix work and converges in a few hundred passes for a league-sized
 * problem. Attack is re-centred on zero after every step, because only
 * differences between clubs are identifiable.
 */
export function fit(matches: DcMatch[], options: DcOptions = {}): DcParams {
  const o = { ...DC_DEFAULTS, ...options }
  const clubs = [...new Set(matches.flatMap((m) => [m.home, m.away]))].sort()
  const index = new Map(clubs.map((c, i) => [c, i]))
  const n = clubs.length

  const decay = Math.log(2) / Math.max(1, o.halfLifeDays)
  const weight = matches.map((m) => Math.exp(-decay * Math.max(0, m.ageDays)))

  let totalGoals = 0
  let totalWeight = 0
  for (const [i, m] of matches.entries()) {
    totalGoals += (m.homeGoals + m.awayGoals) * weight[i]
    totalWeight += 2 * weight[i]
  }
  // Fitted, not fixed. With attack and defence both centred on zero the away
  // side averages exp(base) and the home side exp(base + home) — so pinning
  // base to the mean over BOTH sides forces the home advantage to come out at
  // zero, whatever the scores say.
  let base = Math.log(Math.max(0.2, totalGoals / Math.max(1e-9, totalWeight)))

  const attack = new Float64Array(n)
  const defence = new Float64Array(n)
  let home = 0.25
  let rho = 0

  // Adam
  const mA = new Float64Array(n), vA = new Float64Array(n)
  const mD = new Float64Array(n), vD = new Float64Array(n)
  let mH = 0, vH = 0, mR = 0, vR = 0, mB = 0, vB = 0
  const b1 = 0.9, b2 = 0.999, eps = 1e-8

  let last = -Infinity
  let iterations = 0
  let converged = false

  for (let step = 1; step <= o.maxIterations; step++) {
    iterations = step
    const gA = new Float64Array(n)
    const gD = new Float64Array(n)
    let gH = 0
    let gR = 0
    let gB = 0
    let ll = 0

    for (const [k, m] of matches.entries()) {
      const w = weight[k]
      if (w < 1e-6) continue
      const i = index.get(m.home)!
      const j = index.get(m.away)!
      const lh = Math.exp(base + attack[i] - defence[j] + home)
      const la = Math.exp(base + attack[j] - defence[i])
      const x = m.homeGoals
      const y = m.awayGoals

      // Poisson kernel: the log(y!) term does not depend on the parameters
      ll += w * (x * Math.log(lh) - lh + y * Math.log(la) - la)
      const rh = x - lh
      const ra = y - la
      gA[i] += w * rh; gD[j] -= w * rh; gH += w * rh
      gA[j] += w * ra; gD[i] -= w * ra
      gB += w * (rh + ra)

      // the low-score correction, and its pull on the same parameters
      const t = tau(x, y, lh, la, rho)
      if (t !== 1) {
        const safe = Math.max(1e-6, t)
        ll += w * Math.log(safe)
        let dLh = 0, dLa = 0, dRho = 0
        if (x === 0 && y === 0) { dLh = -la * rho; dLa = -lh * rho; dRho = -lh * la }
        else if (x === 0 && y === 1) { dLh = rho; dRho = lh }
        else if (x === 1 && y === 0) { dLa = rho; dRho = la }
        else { dRho = -1 }
        const cH = (w * dLh * lh) / safe
        const cA = (w * dLa * la) / safe
        gA[i] += cH; gD[j] -= cH; gH += cH
        gA[j] += cA; gD[i] -= cA
        gB += cH + cA
        gR += (w * dRho) / safe
      }
    }

    // Pull towards the league average. A Poisson match carries roughly `base`
    // goals of information about a club, so expressing the prior in matches and
    // converting here keeps the setting meaningful across leagues that score at
    // different rates.
    const ridge = o.priorMatches * Math.exp(base)
    for (let i = 0; i < n; i++) {
      ll -= ridge * (attack[i] * attack[i] + defence[i] * defence[i]) / 2
      gA[i] -= ridge * attack[i]
      gD[i] -= ridge * defence[i]
    }

    const c1 = 1 - Math.pow(b1, step)
    const c2 = 1 - Math.pow(b2, step)
    const apply = (
      g: number, m: number, v: number,
    ): [number, number, number] => {
      const mm = b1 * m + (1 - b1) * g
      const vv = b2 * v + (1 - b2) * g * g
      return [o.learningRate * (mm / c1) / (Math.sqrt(vv / c2) + eps), mm, vv]
    }
    for (let i = 0; i < n; i++) {
      const [sA, m1, v1] = apply(gA[i], mA[i], vA[i]); mA[i] = m1; vA[i] = v1; attack[i] += sA
      const [sD, m2, v2] = apply(gD[i], mD[i], vD[i]); mD[i] = m2; vD[i] = v2; defence[i] += sD
    }
    const [sH, m3, v3] = apply(gH, mH, vH); mH = m3; vH = v3; home += sH
    const [sR, m4, v4] = apply(gR, mR, vR); mR = m4; vR = v4; rho = clampRho(rho + sR)
    const [sB, m5, v5] = apply(gB, mB, vB); mB = m5; vB = v5; base += sB

    // Adding the same constant to every attack and every defence leaves every
    // expectation exactly where it was, so both have to be pinned or the pair
    // drifts together and neither means anything on its own.
    let meanA = 0
    let meanD = 0
    for (let i = 0; i < n; i++) { meanA += attack[i]; meanD += defence[i] }
    meanA /= n || 1
    meanD /= n || 1
    for (let i = 0; i < n; i++) { attack[i] -= meanA; defence[i] -= meanD }

    if (step > 20 && Math.abs(ll - last) < o.tolerance * Math.abs(last || 1)) {
      converged = true
      last = ll
      break
    }
    last = ll
  }

  return {
    attack: new Map(clubs.map((c, i) => [c, attack[i]])),
    defence: new Map(clubs.map((c, i) => [c, defence[i]])),
    homeAdvantage: home,
    rho,
    base,
    logLikelihood: last,
    iterations,
    converged,
  }
}
