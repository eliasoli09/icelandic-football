/**
 * One rating scale for European club football.
 *
 * A domestic Elo pool only knows the clubs inside it, so 1700 in the Eredivisie
 * and 1700 in the Premier League mean nothing to each other. The only evidence
 * that crosses a border is a match that crossed one, and those are the
 * Champions League, Europa League and Conference League ties.
 *
 * Three constructions were scored walk-forward on 7,542 continental matches,
 * each built only from ties already finished:
 *
 *   domestic standing + league strength   0.63046
 *   one Elo pool over all of Europe       0.63996
 *   league strength alone                 0.64934
 *
 * The first wins, and is what this builds. League strength is fitted from the
 * continental ties alone; a club's European rating is where it stands inside
 * its own league, plus what that league is worth.
 */

export interface RatedMatch {
  date: string
  league: number
  home: number
  away: number
  homeGoals: number
  awayGoals: number
}

export const HOME_ADVANTAGE = 60
const K_DOMESTIC = 20
/** a tie between leagues is rarer and more informative than another league match */
const K_LEAGUE = 28

export interface EuropeanScale {
  /** club id -> rating on the European scale */
  club: Map<number, number>
  /** league id -> what that league is worth */
  league: Map<number, number>
  /** club id -> the league it last played a league match in */
  leagueOf: Map<number, number>
  bridged: number
}

const expected = (gap: number) => 1 / (1 + 10 ** (-gap / 400))
const result = (h: number, a: number) => (h > a ? 1 : h === a ? 0.5 : 0)

/**
 * `matches` must be in date order. `isContinental` marks the ties that cross a
 * border; `isLeague` excludes cups, which say nothing about where a club plays.
 */
export function buildEuropeanScale(
  matches: RatedMatch[],
  isContinental: (leagueId: number) => boolean,
  isLeague: (leagueId: number) => boolean,
): EuropeanScale {
  const domestic = new Map<number, number>()
  const strength = new Map<number, number>()
  const leagueOf = new Map<number, number>()
  const dom = (t: number) => domestic.get(t) ?? 1500
  const str = (l: number) => strength.get(l) ?? 1500
  let bridged = 0

  for (const m of matches) {
    if (isContinental(m.league)) {
      const lh = leagueOf.get(m.home)
      const la = leagueOf.get(m.away)
      if (lh !== undefined && la !== undefined && lh !== la) {
        bridged++
        // where each club stands inside its own league is already known, so
        // what the tie actually tests is the gap between the two leagues
        const clubGap = (dom(m.home) - dom(m.away)) / 2
        const e = expected(str(lh) + clubGap + HOME_ADVANTAGE - (str(la) - clubGap))
        const d = K_LEAGUE * (result(m.homeGoals, m.awayGoals) - e)
        strength.set(lh, str(lh) + d)
        strength.set(la, str(la) - d)
      }
      continue
    }
    const eh = dom(m.home), ea = dom(m.away)
    const d = K_DOMESTIC * (result(m.homeGoals, m.awayGoals) - expected(eh + HOME_ADVANTAGE - ea))
    domestic.set(m.home, eh + d)
    domestic.set(m.away, ea - d)
    if (isLeague(m.league)) { leagueOf.set(m.home, m.league); leagueOf.set(m.away, m.league) }
  }

  // Centre each league's clubs on that league, then lift by its strength. The
  // centring is what stops a league's own inflation or deflation leaking into
  // the European scale.
  const members = new Map<number, number[]>()
  for (const [club, l] of leagueOf) members.set(l, [...(members.get(l) ?? []), club])
  const club = new Map<number, number>()
  for (const [l, clubs] of members) {
    const mean = clubs.reduce((s, c) => s + dom(c), 0) / clubs.length
    for (const c of clubs) club.set(c, dom(c) - mean + str(l))
  }
  return { club, league: strength, leagueOf, bridged }
}
