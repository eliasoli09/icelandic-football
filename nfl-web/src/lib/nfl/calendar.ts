import type { NflGame } from './types'

/** What a calendar entry says about one game, beyond the clubs and the kickoff. */
export interface CalendarExtra { channel?: string; odds?: string; model?: string }

/** A game lasts about three and a half hours on TV. */
const GAME_MS = 3.5 * 3600_000

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Lines longer than 75 bytes go on as continuation lines (RFC 5545), never splitting a character. */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = '', bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch; bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

/**
 * The season's games as an iCalendar feed a phone can subscribe to: Icelandic
 * kickoff times come from the UTC start, the score once played, the channel,
 * prices and the model's pick in the notes, and a link back to the game.
 */
export function seasonCalendar(name: string, games: NflGame[], site: string, extra: Record<string, CalendarExtra> = {}, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Snertimark.net//NFL//IS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(name)}`, 'X-WR-TIMEZONE:Atlantic/Reykjavik',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
  ]
  for (const g of [...games].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const start = new Date(g.kickoff)
    const played = g.home_score !== null && g.away_score !== null
    const x = extra[g.game_id] ?? {}
    const url = `${site}/leikur/${g.game_id}`
    const notes = [
      x.channel ? `Í sjónvarpinu: ${x.channel}` : null,
      !played && x.odds ? `Stuðlar: ${x.odds}` : null,
      !played && x.model ? `Líkanið: ${x.model}` : null,
      g.time_tbd ? 'Tími óákveðinn' : null,
      url,
    ].filter((s): s is string => !!s)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.game_id}@snertimark.net`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + GAME_MS))}`,
      `SUMMARY:${escape(played ? `${g.away} ${g.away_score}-${g.home_score} ${g.home}` : `${g.away} @ ${g.home}`)}`,
      ...(g.stadium ? [`LOCATION:${escape(g.stadium)}`] : []),
      `DESCRIPTION:${escape(notes.join('\n'))}`,
      `URL:${url}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
