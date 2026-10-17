/** The NFL's own YouTube channel. */
export const NFL_CHANNEL = 'UCDVYQ4Zhbm3S2dlz7P1GBDg'
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${NFL_CHANNEL}`

export interface Video { id: string; title: string; published: string; short: boolean }

const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** The videos of a channel's RSS feed, newest first. Anything malformed is skipped. */
export function parseFeed(xml: string): Video[] {
  const out: Video[] = []
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = /<yt:videoId>([\w-]{6,20})<\/yt:videoId>/.exec(entry)?.[1]
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]
    const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1]
    if (!id || !title || !published) continue
    out.push({ id, title: unescape(title.trim()), published, short: entry.includes('/shorts/') })
  }
  return out.sort((a, b) => b.published.localeCompare(a.published))
}

/** Videos naming one of the clubs (by nickname, e.g. "Chiefs"); all of them when no club is chosen. */
export function forClubs(videos: Video[], nicknames: string[]): Video[] {
  if (!nicknames.length) return videos
  const re = new RegExp(`\\b(${nicknames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')
  return videos.filter((v) => re.test(v.title))
}
