/**
 * The rumour mill: which news items are trade talk, and the countdown to the
 * deadline. Pure; the cron and the pages use it.
 */

/** Tuesday 10 November 2026, 4 p.m. Eastern (EST after 1 November) = 21:00 UTC and in Iceland. NFL.com. */
export const TRADE_DEADLINE = '2026-11-10T21:00:00.000Z'

/** How the page names it, in the accusative: "Rennur út þriðjudaginn …". */
export const TRADE_DEADLINE_LABEL = 'þriðjudaginn 10. nóvember kl. 21:00'

export type Heat = 'heitt' | 'volgt' | 'kalt'
export const HEAT_LABEL: Record<Heat, string> = { heitt: 'Heitt', volgt: 'Volgt', kalt: 'Kalt' }

const RUMOUR = new RegExp([
  String.raw`\btrad(?:e|es|ed|ing)\b(?!\s+deadline\b)`,
  String.raw`\btrade\s+(?:talks?|market|block|request|interest|target|candidates?|offers?|chatter|rumou?rs?)\b`,
  String.raw`\bacquir(?:e|es|ed|ing)\b`,
  String.raw`\bdeal\s+(?:for|to\s+acquire|sending)\b`,
  String.raw`\bshopping\b`,
  String.raw`\bon\s+the\s+(?:trading\s+)?block\b`,
  String.raw`\bswap\b`,
  String.raw`\bin\s+exchange\s+for\b`,
  String.raw`\bdraft\s+pick\s+compensation\b`,
].join('|'), 'i')

/** Fantasy advice talks of "trades" too, between fantasy teams, not clubs. */
const FANTASY = /\bfantasy\b/i

/** Trade talk: "Chiefs acquire …", "Cowboys open to trading …"; not "before the trade deadline" alone, nor fantasy advice. */
export function isRumour(text: string): boolean {
  return RUMOUR.test(text) && !FANTASY.test(text)
}

/** Days, hours and minutes left; null once the deadline has passed. */
export function countdown(now: Date, deadline = TRADE_DEADLINE): { days: number; hours: number; minutes: number } | null {
  const ms = new Date(deadline).getTime() - now.getTime()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

export interface TradeMove { player: string; from: string; to: string }
export interface Trade { id: string; traded_on: string; moves: TradeMove[]; compensation: string; source_url: string | null }

/** The clubs a trade touches, for the team filter. */
export const tradeTeams = (t: Pick<Trade, 'moves'>) => [...new Set(t.moves.flatMap((m) => [m.from, m.to]))]
