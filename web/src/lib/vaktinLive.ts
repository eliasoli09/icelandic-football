/**
 * Shared live evaluation for bet slips: loads the slip's matches, overlays
 * in-play scores/events from API-Football, evaluates every leg, and attaches
 * minute-by-minute win probabilities (time-decayed Poisson — see inplay.ts).
 * Used by the slip status route (viewer polling) and the notify endpoint
 * (pg_cron minute pulse).
 */
import { createClient } from '@supabase/supabase-js'
import { evaluateSlip, type ApifEvent, type LegResult, type SlipLeg, type SlipStatus } from './vaktin'
import { cachedLiveFixture } from './apif'
import { refreshWcScores, wcPredict, HOSTS, flag } from './worldcup'
import { prob1X2, probBtts, probOver, probUnder, probScorer, remainingShare, slipProbability } from './inplay'
import type { WcMatchRow, WcPredictionRow } from './queries'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type LiveMatch = WcMatchRow & { updated_at?: string; elapsed?: number | null }

export interface ScoreboardMatch {
  id: number
  home: string
  away: string
  flagHome: string
  flagAway: string
  date: string
  home_score: number | null
  away_score: number | null
  live: boolean
  elapsed: number | null
}

export type LegWithProb = SlipLeg & LegResult & { prob: number | null }

export interface LiveEvalResult extends Omit<SlipStatus, 'legs'> {
  legs: LegWithProb[]
  totalProb: number | null
  scoreboard: ScoreboardMatch[]
}

/** Estimated match minute: API elapsed when live, wall clock otherwise. */
function matchMinute(m: LiveMatch): number {
  if (typeof m.elapsed === 'number') return m.elapsed
  const mins = (Date.now() - new Date(m.date).getTime()) / 60_000
  return Math.max(0, Math.min(93, mins))
}

/** Per-leg win probability given current state and remaining Poisson rates. */
function legProbability(
  leg: SlipLeg & LegResult,
  m: LiveMatch | undefined,
  lambdas: { h: number; a: number } | undefined,
): number | null {
  if (leg.status === 'vann') return 1
  if (leg.status === 'tapad') return 0
  if (!m || !lambdas) return null
  if (leg.market === 'handvirkt') return null

  const finished = m.home_score !== null && !m.live
  const share = finished ? 0 : m.home_score === null ? 1 : remainingShare(matchMinute(m))
  const lh = lambdas.h * share
  const la = lambdas.a * share
  const gh = m.home_score ?? 0
  const ga = m.away_score ?? 0

  switch (leg.market) {
    case 'urslit': {
      const p = prob1X2(gh, ga, lh, la)
      return leg.pick === '1' ? p.p1 : leg.pick === '2' ? p.p2 : p.px
    }
    case 'mork_yfir':
      return probOver(gh + ga, leg.line ?? 0, lh + la)
    case 'mork_undir':
      return probUnder(gh + ga, leg.line ?? 0, lh + la)
    case 'baedi_skora':
      return probBtts(gh, ga, lh, la)
    case 'markaskorari':
      // team unknown — use the average remaining team rate as an approximation
      return probScorer((lh + la) / 2)
    default:
      return null
  }
}

/** Evaluate legs against stored matches + live API-Football overlay. */
export async function evaluateLegsLive(
  legs: SlipLeg[],
  opts: { refreshFeedIfStale?: boolean } = {},
): Promise<LiveEvalResult> {
  const ids = [...new Set(legs.map((l) => l.match_id))]
  const [{ data: rows }, { data: predRows }] = await Promise.all([
    db().from('wc_matches').select('*').in('id', ids),
    db().from('wc_predictions').select('*').in('match_id', ids),
  ])
  let matches = (rows ?? []) as LiveMatch[]
  const now = Date.now()

  if (opts.refreshFeedIfStale) {
    const needsFresh = matches.some(
      (m) =>
        new Date(m.date).getTime() < now &&
        (m.home_score === null || now - new Date(m.date).getTime() < 3 * 3600_000) &&
        now - new Date(m.updated_at ?? 0).getTime() > 4 * 60_000,
    )
    if (needsFresh) {
      try {
        await refreshWcScores()
        const again = await db().from('wc_matches').select('*').in('id', ids)
        matches = (again.data ?? []) as LiveMatch[]
      } catch {
        // stale data is better than an error
      }
    }
  }

  const eventsByMatch = new Map<number, ApifEvent[]>()
  const scorerMatchIds = new Set(legs.filter((l) => l.market === 'markaskorari').map((l) => l.match_id))
  await Promise.all(
    matches.map(async (m) => {
      if (!m.apif_fixture_id) return
      const kickoff = new Date(m.date).getTime()
      if (kickoff > now) return
      const inWindow = now - kickoff < 4 * 3600_000
      if (!inWindow && m.home_score !== null && !scorerMatchIds.has(m.id)) return
      const live = await cachedLiveFixture(m.apif_fixture_id)
      if (!live) return
      if (live.goalsHome !== null) {
        m.home_score = live.goalsHome
        m.away_score = live.goalsAway
        m.live = !live.finished
        m.elapsed = live.elapsed
      }
      if (live.events.length) eventsByMatch.set(m.id, live.events)
    }),
  )

  const base = evaluateSlip(legs, new Map(matches.map((m) => [m.id, m])), eventsByMatch)

  // pre-match Poisson rates from stored Elo (fallback: tournament-typical rates)
  const preds = new Map(((predRows ?? []) as WcPredictionRow[]).map((p) => [p.match_id, p]))
  const lambdasByMatch = new Map<number, { h: number; a: number }>()
  for (const m of matches) {
    const p = preds.get(m.id)
    if (p?.elo_home && p?.elo_away) {
      const w = wcPredict(p.elo_home, p.elo_away, HOSTS.has(m.home))
      lambdasByMatch.set(m.id, { h: w.lambdaHome, a: w.lambdaAway })
    } else {
      lambdasByMatch.set(m.id, { h: 1.4, a: 1.15 })
    }
  }

  const matchById = new Map(matches.map((m) => [m.id, m]))
  const legsWithProb: LegWithProb[] = base.legs.map((l) => ({
    ...l,
    prob: legProbability(l, matchById.get(l.match_id), lambdasByMatch.get(l.match_id)),
  }))

  return {
    ...base,
    legs: legsWithProb,
    totalProb: base.alive ? slipProbability(legsWithProb.map((l) => l.prob)) : 0,
    scoreboard: matches
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({
        id: m.id,
        home: m.home,
        away: m.away,
        flagHome: flag(m.home),
        flagAway: flag(m.away),
        date: m.date,
        home_score: m.home_score,
        away_score: m.away_score,
        live: !!m.live,
        elapsed: m.elapsed ?? null,
      })),
  }
}
