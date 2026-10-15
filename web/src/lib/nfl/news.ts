// Runs in the cron on the server: plain string parsing, no dev-only HTML library.

export const NEWS_FEEDS = [
  { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { source: 'ProFootballTalk', url: 'https://profootballtalk.nbcsports.com/feed/' },
  { source: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
  { source: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss/' },
] as const

/** The model only ever sees this much of the publisher's text. */
export const MAX_DESCRIPTION = 300

export interface FeedItem { url: string; source: string; title: string; description: string; published_at: string }
export interface Summary { url: string; title_is: string; summary_is: string }

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

/** First element with exactly this name; `description` does not match `media:description`. */
function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? m[1] : null
}

const plain = (html: string) => decode(decode(html).replace(/<[^>]+>/g, ' ')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function clip(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)).trim()
}

/**
 * Headline, link, date and the short description of each item. Never the
 * article: content:encoded (ProFootballTalk ships the whole piece there) is
 * ignored, and the description is stripped of HTML and clipped.
 */
export function parseRss(xml: string, source: string): FeedItem[] {
  const out: FeedItem[] = []
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const it = m[1]
    const title = plain(tag(it, 'title') ?? '')
    const url = plain(tag(it, 'link') ?? '')
    const date = new Date(plain(tag(it, 'pubDate') ?? ''))
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(date.getTime())) continue
    out.push({ url, source, title, description: clip(plain(tag(it, 'description') ?? ''), MAX_DESCRIPTION), published_at: date.toISOString() })
  }
  return out
}

/** Teams by nickname, case-sensitive: "New York" or "Los Angeles" alone names no one club. */
export function detectTeams(text: string, teams: { abbr: string; name: string }[]): string[] {
  const out = new Set<string>()
  for (const t of teams) {
    const nick = t.name.split(' ').pop()!
    if (new RegExp(`(^|[^A-Za-z0-9])${nick}([^A-Za-z0-9]|$)`).test(text)) out.add(t.abbr)
  }
  return [...out]
}

export const NEWS_INSTRUCTIONS = `Þú skrifar stuttar íslenskar NFL-fréttir fyrir íslenska íþróttasíðu.
Fyrir hverja frétt hér að neðan færðu fyrirsögn og stutta lýsingu frá erlendum fréttamiðli.
Skrifaðu íslenska fyrirsögn og stutta samantekt UM fréttina, í eigin orðum.

Reglur:
1. Skrifaðu í eigin orðum. Þýddu ekki orðrétt og afritaðu aldrei 8 orð eða fleiri í röð úr textanum.
2. Fyrirsögn: 3-14 orð. Samantekt: 2-3 setningar, 15-80 orð.
3. Byggðu aðeins á fyrirsögninni og lýsingunni. Bættu engu við sem þar stendur ekki.
4. Nöfn liða og leikmanna haldast óbreytt (t.d. Kansas City Chiefs, Patrick Mahomes).
5. Notaðu þessi orð: leikstjórnandi (quarterback), snertimark (touchdown), vallarmark (field goal),
   hlerun (interception), fella (sack), nýliði (rookie), riðill (division), deild (AFC/NFC),
   úrslitakeppni (playoffs), umspil (Wild Card), undanúrslit (Conference Championship), jardar (yards).
6. Skrifaðu ekki "samkvæmt ESPN" eða nafn miðilsins; heimildin birtist sjálfkrafa við fréttina.
7. Skilaðu AÐEINS JSON-fylki, ein færsla á frétt, í sömu röð:
   [{"url": "<sami tengill og í fréttinni>", "title_is": "<íslensk fyrirsögn>", "summary_is": "<íslensk samantekt>"}]`

export function buildPrompt(items: Pick<FeedItem, 'url' | 'source' | 'title' | 'description'>[]): string {
  return `${NEWS_INSTRUCTIONS}\n\nFréttir:\n${JSON.stringify(items.map(({ url, source, title, description }) => ({ url, source, title, description })), null, 2)}\n`
}

/** The JSON array out of a model reply, with or without a code fence around it. */
export function parseReply(text: string): Summary[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const body = fenced ? fenced[1] : text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  let data: unknown
  try { data = JSON.parse(body) } catch { throw new Error('Ekkert gilt JSON-fylki í svarinu') }
  if (!Array.isArray(data)) throw new Error('Ekkert gilt JSON-fylki í svarinu')
  return data.filter((x): x is Summary => !!x && typeof x.url === 'string' && typeof x.title_is === 'string' && typeof x.summary_is === 'string')
    .map(({ url, title_is, summary_is }) => ({ url: url.trim(), title_is: title_is.trim(), summary_is: summary_is.trim() }))
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
const grams = (ws: string[], n: number) => new Set(ws.slice(0, Math.max(ws.length - n + 1, 0)).map((_, i) => ws.slice(i, i + n).join(' ')))
export const COPY_LIMIT = 8

/** Reasons to reject a summary; empty when it may be written. */
export function validateSummary(s: Summary, item: Pick<FeedItem, 'url' | 'title' | 'description'>): string[] {
  const errors: string[] = []
  if (s.url !== item.url) errors.push('tengillinn passar ekki við frétt sem var send')
  const tw = words(s.title_is).length
  if (tw < 3 || tw > 14) errors.push(`Fyrirsögn er ${tw} orð (á að vera 3-14)`)
  const sw = words(s.summary_is).length
  if (sw < 15 || sw > 80) errors.push(`samantekt er ${sw} orð (á að vera 15-80)`)
  const source = grams(words(`${item.title} ${item.description}`), COPY_LIMIT)
  const mine = [...grams(words(`${s.title_is} ${s.summary_is}`), COPY_LIMIT)]
  const copied = mine.find((g) => source.has(g))
  if (copied) errors.push(`${COPY_LIMIT} orð afrituð úr upprunanum: "${copied}"`)
  return errors
}
