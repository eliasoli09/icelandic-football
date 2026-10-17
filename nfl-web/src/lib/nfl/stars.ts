/**
 * Stjörnulið vikunnar: one player per position and a flex, plus the week's
 * quarterback, offensive and defensive player. Pure; the page feeds it one
 * round's player lines.
 */

export type StarSlot = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'DL' | 'LB' | 'DB'

export const SLOT_LABEL: Record<StarSlot, string> = {
  QB: 'Leikstjórnandi', RB: 'Hlaupari', WR: 'Útherji', TE: 'Innherji', FLEX: 'Flex',
  DL: 'Varnarlína', LB: 'Línuvörður', DB: 'Varnarbakvörður',
}

export interface StarLine {
  player_id: string
  name: string
  position: string | null
  headshot: string | null
  team: string
  opponent: string | null
  game_id: string | null
  completions: number; attempts: number; passing_yards: number; passing_tds: number; interceptions: number
  carries: number; rushing_yards: number; rushing_tds: number
  receptions: number; receiving_yards: number; receiving_tds: number; fumbles_lost: number
  tackles_solo: number; tackle_assists: number; tackles_for_loss: number; def_sacks: number; qb_hits: number
  def_interceptions: number; passes_defended: number; forced_fumbles: number; def_tds: number
}

const GROUP: Record<string, Exclude<StarSlot, 'FLEX'>> = {
  QB: 'QB', RB: 'RB', FB: 'RB', HB: 'RB', WR: 'WR', TE: 'TE',
  DE: 'DL', DT: 'DL', NT: 'DL', DL: 'DL', EDGE: 'DL',
  LB: 'LB', ILB: 'LB', OLB: 'LB', MLB: 'LB',
  CB: 'DB', S: 'DB', SS: 'DB', FS: 'DB', DB: 'DB', SAF: 'DB',
}
export const groupOf = (position: string | null) => (position ? GROUP[position.toUpperCase()] ?? null : null)

const round1 = (x: number) => Math.round(x * 10) / 10

/** Fantasy-style points (half a point a catch): yards, touchdowns, minus turnovers. */
export function offenceScore(l: StarLine): number {
  return round1(l.passing_yards / 25 + 4 * l.passing_tds - 2 * l.interceptions
    + l.rushing_yards / 10 + 6 * l.rushing_tds
    + 0.5 * l.receptions + l.receiving_yards / 10 + 6 * l.receiving_tds - 2 * l.fumbles_lost)
}

/** The plays that end drives count most: sacks, takeaways, touchdowns; then tackles. */
export function defenceScore(l: StarLine): number {
  return round1(l.tackles_solo + 0.5 * l.tackle_assists + 1.5 * l.tackles_for_loss + 4 * l.def_sacks + l.qb_hits
    + 5 * l.def_interceptions + 1.5 * l.passes_defended + 4 * l.forced_fumbles + 6 * l.def_tds)
}

export interface Star { slot: StarSlot; line: StarLine; score: number }
export interface StarWeek {
  team: Star[]
  qb: Star | null
  offence: Star | null
  defence: Star | null
}

const isDefence = (g: StarSlot) => g === 'DL' || g === 'LB' || g === 'DB'
const best = <T extends { line: StarLine; score: number }>(xs: T[]) => [...xs].sort((a, b) => b.score - a.score || a.line.name.localeCompare(b.line.name))

/** The team of the week and the three awards from one round's player lines. */
export function starWeek(lines: StarLine[]): StarWeek {
  const scored = lines.flatMap((line) => {
    const g = groupOf(line.position)
    if (!g) return []
    return [{ group: g, line, score: isDefence(g) ? defenceScore(line) : offenceScore(line) }]
  })
  const team: Star[] = []
  const taken = new Set<string>()
  for (const slot of ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'] as const) {
    const top = best(scored.filter((x) => x.group === slot))[0]
    if (top && top.score > 0) { team.push({ slot, line: top.line, score: top.score }); taken.add(top.line.player_id) }
  }
  const flex = best(scored.filter((x) => (x.group === 'RB' || x.group === 'WR' || x.group === 'TE') && !taken.has(x.line.player_id)))[0]
  if (flex && flex.score > 0) team.splice(4, 0, { slot: 'FLEX', line: flex.line, score: flex.score })
  const top = (xs: typeof scored) => { const b = best(xs)[0]; return b && b.score > 0 ? { slot: b.group, line: b.line, score: b.score } : null }
  return {
    team,
    qb: top(scored.filter((x) => x.group === 'QB')),
    offence: top(scored.filter((x) => x.group === 'RB' || x.group === 'WR' || x.group === 'TE')),
    defence: top(scored.filter((x) => isDefence(x.group))),
  }
}

/** The line people read under a name: "312 jardar, 3 snertimörk" or "2 fellur, 1 hlerun". */
export function statLine(l: StarLine, slot: StarSlot): string {
  const parts: string[] = []
  const n = (x: number) => String(x).replace('.', ',')
  if (slot === 'QB') {
    parts.push(`${l.completions}/${l.attempts}`, `${l.passing_yards} sendingajardar`, `${l.passing_tds} snertim.`)
    if (l.interceptions) parts.push(`${l.interceptions} hler.`)
    if (l.rushing_yards >= 20 || l.rushing_tds) parts.push(`${l.rushing_yards} hlaupajardar`)
  } else if (isDefence(slot)) {
    const tk = l.tackles_solo + l.tackle_assists
    if (l.def_sacks) parts.push(`${n(l.def_sacks)} fell${l.def_sacks === 1 ? 'a' : 'ur'}`)
    if (l.def_interceptions) parts.push(`${l.def_interceptions} hler.`)
    if (l.forced_fumbles) parts.push(`${l.forced_fumbles} þv. boltamissir`)
    if (l.def_tds) parts.push(`${l.def_tds} snertim.`)
    parts.push(`${tk} tæklingar`)
  } else {
    if (l.carries) parts.push(`${l.carries} hlaup, ${l.rushing_yards} jardar`)
    if (l.receptions) parts.push(`${l.receptions} grip, ${l.receiving_yards} jardar`)
    const td = l.rushing_tds + l.receiving_tds
    if (td) parts.push(`${td} snertim.`)
  }
  return parts.join(' · ')
}
