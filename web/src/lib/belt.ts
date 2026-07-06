/**
 * Konungur kastalans — UFWC-style unofficial championship lineage for the
 * Icelandic top flight. KSÍ's website only carries real scorelines from the
 * 1985 season onwards (older fixtures are 0-0 placeholders), so the lineage
 * starts at the first match of 1985.
 *
 * Rules (mirroring the Unofficial Football World Championships):
 *  - The winner of the first match (of the earliest fully-scored season)
 *    becomes the first holder; drawn matches leave it waiting.
 *  - The holder defends the title in every top-flight match they play
 *    (including championship playoff games).
 *  - Win or draw → holder keeps the title. Loss → opponent takes it.
 *  - If the holder leaves the top flight (relegation), the title freezes
 *    with them until they return.
 */

export interface BeltMatch {
  matchId: number
  season: number
  date: string | null
  order: number
  homeTeam: number
  awayTeam: number
  homeGoals: number
  awayGoals: number
}

export interface BeltEvent {
  matchId: number
  season: number
  date: string | null
  holderBefore: number
  challenger: number
  holderAfter: number
  taken: boolean // did the belt change hands?
}

export interface BeltStats {
  history: BeltEvent[]
  currentHolder: number | null
  /** UFWC-style ranking: title-match wins per team */
  titleWins: Map<number, number>
  titleMatches: Map<number, number>
  reigns: Map<number, number>
  defenses: Map<number, number>
  currentReign: { holder: number; since: string | null; sinceSeason: number; defenses: number } | null
  longestReign: { holder: number; matches: number; fromSeason: number; toSeason: number } | null
}

/** @param initialHolder team holding the belt before the first match
 *  (the 1984 Íslandsmeistarar carry it into the match-play era). */
export function runBelt(matches: BeltMatch[], initialHolder?: number): BeltStats {
  const sorted = [...matches].sort((a, b) => a.order - b.order)
  const history: BeltEvent[] = []
  const titleWins = new Map<number, number>()
  const titleMatches = new Map<number, number>()
  const reigns = new Map<number, number>()
  const defenses = new Map<number, number>()

  let holder: number | null = initialHolder ?? null
  let reignStart: { date: string | null; season: number } | null =
    initialHolder !== undefined && matches.length
      ? { date: null, season: matches[0]?.season ?? 0 }
      : null
  let reignDefenses = 0
  let longest: BeltStats['longestReign'] = null
  let reignMatchCount = 0
  let reignFromSeason = matches.length ? matches[0].season : 0
  if (initialHolder !== undefined) reigns.set(initialHolder, 1)

  const bump = (m: Map<number, number>, k: number) => m.set(k, (m.get(k) ?? 0) + 1)

  const closeReign = (h: number, toSeason: number) => {
    if (!longest || reignMatchCount > longest.matches) {
      longest = { holder: h, matches: reignMatchCount, fromSeason: reignFromSeason, toSeason }
    }
  }

  for (const m of sorted) {
    const winner =
      m.homeGoals > m.awayGoals ? m.homeTeam : m.homeGoals < m.awayGoals ? m.awayTeam : null

    if (holder === null) {
      if (winner === null) continue
      holder = winner
      bump(reigns, holder)
      bump(titleMatches, m.homeTeam)
      bump(titleMatches, m.awayTeam)
      bump(titleWins, winner)
      history.push({
        matchId: m.matchId, season: m.season, date: m.date,
        holderBefore: winner, challenger: winner === m.homeTeam ? m.awayTeam : m.homeTeam,
        holderAfter: winner, taken: true,
      })
      reignStart = { date: m.date, season: m.season }
      reignDefenses = 0
      reignMatchCount = 1
      reignFromSeason = m.season
      continue
    }

    if (m.homeTeam !== holder && m.awayTeam !== holder) continue

    const h: number = holder
    const challenger: number = m.homeTeam === h ? m.awayTeam : m.homeTeam
    bump(titleMatches, m.homeTeam)
    bump(titleMatches, m.awayTeam)
    const holderKeeps = winner === null || winner === h
    if (winner !== null) bump(titleWins, winner)

    history.push({
      matchId: m.matchId, season: m.season, date: m.date,
      holderBefore: h, challenger,
      holderAfter: holderKeeps ? h : challenger,
      taken: !holderKeeps,
    })

    if (holderKeeps) {
      reignDefenses++
      reignMatchCount++
      bump(defenses, h)
    } else {
      closeReign(h, m.season)
      holder = challenger
      bump(reigns, holder)
      reignStart = { date: m.date, season: m.season }
      reignDefenses = 0
      reignMatchCount = 1
      reignFromSeason = m.season
    }
  }

  if (holder !== null) closeReign(holder, sorted[sorted.length - 1]?.season ?? 0)

  return {
    history,
    currentHolder: holder,
    titleWins,
    titleMatches,
    reigns,
    defenses,
    currentReign: holder !== null && reignStart
      ? { holder, since: reignStart.date, sinceSeason: reignStart.season, defenses: reignDefenses }
      : null,
    longestReign: longest,
  }
}

export interface H2HPair {
  teamA: number // teamA < teamB
  teamB: number
  aWins: number
  bWins: number
  draws: number
  aGoals: number
  bGoals: number
  first: string | null
  last: string | null
  biggest: { home: number; away: number; hg: number; ag: number; date: string | null } | null
}

export function computeH2H(matches: BeltMatch[]): H2HPair[] {
  const pairs = new Map<string, H2HPair>()
  for (const m of matches) {
    const [a, b] = m.homeTeam < m.awayTeam ? [m.homeTeam, m.awayTeam] : [m.awayTeam, m.homeTeam]
    const key = `${a}:${b}`
    let p = pairs.get(key)
    if (!p) {
      p = { teamA: a, teamB: b, aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0, first: m.date, last: m.date, biggest: null }
      pairs.set(key, p)
    }
    const aIsHome = m.homeTeam === a
    const ag = aIsHome ? m.homeGoals : m.awayGoals
    const bg = aIsHome ? m.awayGoals : m.homeGoals
    p.aGoals += ag
    p.bGoals += bg
    if (ag > bg) p.aWins++
    else if (bg > ag) p.bWins++
    else p.draws++
    if (m.date && (!p.first || m.date < p.first)) p.first = m.date
    if (m.date && (!p.last || m.date > p.last)) p.last = m.date
    const margin = Math.abs(m.homeGoals - m.awayGoals)
    const prevMargin = p.biggest ? Math.abs(p.biggest.hg - p.biggest.ag) : -1
    if (margin > prevMargin) {
      p.biggest = { home: m.homeTeam, away: m.awayTeam, hg: m.homeGoals, ag: m.awayGoals, date: m.date }
    }
  }
  return [...pairs.values()]
}

export interface AllTimeRow {
  teamId: number
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points3: number // uniform 3 points per win across all eras
  seasons: number
  firstSeason: number
  lastSeason: number
}

export function computeAllTime(matches: BeltMatch[]): AllTimeRow[] {
  const per = new Map<number, AllTimeRow & { seasonSet: Set<number> }>()
  const row = (t: number): AllTimeRow & { seasonSet: Set<number> } => {
    if (!per.has(t))
      per.set(t, {
        teamId: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
        points3: 0, seasons: 0, firstSeason: 9999, lastSeason: 0, seasonSet: new Set(),
      })
    return per.get(t)!
  }
  for (const m of matches) {
    const h = row(m.homeTeam)
    const a = row(m.awayTeam)
    for (const [t, gf, ga] of [
      [h, m.homeGoals, m.awayGoals] as const,
      [a, m.awayGoals, m.homeGoals] as const,
    ]) {
      t.played++
      t.gf += gf
      t.ga += ga
      t.seasonSet.add(m.season)
      t.firstSeason = Math.min(t.firstSeason, m.season)
      t.lastSeason = Math.max(t.lastSeason, m.season)
      if (gf > ga) { t.won++; t.points3 += 3 }
      else if (gf === ga) { t.drawn++; t.points3 += 1 }
      else t.lost++
    }
  }
  return [...per.values()]
    .map(({ seasonSet, ...r }) => ({ ...r, seasons: seasonSet.size }))
    .sort((x, y) => y.points3 - x.points3)
}
