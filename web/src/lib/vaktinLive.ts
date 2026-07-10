/**
 * Shared live evaluation for bet slips: loads the slip's matches, overlays
 * in-play scores/events from API-Football, and evaluates every leg.
 * Used by the slip status route (viewer polling) and the notify endpoint
 * (pg_cron minute pulse).
 */
import { createClient } from '@supabase/supabase-js'
import { evaluateSlip, type ApifEvent, type SlipLeg, type SlipStatus } from './vaktin'
import { cachedLiveFixture } from './apif'
import { refreshWcScores } from './worldcup'
import type { WcMatchRow } from './queries'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export interface LiveEvalResult extends SlipStatus {
  matches: (WcMatchRow & { updated_at?: string })[]
}

/** Evaluate legs against stored matches + live API-Football overlay. */
export async function evaluateLegsLive(
  legs: SlipLeg[],
  opts: { refreshFeedIfStale?: boolean } = {},
): Promise<LiveEvalResult> {
  const ids = [...new Set(legs.map((l) => l.match_id))]
  let { data: rows } = await db().from('wc_matches').select('*').in('id', ids)
  let matches = (rows ?? []) as (WcMatchRow & { updated_at?: string })[]
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
        matches = (again.data ?? []) as typeof matches
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
      }
      if (live.events.length) eventsByMatch.set(m.id, live.events)
    }),
  )

  return { ...evaluateSlip(legs, new Map(matches.map((m) => [m.id, m])), eventsByMatch), matches }
}

/** True if any of the slip's matches could change state right now. */
export function anyMatchActive(matches: WcMatchRow[]): boolean {
  const now = Date.now()
  return matches.some((m) => {
    const kickoff = new Date(m.date).getTime()
    return kickoff < now && (m.live || m.home_score === null || now - kickoff < 4 * 3600_000)
  })
}
