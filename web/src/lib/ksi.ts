import type { ParsedMatch } from './types'

const CARD_SPLIT = 'grid-cols-[1fr_auto_1fr]'
const MONTHS: Record<string, number> = {
  janúar: 1, febrúar: 2, mars: 3, apríl: 4, maí: 5, júní: 6,
  júlí: 7, ágúst: 8, september: 9, október: 10, nóvember: 11, desember: 12,
}
const DATE_RE =
  /(?:Mán|Þri|Mið|Fim|Fös|Lau|Sun)\s+(\d{1,2})\.\s*([a-záéíóúýðþæö]+)(?:\s+(\d{2}):(\d{2}))?/gi

const unescape = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")

export const cleanTeam = (name: string) =>
  unescape(name).trim().replace(/\s+Fullorðnir\s+(Karlar|Konur)$/u, '')

function parseHeader(segment: string, season: number) {
  let date: string | null = null
  let venue: string | null = null
  let m: RegExpExecArray | null
  DATE_RE.lastIndex = 0
  let last: RegExpExecArray | null = null
  while ((m = DATE_RE.exec(segment))) last = m
  if (last) {
    const day = last[1].padStart(2, '0')
    const month = String(MONTHS[last[2].toLowerCase()] ?? 0).padStart(2, '0')
    const hh = last[3] ?? '00'
    const mi = last[4] ?? '00'
    if (month !== '00') date = `${season}-${month}-${day}T${hh}:${mi}:00Z`
  }
  const v = [
    ...segment.matchAll(
      /<span class="body-5 overflow-hidden whitespace-nowrap text-ellipsis">([^<]+)<\/span>/g,
    ),
  ].pop()
  if (v) venue = unescape(v[1]).trim()
  return { date, venue }
}

/**
 * Parse match cards from a KSÍ tournament matches page
 * (banner-tab=matches-and-results, with or without toggle=results).
 * Card N's date/venue live in the HTML segment *before* its team grid,
 * i.e. in chunk N-1 after splitting on the grid marker.
 */
export function parseMatchCards(html: string, season: number): ParsedMatch[] {
  const chunks = html.split(CARD_SPLIT)
  const out: ParsedMatch[] = []
  for (let i = 1; i < chunks.length; i++) {
    const card = chunks[i]
    const header = chunks[i - 1]
    const home = card.match(
      /<span class="body-4 group-hover:underline text-right">\s*([^<]+?)\s*<\/span>/,
    )
    const away = card.match(
      /<span class="body-4 group-hover:underline">\s*([^<]+?)\s*<\/span>/,
    )
    const link = (card + header).match(/leikur\?id=(\d+)/)
    if (!home || !away || !link) continue
    const score = card.match(
      /<span class="body-4 whitespace-nowrap">\s*(\d+)\s*-\s*(\d+)\s*</,
    )
    const { date, venue } = parseHeader(header, season)
    out.push({
      ksiId: Number(link[1]),
      home: cleanTeam(home[1]),
      away: cleanTeam(away[1]),
      homeGoals: score ? Number(score[1]) : null,
      awayGoals: score ? Number(score[2]) : null,
      status: score ? 'played' : 'upcoming',
      date,
      venue,
    })
  }
  return out
}

export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'islensk-fotbolti (analytics site; personal project)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`KSÍ fetch failed ${res.status}: ${url}`)
  return res.text()
}

/** Fetch all matches (played + upcoming) of a tournament, deduped by ksiId. */
export async function fetchTournamentMatches(
  tournamentId: number,
  season: number,
): Promise<ParsedMatch[]> {
  const seen = new Map<number, ParsedMatch>()
  for (const toggle of ['&toggle=results', '']) {
    for (let page = 1; page <= 30; page++) {
      const url = `https://www.ksi.is/oll-mot/mot?id=${tournamentId}&banner-tab=matches-and-results${toggle}&page=${page}`
      const cards = parseMatchCards(await fetchPage(url), season)
      let fresh = 0
      for (const c of cards) {
        // played cards win over upcoming duplicates
        const prev = seen.get(c.ksiId)
        if (!prev) {
          seen.set(c.ksiId, c)
          fresh++
        } else if (prev.status === 'upcoming' && c.status === 'played') {
          seen.set(c.ksiId, c)
        }
      }
      if (fresh === 0) break
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  return [...seen.values()]
}
