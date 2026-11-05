/** The UTM fields we keep from a landing URL. Same file in web/ and nfl-web/. */
export type Utm = { source: string; medium: string | null; campaign: string | null; content: string | null; term: string | null }

/** Lowercase, spaces to hyphens, only [a-z0-9._-], at most 100 characters - junk in a link cannot fill the table with noise. */
function clean(v: string | null): string | null {
  if (!v) return null
  const s = v.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').slice(0, 100)
  return s || null
}

/** Reads utm_* from a query string; null when there is no usable utm_source. */
export function parseUtm(search: string): Utm | null {
  const q = new URLSearchParams(search)
  const source = clean(q.get('utm_source'))
  if (!source) return null
  return {
    source,
    medium: clean(q.get('utm_medium')),
    campaign: clean(q.get('utm_campaign')),
    content: clean(q.get('utm_content')),
    term: clean(q.get('utm_term')),
  }
}

/** Host of document.referrer, or null for an empty or malformed one. */
export function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null
  try {
    return new URL(ref).hostname.slice(0, 200) || null
  } catch {
    return null
  }
}

/** Link previews and crawlers fetch tagged links too; they are not visitors. */
export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|headless/i
