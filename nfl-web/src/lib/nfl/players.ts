import { table } from './csv'

/** Our column <- nflverse column(s); several are summed. */
const STAT_MAP = {
  completions: ['completions'],
  attempts: ['attempts'],
  passing_yards: ['passing_yards'],
  passing_tds: ['passing_tds'],
  interceptions: ['passing_interceptions'],
  sacks_taken: ['sacks_suffered'],
  passing_epa: ['passing_epa'],
  carries: ['carries'],
  rushing_yards: ['rushing_yards'],
  rushing_tds: ['rushing_tds'],
  rushing_epa: ['rushing_epa'],
  receptions: ['receptions'],
  targets: ['targets'],
  receiving_yards: ['receiving_yards'],
  receiving_tds: ['receiving_tds'],
  receiving_epa: ['receiving_epa'],
  fumbles_lost: ['sack_fumbles_lost', 'rushing_fumbles_lost', 'receiving_fumbles_lost'],
  tackles_solo: ['def_tackles_solo'],
  tackle_assists: ['def_tackle_assists'],
  tackles_for_loss: ['def_tackles_for_loss'],
  def_sacks: ['def_sacks'],
  qb_hits: ['def_qb_hits'],
  def_interceptions: ['def_interceptions'],
  passes_defended: ['def_pass_defended'],
  forced_fumbles: ['def_fumbles_forced'],
  def_tds: ['def_tds'],
  special_teams_tds: ['special_teams_tds'],
} as const

export type Stat = keyof typeof STAT_MAP
export const STATS = Object.keys(STAT_MAP) as Stat[]
type Stats = Record<Stat, number>

export interface PlayerWeek extends Stats {
  player_id: string
  season: number
  week: number
  season_type: 'REG' | 'POST'
  game_id: string
  team: string
  opponent: string
}

export interface NflPlayer {
  player_id: string
  name: string
  position: string | null
  position_group: string | null
  team: string | null
  jersey: number | null
  rookie_season: number | null
  draft_year: number | null
  draft_round: number | null
  draft_pick: number | null
  draft_team: string | null
  college: string | null
  birth_date: string | null
  headshot: string | null
}

const ID_COLS = ['player_id', 'player_display_name', 'position', 'position_group', 'headshot_url', 'season', 'week', 'season_type', 'game_id', 'team', 'opponent_team']
const num = (s: string | undefined) => {
  if (s === undefined || s === '' || s === 'NA') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
const opt = (s: string | undefined) => (s === undefined || s === '' || s === 'NA' ? null : s)
const optNum = (s: string | undefined) => { const v = opt(s); return v === null || !Number.isFinite(Number(v)) ? null : Number(v) }

/** Weekly rows plus name/position as the weekly file has them, for players missing from players.csv. */
export function parsePlayerWeeks(csv: string): { weeks: PlayerWeek[]; seen: Map<string, Pick<NflPlayer, 'name' | 'position' | 'position_group' | 'headshot'>> } {
  const required = [...ID_COLS, ...Object.values(STAT_MAP).flat()]
  const seen = new Map<string, Pick<NflPlayer, 'name' | 'position' | 'position_group' | 'headshot'>>()
  const weeks = table(csv, required).map((r) => {
    seen.set(r.player_id, { name: r.player_display_name, position: opt(r.position), position_group: opt(r.position_group), headshot: opt(r.headshot_url) })
    const stats = Object.fromEntries(STATS.map((k) => [k, STAT_MAP[k].reduce((t, c) => t + num(r[c]), 0)])) as Stats
    return {
      player_id: r.player_id, season: Number(r.season), week: Number(r.week), season_type: r.season_type as 'REG' | 'POST',
      game_id: r.game_id, team: r.team, opponent: r.opponent_team, ...stats,
    }
  })
  return { weeks, seen }
}

/** Master rows for the players in `seen`; anyone missing is built from the weekly file. */
export function parsePlayers(csv: string, seen: Map<string, Pick<NflPlayer, 'name' | 'position' | 'position_group' | 'headshot'>>): NflPlayer[] {
  const out = new Map<string, NflPlayer>()
  for (const r of table(csv, ['gsis_id', 'display_name', 'position', 'position_group', 'latest_team', 'jersey_number', 'rookie_season', 'draft_year', 'draft_round', 'draft_pick', 'draft_team', 'college_name', 'birth_date', 'headshot'])) {
    if (!seen.has(r.gsis_id)) continue
    out.set(r.gsis_id, {
      player_id: r.gsis_id, name: r.display_name, position: opt(r.position), position_group: opt(r.position_group), team: opt(r.latest_team),
      jersey: optNum(r.jersey_number), rookie_season: optNum(r.rookie_season), draft_year: optNum(r.draft_year),
      draft_round: optNum(r.draft_round), draft_pick: optNum(r.draft_pick), draft_team: opt(r.draft_team),
      college: opt(r.college_name), birth_date: opt(r.birth_date), headshot: opt(r.headshot) ?? seen.get(r.gsis_id)!.headshot,
    })
  }
  for (const [id, s] of seen) if (!out.has(id)) {
    out.set(id, { player_id: id, ...s, team: null, jersey: null, rookie_season: null, draft_year: null, draft_round: null, draft_pick: null, draft_team: null, college: null, birth_date: null })
  }
  return [...out.values()]
}

export interface SeasonTotal extends Stats { player_id: string; season: number; games: number; team: string }

/** Sum one season's weekly rows per player; the team is the last one the player turned out for. */
export function seasonTotals(weeks: PlayerWeek[]): Map<string, SeasonTotal> {
  const out = new Map<string, SeasonTotal>()
  for (const w of [...weeks].sort((a, b) => a.week - b.week)) {
    const key = `${w.player_id}`
    const t = out.get(key) ?? ({ player_id: w.player_id, season: w.season, games: 0, team: w.team, ...Object.fromEntries(STATS.map((k) => [k, 0])) } as SeasonTotal)
    t.games++
    t.team = w.team
    for (const k of STATS) t[k] += w[k]
    out.set(key, t)
  }
  for (const t of out.values()) for (const k of STATS) t[k] = Math.round(t[k] * 1000) / 1000
  return out
}

/** Top n by a stat, ties by name order of input then id; zero never leads. */
export function leaders<T extends { player_id: string }>(rows: T[], stat: keyof T, n = 10, keep: (t: T) => boolean = () => true): T[] {
  return rows
    .filter((t) => keep(t) && Number(t[stat]) > 0)
    .sort((a, b) => Number(b[stat]) - Number(a[stat]) || a.player_id.localeCompare(b.player_id))
    .slice(0, n)
}

export function ageOn(birth: string | null, on: Date): number | null {
  if (!birth) return null
  const [y, m, d] = birth.split('-').map(Number)
  let age = on.getUTCFullYear() - y
  if (on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d)) age--
  return age
}

export function draftLabel(p: Pick<NflPlayer, 'draft_year' | 'draft_round' | 'draft_pick'>): string {
  if (!p.draft_year || !p.draft_round || !p.draft_pick) return 'Ekki valinn'
  return `${p.draft_round}. umferð, ${p.draft_pick}. val ${p.draft_year}`
}

export type StatGroup = 'sendingar' | 'hlaup' | 'gripir' | 'vorn'
const DEFENCE = new Set(['DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'EDGE', 'CB', 'S', 'FS', 'SS', 'DB', 'SAF'])

/** Which stat groups describe a position, most important first. */
export function statGroups(position: string | null): StatGroup[] {
  if (position === 'QB') return ['sendingar', 'hlaup']
  if (position === 'RB' || position === 'FB' || position === 'HB') return ['hlaup', 'gripir']
  if (position === 'WR' || position === 'TE') return ['gripir', 'hlaup']
  if (position && DEFENCE.has(position)) return ['vorn']
  return []
}

/**
 * The NFL serves headshots at full size (up to 4 MB). Ask its image service
 * for a face-cropped square at twice the display size instead (about 11 kB).
 * Any other URL is left alone.
 */
export function headshotUrl(src: string | null, px: number): string | null {
  if (!src) return null
  const m = /^(https:\/\/static\.www\.nfl\.com\/image\/(?:upload|private)\/)f_auto,q_auto\/(.+)$/.exec(src)
  if (!m) return src
  const s = Math.round(px * 2)
  return `${m[1]}f_auto,q_auto,w_${s},h_${s},c_fill,g_face/${m[2]}`
}
