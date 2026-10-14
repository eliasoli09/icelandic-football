const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur']
const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']

/** Day of month of the nth Sunday; month is 0-based. */
function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
  return 1 + ((7 - first) % 7) + 7 * (n - 1)
}

/**
 * Hours US Eastern is behind UTC. Daylight time runs from 02:00 local on the
 * second Sunday of March to 02:00 local on the first Sunday of November. Done
 * by rule rather than Intl because Node and browsers ship different ICU data.
 */
export function easternOffsetHours(y: number, m: number, d: number, hh: number): number {
  let dst: boolean
  if (m < 3 || m > 11) dst = false
  else if (m > 3 && m < 11) dst = true
  else if (m === 3) {
    const start = nthSunday(y, 2, 2)
    dst = d > start || (d === start && hh >= 2)
  } else {
    const end = nthSunday(y, 10, 1)
    dst = d < end || (d === end && hh < 2)
  }
  return dst ? 4 : 5
}

/** nflverse gives gameday + gametime in US Eastern; store UTC. */
export function easternToUtcIso(gameday: string, gametime: string): string {
  const [y, m, d] = gameday.split('-').map(Number)
  const [hh, mm] = gametime.split(':').map(Number)
  const off = easternOffsetHours(y, m, d, hh)
  return new Date(Date.UTC(y, m - 1, d, hh + off, mm)).toISOString()
}

// Iceland is UTC all year, so the UTC fields are the local ones.
export const dayKey = (iso: string) => iso.slice(0, 10)

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`
}

export function clock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** A kickoff between midnight and six is easy to misread as the evening before. */
export const isSmallHours = (iso: string) => new Date(iso).getUTCHours() < 6
