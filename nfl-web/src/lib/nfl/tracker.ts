import type { LivePlayer, LiveTeamStats } from './live'

// ---------- fantasy ----------

export type Scoring = 'ppr' | 'half' | 'std'
export const SCORING_LABEL: Record<Scoring, string> = { ppr: 'PPR', half: 'Hálft PPR', std: 'Staðlað' }

/** A player's fantasy points: 25 passing yards a point, 4 a passing touchdown, −2 an interception, 10 rushing or receiving yards a point, 6 a touchdown, −2 a lost fumble, 2 a two-point play, plus a point (or half) a catch; kickers as counted. */
export function playerPoints(p: LivePlayer, s: Scoring): number {
  const catch_ = s === 'ppr' ? 1 : s === 'half' ? 0.5 : 0
  return p.passYds / 25 + 4 * p.passTd - 2 * p.ints + (p.rushYds + p.recYds) / 10 + 6 * (p.rushTd + p.recTd)
    - 2 * p.fumLost + 2 * p.twoPt + catch_ * p.rec + p.kPts
}

/** A team defence: a point a sack, two an interception, fumble recovery or safety, six a touchdown, and 10 to −4 by points allowed. */
export function defencePoints(t: LiveTeamStats): number {
  const pa = t.pointsAgainst
  const allowed = pa === 0 ? 10 : pa <= 6 ? 7 : pa <= 13 ? 4 : pa <= 20 ? 1 : pa <= 27 ? 0 : pa <= 34 ? -1 : -4
  return t.sacks + 2 * (t.ints + t.fumRec + t.safeties) + 6 * t.defTd + allowed
}

/** A name for matching across feeds: no accents, case, punctuation or Jr./III. */
export const normName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '')

/** A player on someone's fantasy team; a defence is `DST:<club>`. */
export interface RosterPlayer { player_id: string; name: string; team: string; position: string | null; headshot?: string | null; bench?: boolean }
export const isDefence = (r: Pick<RosterPlayer, 'player_id'>) => r.player_id.startsWith('DST:')

/** The live line for a roster player: same name and club, else the only player by that name. */
export function findLive<T extends { name: string; team: string }>(r: Pick<RosterPlayer, 'name' | 'team'>, live: T[]): T | undefined {
  const n = normName(r.name)
  const same = live.filter((p) => normName(p.name) === n)
  return same.find((p) => p.team === r.team) ?? (same.length === 1 ? same[0] : undefined)
}

// ---------- bets ----------

export type BetLeg =
  | { kind: 'win'; game_id: string; team: string; odds?: number }
  | { kind: 'td'; game_id: string; player_id: string; name: string; team: string }
  | { kind: 'yards'; game_id: string; player_id: string; name: string; team: string; stat: 'pass' | 'rush' | 'rec'; line: number }

export interface TrackedSlip { id: string; name: string; legs: BetLeg[]; odds: number | null; stake: number | null; fair?: boolean; created: string }

/** The few facts about a game a leg needs. */
export interface GameNow { game_id: string; home: string; away: string; homeScore: number | null; awayScore: number | null; live: boolean; final: boolean }

export type LegStatus = 'won' | 'lost' | 'ahead' | 'behind' | 'open'
export interface LegState { status: LegStatus; now: string | null }

const STAT: Record<'pass' | 'rush' | 'rec', (p: LivePlayer) => number> = { pass: (p) => p.passYds, rush: (p) => p.rushYds, rec: (p) => p.recYds }
export const STAT_LABEL: Record<'pass' | 'rush' | 'rec', string> = { pass: 'sendingajardar', rush: 'hlaupajardar', rec: 'gripjardar' }

/**
 * Where a leg stands. A win is ahead or behind on the score while the game is on;
 * a touchdown or a yards line is won the moment it happens, lost only when the
 * game is over, and open until then.
 */
export function legState(leg: BetLeg, game: GameNow | undefined, player: LivePlayer | undefined): LegState {
  const started = !!game && (game.live || game.final) && game.homeScore !== null && game.awayScore !== null
  if (leg.kind === 'win') {
    if (!game || !started) return { status: 'open', now: null }
    const us = leg.team === game.home ? game.homeScore! : game.awayScore!
    const them = leg.team === game.home ? game.awayScore! : game.homeScore!
    const now = `${us}-${them}`
    if (game.final) return { status: us > them ? 'won' : 'lost', now }
    return { status: us > them ? 'ahead' : us < them ? 'behind' : 'open', now }
  }
  if (leg.kind === 'td') {
    const tds = player ? player.rushTd + player.recTd : 0
    if (tds > 0) return { status: 'won', now: `${tds} snertim.` }
    return { status: game?.final ? 'lost' : 'open', now: started ? '0 snertim.' : null }
  }
  const v = player ? STAT[leg.stat](player) : 0
  const now = started ? `${v} / ${String(leg.line).replace('.', ',')}` : null
  if (v > leg.line) return { status: 'won', now }
  return { status: game?.final ? 'lost' : 'open', now }
}

/** A slip is lost with one lost leg, won with every leg won, otherwise still going. */
export function slipStatus(states: LegState[]): 'won' | 'lost' | 'open' {
  if (states.some((s) => s.status === 'lost')) return 'lost'
  return states.length && states.every((s) => s.status === 'won') ? 'won' : 'open'
}

// ---------- reading a screenshot ----------

/** A name as a fantasy app shows it: "Patrick Mahomes", "P. Mahomes" or "Mahomes". */
export interface ShownName { name: string; team: string; position: string }

const parts = (n: string) => {
  const words = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').split(/[\s.]+/).filter(Boolean)
  return { first: words.length > 1 ? words[0] : '', last: normName(words.slice(words.length > 1 ? 1 : 0).join('')) }
}

/**
 * The player a shown name most likely is, from candidates sharing the surname:
 * the full name if it matches, else the first initial, then the club, then the
 * position break ties. None when it stays ambiguous.
 */
export function matchShown<T extends { name: string; team: string | null; position: string | null }>(shown: ShownName, candidates: T[]): T | null {
  const s = parts(shown.name)
  const full = candidates.filter((c) => normName(c.name) === normName(shown.name))
  let pool = full.length ? full : candidates.filter((c) => {
    const p = parts(c.name)
    return p.last === s.last && (!s.first || p.first.startsWith(s.first.replace(/\W/g, '')) || s.first.length === 1 && p.first[0] === s.first)
  })
  if (pool.length > 1 && shown.team) pool = pool.filter((c) => c.team && franchise(c.team) === franchise(shown.team)).length ? pool.filter((c) => c.team && franchise(c.team) === franchise(shown.team)) : pool
  if (pool.length > 1 && shown.position) pool = pool.filter((c) => c.position === shown.position).length ? pool.filter((c) => c.position === shown.position) : pool
  return pool.length === 1 ? pool[0] : null
}
const franchise = (t: string) => ({ LAR: 'LA', OAK: 'LV', SD: 'LAC', STL: 'LA' } as Record<string, string>)[t] ?? t
