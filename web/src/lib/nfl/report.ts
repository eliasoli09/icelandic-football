/**
 * Out-of-sample result from scripts/nfl-backtest.mts (14 Oct 2026): parameters
 * chosen before 2015, scored on every 2015-2025 game with a moneyline and spread.
 * Log loss 0.636 against Vegas 0.613, difference 0.023 [0.016, 0.031].
 */
export const NFL_MODEL_REPORT = { games: 3027, from: 2015, to: 2025, modelAcc: 0.644, vegasAcc: 0.662 }

// by hand: Node and the browser format is-IS numbers differently (Gildrur 30)
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const pct1 = (x: number) => (x * 100).toFixed(1).replace('.', ',')

export const NFL_MODEL_SENTENCE =
  `Prófað á ${thousands(NFL_MODEL_REPORT.games)} leikjum ${NFL_MODEL_REPORT.from}-${NFL_MODEL_REPORT.to} sem líkanið hafði ekki séð: ` +
  `það hitti á sigurvegarann í ${pct1(NFL_MODEL_REPORT.modelAcc)}% leikja en Vegas í ${pct1(NFL_MODEL_REPORT.vegasAcc)}%. ` +
  'Vegas er nákvæmara, og munurinn er ekki tilviljun.'
