/** Win probability implied by an American moneyline, bookmaker margin included. */
export const impliedProb = (american: number) =>
  american < 0 ? -american / (-american + 100) : 100 / (american + 100)

/** Both sides' probabilities with the margin removed proportionally. */
export function devig(homeMl: number | null, awayMl: number | null): { home: number; away: number } | null {
  if (homeMl === null || awayMl === null) return null
  const h = impliedProb(homeMl)
  const a = impliedProb(awayMl)
  return { home: h / (h + a), away: a / (h + a) }
}

/** A European (decimal) price from an American moneyline. */
export const decimalOdds = (ml: number) => (ml < 0 ? 1 + 100 / -ml : 1 + ml / 100)

/** "1,65": the decimal price as shown, or null without a line. */
export const oddsLabel = (ml: number | null | undefined) => (ml == null ? null : decimalOdds(ml).toFixed(2).replace('.', ','))
