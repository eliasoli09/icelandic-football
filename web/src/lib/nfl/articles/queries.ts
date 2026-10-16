import { db } from '../../db'
import type { ArticleKind } from './slots'

/** Published articles only: RLS shows readers nothing else. */
export interface PublishedArticle {
  slug: string
  kind: ArticleKind
  title: string
  lede: string
  body: string
  season: number | null
  week: number | null
  game_id: string | null
  teams: string[]
  published_at: string
  updated_at: string
}

const COLUMNS = 'slug, kind, title, lede, body, season, week, game_id, teams, published_at, updated_at'

export async function nflArticles(opts: { limit?: number; kind?: ArticleKind } = {}): Promise<PublishedArticle[]> {
  let q = db().from('nfl_article').select(COLUMNS).eq('status', 'published').order('published_at', { ascending: false }).limit(opts.limit ?? 50)
  if (opts.kind) q = q.eq('kind', opts.kind)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as PublishedArticle[]
}

export async function nflArticle(slug: string): Promise<PublishedArticle | null> {
  const { data, error } = await db().from('nfl_article').select(COLUMNS).eq('status', 'published').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as PublishedArticle | null
}

/** A game's report and its round's preview. */
export async function nflGameArticles(gameId: string, season: number, week: number): Promise<PublishedArticle[]> {
  const { data, error } = await db().from('nfl_article').select(COLUMNS).eq('status', 'published')
    .or(`game_id.eq.${gameId},and(kind.eq.upphitun,season.eq.${season},week.eq.${week})`)
  if (error) throw error
  return (data ?? []) as PublishedArticle[]
}
