'use client'

import { browserDb } from '../../leaderboard/store'
import type { ArticleKind } from './slots'

/** The editor's reads and writes, as the signed-in editor (RLS: nfl_editor). */

export interface Article {
  id: string
  slug: string
  kind: ArticleKind
  status: 'draft' | 'published'
  title: string
  lede: string
  body: string
  season: number | null
  week: number | null
  game_id: string | null
  teams: string[]
  facts: unknown
  model: string | null
  edited: boolean
  updated_at: string
  published_at: string | null
}

export async function amEditor(): Promise<boolean> {
  const { data } = await browserDb().rpc('is_nfl_editor')
  return data === true
}

export async function listArticles(): Promise<Article[]> {
  const { data, error } = await browserDb().from('nfl_article')
    .select('id, slug, kind, status, title, lede, body, season, week, game_id, teams, model, edited, updated_at, published_at')
    .order('updated_at', { ascending: false }).range(0, 199)
  if (error) throw new Error(error.message)
  return (data ?? []) as Article[]
}

export async function getArticle(id: string): Promise<Article | null> {
  const { data, error } = await browserDb().from('nfl_article').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Article | null
}

export async function newArticle(author: string): Promise<string> {
  const { data, error } = await browserDb().from('nfl_article')
    .insert({ slug: `grein-${Date.now().toString(36)}`, kind: 'grein', author, edited: true }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function saveArticle(id: string, patch: Partial<Pick<Article, 'title' | 'lede' | 'body' | 'slug' | 'status' | 'published_at'>>): Promise<void> {
  const { data, error } = await browserDb().from('nfl_article')
    .update({ ...patch, edited: true, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw new Error(error.code === '23505' ? 'Önnur grein hefur þegar þessa slóð' : error.message)
  if (!data?.length) throw new Error('Vistaðist ekki: ertu enn skráð(ur) inn sem ritstjóri?')
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await browserDb().from('nfl_article').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
