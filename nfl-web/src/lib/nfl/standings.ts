import { CONFERENCES, DIVISIONS, isPlayed, type Conference, type Division, type NflGame, type NflTeam } from './types'

export type Criterion = 'h2h' | 'division' | 'common' | 'conference' | 'sov' | 'diff' | 'alpha'

export interface WLT { w: number; l: number; t: number }
export interface TeamRecord extends WLT {
  abbr: string
  pf: number
  pa: number
  div: WLT
  conf: WLT
  /** "S3" = three wins in a row, "T1", "J1"; empty before the first game. */
  streak: string
}
export interface Ranked { abbr: string; reason: Criterion | null }
export interface Standings {
  records: Record<string, TeamRecord>
  divisions: Record<Conference, Record<Division, Ranked[]>>
  /** All 16 per conference; the first seven are the playoff seeds. */
  seeds: Record<Conference, Ranked[]>
}

export const pct = (r: WLT) => {
  const n = r.w + r.l + r.t
  return n ? (r.w + r.t / 2) / n : 0
}
// equal records must compare equal, whatever the float path
const key = (x: number) => Math.round(x * 1e9)

const blank = (): WLT => ({ w: 0, l: 0, t: 0 })
const add = (r: WLT, res: 'S' | 'T' | 'J') => { if (res === 'S') r.w++; else if (res === 'T') r.l++; else r.t++ }

/** Standings from regular-season games. Unplayed games are ignored. */
export function computeStandings(games: NflGame[], teams: NflTeam[]): Standings {
  const info = new Map(teams.map((t) => [t.abbr, t]))
  const records: Record<string, TeamRecord> = {}
  for (const t of teams) records[t.abbr] = { abbr: t.abbr, ...blank(), pf: 0, pa: 0, div: blank(), conf: blank(), streak: '' }

  const played = games.filter((g) => g.game_type === 'REG' && isPlayed(g)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const results = new Map<string, ('S' | 'T' | 'J')[]>()
  for (const g of played) {
    const sides: [string, string, number, number][] = [
      [g.home, g.away, g.home_score!, g.away_score!],
      [g.away, g.home, g.away_score!, g.home_score!],
    ]
    for (const [me, opp, own, other] of sides) {
      const r = records[me]
      const a = info.get(me)
      const b = info.get(opp)
      if (!r || !a || !b) continue
      const res = own > other ? 'S' : own < other ? 'T' : 'J'
      add(r, res)
      r.pf += own
      r.pa += other
      if (a.conference === b.conference) {
        add(r.conf, res)
        if (a.division === b.division) add(r.div, res)
      }
      results.set(me, [...(results.get(me) ?? []), res])
    }
  }
  for (const [abbr, rs] of results) {
    const last = rs[rs.length - 1]
    let k = 0
    for (let i = rs.length - 1; i >= 0 && rs[i] === last; i--) k++
    records[abbr].streak = `${last}${k}`
  }

  const metAll = (group: string[]) =>
    group.every((a) => group.every((b) => a === b || played.some((g) => (g.home === a && g.away === b) || (g.home === b && g.away === a))))
  const h2h = (abbr: string, group: string[]) => {
    const r = blank()
    for (const g of played) {
      if (g.home === abbr && group.includes(g.away)) add(r, g.home_score! > g.away_score! ? 'S' : g.home_score! < g.away_score! ? 'T' : 'J')
      if (g.away === abbr && group.includes(g.home)) add(r, g.away_score! > g.home_score! ? 'S' : g.away_score! < g.home_score! ? 'T' : 'J')
    }
    return pct(r)
  }

  const opponents = (abbr: string) => new Set(played.flatMap((g) => (g.home === abbr ? [g.away] : g.away === abbr ? [g.home] : [])))
  /** Opponents every club in the group has played. */
  const commonOpps = (group: string[]) => {
    const sets = group.map(opponents)
    return [...sets[0]].filter((o) => !group.includes(o) && sets.every((s) => s.has(o)))
  }
  const vsSet = (abbr: string, opps: string[]) => {
    const r = blank()
    for (const g of played) {
      if (g.home === abbr && opps.includes(g.away)) add(r, g.home_score! > g.away_score! ? 'S' : g.home_score! < g.away_score! ? 'T' : 'J')
      if (g.away === abbr && opps.includes(g.home)) add(r, g.away_score! > g.home_score! ? 'S' : g.away_score! < g.home_score! ? 'T' : 'J')
    }
    return r
  }
  const common = (abbr: string, group: string[]) => pct(vsSet(abbr, commonOpps(group)))
  const commonGames = (abbr: string, group: string[]) => {
    const r = vsSet(abbr, commonOpps(group))
    return r.w + r.l + r.t
  }
  /** Combined record of the clubs beaten, each counted once per win. */
  const sov = (abbr: string) => {
    const r = blank()
    for (const g of played) {
      const beat = g.home === abbr && g.home_score! > g.away_score! ? g.away : g.away === abbr && g.away_score! > g.home_score! ? g.home : null
      if (!beat) continue
      r.w += records[beat].w; r.l += records[beat].l; r.t += records[beat].t
    }
    return pct(r)
  }

  function breakTie(group: string[]): Ranked[] {
    if (group.length === 1) return [{ abbr: group[0], reason: null }]
    const sameDivision = group.every((a) => info.get(a)!.division === info.get(group[0])!.division && info.get(a)!.conference === info.get(group[0])!.conference)
    // NFL order: inside a division common games come before the conference
    // record; across divisions the conference record comes first and common
    // games need at least four. Strength of schedule, net points ranks and the
    // coin toss are replaced by points difference and the alphabet.
    const criteria: [Criterion, (a: string) => number][] = []
    if (metAll(group)) criteria.push(['h2h', (a) => h2h(a, group)])
    if (sameDivision) {
      criteria.push(['division', (a) => pct(records[a].div)])
      criteria.push(['common', (a) => common(a, group)])
      criteria.push(['conference', (a) => pct(records[a].conf)])
    } else {
      criteria.push(['conference', (a) => pct(records[a].conf)])
      if (group.every((a) => commonGames(a, group) >= 4)) criteria.push(['common', (a) => common(a, group)])
    }
    criteria.push(['sov', (a) => sov(a)])
    criteria.push(['diff', (a) => records[a].pf - records[a].pa])

    for (const [name, f] of criteria) {
      const vals = new Map(group.map((a) => [a, key(f(a))]))
      const tiers = [...new Set(vals.values())].sort((x, y) => y - x)
      if (tiers.length === 1) continue
      // each tier starts over from the first criterion, as the NFL does once a club drops out
      return tiers.flatMap((v) =>
        breakTie(group.filter((a) => vals.get(a) === v)).map((r) => ({ abbr: r.abbr, reason: r.reason ?? name })),
      )
    }
    return [...group].sort().map((abbr) => ({ abbr, reason: 'alpha' as const }))
  }

  function rank(set: string[]): Ranked[] {
    const tiers = [...new Set(set.map((a) => key(pct(records[a]))))].sort((x, y) => y - x)
    return tiers.flatMap((v) => breakTie(set.filter((a) => key(pct(records[a])) === v)))
  }

  const divisions = {} as Standings['divisions']
  const seeds = {} as Standings['seeds']
  for (const c of CONFERENCES) {
    divisions[c] = {} as Record<Division, Ranked[]>
    for (const d of DIVISIONS) divisions[c][d] = rank(teams.filter((t) => t.conference === c && t.division === d).map((t) => t.abbr))
    const winners = DIVISIONS.map((d) => divisions[c][d][0]?.abbr).filter(Boolean)
    const rest = teams.filter((t) => t.conference === c && !winners.includes(t.abbr)).map((t) => t.abbr)
    seeds[c] = [...rank(winners), ...rank(rest)]
  }
  return { records, divisions, seeds }
}
