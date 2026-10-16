import { db } from '../db'
import { isRumour } from './rumours'
import { buildPrompt, detectTeams, NEWS_FEEDS, parseReply, parseRss, validateSummary, type FeedItem, type Summary } from './news'

const SECRET = () => process.env.CRON_SECRET!
const UA = { 'User-Agent': 'besta-spain-nfl/1.0' }
export const SUMMARY_BATCH = 20

/** Pull the four feeds and store items not seen before. A feed that fails is reported, not fatal. */
export async function fetchNews(teams: { abbr: string; name: string }[]): Promise<{ found: number; added: number; failed: string[] }> {
  const items: (FeedItem & { teams: string[]; rumour: boolean })[] = []
  const failed: string[] = []
  await Promise.all(NEWS_FEEDS.map(async (f) => {
    try {
      const res = await fetch(f.url, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(String(res.status))
      for (const it of parseRss(await res.text(), f.source)) items.push({ ...it, teams: detectTeams(`${it.title} ${it.description}`, teams), rumour: isRumour(`${it.title} ${it.description}`) })
    } catch (e) {
      failed.push(`${f.source}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }))
  if (!items.length) return { found: 0, added: 0, failed }
  const { data, error } = await db().rpc('rpc_insert_nfl_news', { p_secret: SECRET(), p_rows: items })
  if (error) throw new Error(`rpc_insert_nfl_news: ${error.message}`)
  return { found: items.length, added: data as number, failed }
}

/** Items still without an Icelandic summary from the last week: trade talk first, then the newest. */
export async function pendingNews(limit = SUMMARY_BATCH): Promise<FeedItem[]> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data, error } = await db().from('nfl_news').select('url, source, title, description, published_at')
    .is('summary_is', null).gte('published_at', since).order('rumour', { ascending: false }).order('published_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as FeedItem[]
}

/** Check every summary against the item it belongs to and write those that pass. */
export async function writeSummaries(summaries: Summary[], model: string, dry = false): Promise<{ written: number; rejected: string[] }> {
  const urls = summaries.map((s) => s.url)
  const { data, error } = await db().from('nfl_news').select('url, title, description').in('url', urls)
  if (error) throw error
  const items = new Map((data ?? []).map((r) => [r.url as string, r as Pick<FeedItem, 'url' | 'title' | 'description'>]))
  let written = 0
  const rejected: string[] = []
  for (const s of summaries) {
    const item = items.get(s.url)
    const errors = item ? validateSummary(s, item) : ['tengillinn passar ekki við frétt í gagnagrunninum']
    if (errors.length) { rejected.push(`${s.url}: ${errors.join('; ')}`); continue }
    if (dry) { written++; continue }
    const { error: e } = await db().rpc('rpc_set_nfl_news_summary', { p_secret: SECRET(), p_url: s.url, p_title_is: s.title_is, p_summary_is: s.summary_is, p_model: model })
    if (e) rejected.push(`${s.url}: ${e.message}`)
    else written++
  }
  return { written, rejected }
}

/**
 * When NEWS_LLM_URL/KEY/MODEL are set, summarise up to 20 pending items in one
 * chat-completions call (any OpenAI-style service). Otherwise does nothing: the
 * manual route is scripts/nfl-news-prompt.mts and nfl-news-import.mts.
 */
export async function summarizeNews(): Promise<{ written: number; rejected: string[] } | { skipped: string }> {
  const { NEWS_LLM_URL: url, NEWS_LLM_KEY: key, NEWS_LLM_MODEL: model } = process.env
  if (!url || !key || !model) return { skipped: 'NEWS_LLM_* ekki stillt' }
  const pending = await pendingNews()
  if (!pending.length) return { written: 0, rejected: [] }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: 'user', content: buildPrompt(pending) }] }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`samantektarþjónusta svaraði ${res.status}`)
  const body = await res.json()
  const text: string = body?.choices?.[0]?.message?.content ?? ''
  return writeSummaries(parseReply(text), model)
}
