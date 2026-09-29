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
 * The first wins, and is what this builds. A club's European rating is where it
 * stands inside its own league, plus what that league is worth.
 *
 * What a league is worth is read from globalfootballrankings.com where it has a
 * rating there, and fitted from the continental ties where it does not. The
 * published ranking measures clearly better. On the 2,394 ties before 2021 -
 * old enough that a September 2026 snapshot cannot be reflecting them - it goes
 * 0.99078 to 0.98090. On ties from 2021 on, which the ranking is partly built
 * from, it goes 0.98305 to 0.94679; that second figure is flattered by the
 * overlap and the first is the one to believe.
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
/**
 * The published ranking runs about 52 to 91; this puts it on the rating scale.
 * Swept 0 to 50 with an interior optimum at 30.
 */
export const RANKING_SCALE = 30
/**
 * Where the published scale is anchored. Only differences affect a prediction,
 * but a club rating is also read by people, so the ranked leagues are centred
 * on 1500 like every other rating on the site.
 */
export const RANKING_CENTRE = 1500
/**
 * A continental tie also says something about the two clubs, not only about
 * their leagues, and throwing that away meant a club could dominate Europe
 * without it ever reaching its own number. Swept 0 to 20 over 7,497 ties; 10
 * was the low point, and it is worth about 0.0005 of log loss - real in
 * direction, small in size.
 */
const K_CLUB_FROM_EUROPE = 10

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
  /** published rating for a league, where one exists */
  published?: (leagueId: number) => number | undefined,
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
        const outcome = result(m.homeGoals, m.awayGoals)
        const d = K_LEAGUE * (outcome - e)
        strength.set(lh, str(lh) + d)
        strength.set(la, str(la) - d)
        // the same surprise, credited to the clubs that produced it
        const dc = K_CLUB_FROM_EUROPE * (outcome - e)
        domestic.set(m.home, dom(m.home) + dc)
        domestic.set(m.away, dom(m.away) - dc)
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
  const worth = new Map<number, number>()
  for (const [l] of members) {
    const p = published?.(l)
    worth.set(l, p === undefined ? str(l) : p * RANKING_SCALE)
  }
  // the published ratings and the fitted ones live on different centres, so the
  // fitted ones are shifted onto the published scale rather than left beside it
  const both = [...members.keys()].filter((l) => published?.(l) !== undefined)
  if (both.length) {
    const shift =
      RANKING_CENTRE - both.reduce((s, l) => s + worth.get(l)!, 0) / both.length
    for (const l of both) worth.set(l, worth.get(l)! + shift)
    // the fitted ones live on their own centre; move them onto the published
    // one using the leagues that have both
    const offset =
      both.reduce((s, l) => s + (worth.get(l)! - str(l)), 0) / both.length
    for (const [l] of members) if (published?.(l) === undefined) worth.set(l, str(l) + offset)
  }
  for (const [l, clubs] of members) {
    const mean = clubs.reduce((s, c) => s + dom(c), 0) / clubs.length
    for (const c of clubs) club.set(c, dom(c) - mean + worth.get(l)!)
  }
  return { club, league: worth, leagueOf, bridged }
}
