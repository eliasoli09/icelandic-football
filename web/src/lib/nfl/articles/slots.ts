import { isPlayed, type NflGame } from '../types'

/** The articles the engine drafts; `grein` is written by an editor from scratch. */
export type ArticleKind = 'upphitun' | 'umfjollun' | 'vikan' | 'grein'

export interface Slot { kind: Exclude<ArticleKind, 'grein'>; slug: string; season: number; week: number; game_id: string | null; teams: string[] }

const DAY = 24 * 3600 * 1000
/** A round preview is drafted this long before its first kickoff. */
export const PREVIEW_LEAD = 3 * DAY
/** Reports and recaps are drafted only for games this recent: no backfilling a whole season. */
export const RECENT = 4 * DAY

type SlotGame = Pick<NflGame, 'game_id' | 'season' | 'week' | 'kickoff' | 'home' | 'away' | 'home_score' | 'away_score'>

export const previewSlug = (season: number, week: number) => `upphitun-${season}-v${week}`
export const recapSlug = (season: number, week: number) => `vikan-${season}-v${week}`
export const reportSlug = (g: Pick<NflGame, 'season' | 'week' | 'home' | 'away'>) => `umfjollun-${g.away.toLowerCase()}-${g.home.toLowerCase()}-${g.season}-v${g.week}`

/** Every draft that should exist now, from one season's games. */
export function dueSlots(games: SlotGame[], now: Date): Slot[] {
  const t = now.getTime()
  const rounds = new Map<string, SlotGame[]>()
  for (const g of games) rounds.set(`${g.season}:${g.week}`, [...(rounds.get(`${g.season}:${g.week}`) ?? []), g])
  const out: Slot[] = []
  for (const round of rounds.values()) {
    const { season, week } = round[0]
    const kicks = round.map((g) => new Date(g.kickoff).getTime())
    const first = Math.min(...kicks)
    const teams = [...new Set(round.flatMap((g) => [g.home, g.away]))].sort()
    if (t >= first - PREVIEW_LEAD && t < first) out.push({ kind: 'upphitun', slug: previewSlug(season, week), season, week, game_id: null, teams })
    for (const g of round) {
      const k = new Date(g.kickoff).getTime()
      if (isPlayed(g) && k <= t && t - k <= RECENT) out.push({ kind: 'umfjollun', slug: reportSlug(g), season, week, game_id: g.game_id, teams: [g.away, g.home] })
    }
    const last = Math.max(...kicks)
    if (round.every(isPlayed) && t - last <= RECENT) out.push({ kind: 'vikan', slug: recapSlug(season, week), season, week, game_id: null, teams })
  }
  return out
}

/** A URL-safe slug from an Icelandic headline: "Mahomes snýr aftur" → "mahomes-snyr-aftur". */
export function slugify(title: string): string {
  const map: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ý: 'y', ð: 'd', þ: 'th', æ: 'ae', ö: 'o' }
  return title.toLowerCase().replace(/[áéíóúýðþæö]/g, (c) => map[c]).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'grein'
}
