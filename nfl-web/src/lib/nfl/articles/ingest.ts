import { db } from '../../db'
import { seasonForecasts } from '../forecast'
import { nflSeasonModel, nflSim } from '../queries'
import { previewFacts, recapFacts, reportFacts, type FactInput, type GameStatLine } from './facts'
import { dueSlots, type Slot } from './slots'
import { buildArticlePrompt, checkArticle, parseArticleReply } from './writer'

const SECRET = () => process.env.CRON_SECRET!

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, { p_secret: SECRET(), ...args })
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

/**
 * One game's player lines with names, for the report's standouts. Read by
 * season, week and team: nfl_player_weeks has an index on season but none on
 * game_id, and a scan of 480,000 rows times out.
 */
async function statLines(slot: Slot): Promise<GameStatLine[]> {
  const { data, error } = await db().from('nfl_player_weeks')
    .select('team, passing_yards, passing_tds, interceptions, completions, attempts, rushing_yards, rushing_tds, carries, receptions, receiving_yards, receiving_tds, def_sacks, def_interceptions, tackles_solo, tackle_assists, forced_fumbles, nfl_players(name)')
    .eq('season', slot.season).eq('week', slot.week).in('team', slot.teams).eq('game_id', slot.game_id!).range(0, 199)
  if (error) throw new Error(`nfl_player_weeks: ${error.message}`)
  return (data ?? []).map((r) => {
    const { nfl_players: p, ...rest } = r as unknown as GameStatLine & { nfl_players: { name: string } | null }
    return { ...rest, name: p?.name ?? 'Óþekktur' }
  })
}

async function factsFor(slot: Slot, input: FactInput) {
  if (slot.kind === 'upphitun') return previewFacts(input, slot.season, slot.week)
  if (slot.kind === 'vikan') return recapFacts(input, slot.season, slot.week)
  return reportFacts(input, slot.game_id!, await statLines(slot))
}

/** Ask the configured model for one article; null when no model is set. */
export async function writeWithModel(prompt: string): Promise<{ text: string; model: string } | null> {
  const { NEWS_LLM_URL: url, NEWS_LLM_KEY: key, NEWS_LLM_MODEL: model } = process.env
  if (!url || !key || !model) return null
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`málíkanið svaraði ${res.status}`)
  const body = await res.json()
  return { text: body?.choices?.[0]?.message?.content ?? '', model }
}

export interface ArticleRun { due: number; drafted: number; failed: string[]; text: { written: number; rejected: string[] } | { skipped: string } }

/** The daily step: drafts for what is due, then machine text where a model is set. */
export async function draftArticles(season: number, now = new Date()): Promise<ArticleRun> {
  const [model, sim] = await Promise.all([nflSeasonModel(season), nflSim(season).catch(() => ({}))])
  const input: FactInput = { games: model.games, teams: model.teams, elo: model.elo, forecasts: seasonForecasts(model.games, model.elo, model.state), sim }
  const slots = dueSlots(model.games, now)
  const failed: string[] = []
  const rows = []
  for (const slot of slots) {
    try { rows.push({ ...slot, facts: await factsFor(slot, input) }) }
    catch (e) { failed.push(`${slot.slug}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const drafted = rows.length ? await rpc<number>('rpc_upsert_nfl_article_drafts', { p_rows: rows }) : 0

  let text: ArticleRun['text'] = { skipped: 'NEWS_LLM_* ekki stillt' }
  if (process.env.NEWS_LLM_URL && process.env.NEWS_LLM_KEY && process.env.NEWS_LLM_MODEL) {
    const waiting = await rpc<{ slug: string; kind: 'upphitun' | 'umfjollun' | 'vikan'; facts: unknown }[]>('rpc_nfl_articles_needing_text', {})
    const out = { written: 0, rejected: [] as string[] }
    // a few a run: the cron has a time limit, and the rest wait for tomorrow or an editor
    for (const a of waiting.slice(0, 8)) {
      try {
        const reply = await writeWithModel(buildArticlePrompt(a.kind, a.facts))
        if (!reply) break
        const article = parseArticleReply(reply.text)
        const problems = checkArticle(article, a.facts)
        if (problems.length) { out.rejected.push(`${a.slug}: ${problems.join('; ')}`); continue }
        out.written += await rpc<number>('rpc_set_nfl_article_text', { p_slug: a.slug, p_title: article.title, p_lede: article.lede, p_body: article.body, p_model: reply.model })
      } catch (e) { out.rejected.push(`${a.slug}: ${e instanceof Error ? e.message : String(e)}`) }
    }
    text = out
  }
  return { due: slots.length, drafted, failed, text }
}
