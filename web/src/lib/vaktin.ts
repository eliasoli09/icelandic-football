/**
 * Miðavaktin: bet-slip legs and their evaluation.
 *
 * MVP data source is the WC result feed (wc_matches) — score-based markets
 * settle when results land. Player markets (scorer/shots/cards) evaluate
 * live from API-Football events once the paid plan is active; until then
 * they fall back to manual ticking. Odds/bets are the user's own — this is
 * a tracker, it never places or suggests bets.
 */
import type { WcMatchRow } from './queries'

export type LegMarket =
  | 'urslit'        // 1 / X / 2
  | 'mork_yfir'     // total goals over line
  | 'mork_undir'    // total goals under line
  | 'baedi_skora'   // both teams to score
  | 'markaskorari'  // player scores (API events when available)
  | 'handvirkt'     // anything else — user ticks it

export interface SlipLeg {
  id: string
  match_id: number
  market: LegMarket
  pick?: '1' | 'X' | '2'
  line?: number
  player?: string
  label: string
  manualDone?: boolean
}

export type LegStatus = 'vann' | 'tapad' | 'i_gangi' | 'obyrjad' | 'handvirkt'

export interface LegResult {
  status: LegStatus
  detail: string
}

/** Events shape from API-Football /fixtures/events (subset we use). */
export interface ApifEvent {
  type: string // 'Goal' | 'Card' | ...
  detail: string
  player: { name: string | null }
  team: { name: string | null }
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const started = (m: WcMatchRow) => new Date(m.date).getTime() < Date.now()
const finished = (m: WcMatchRow) => m.home_score !== null && m.away_score !== null

export function evaluateLeg(leg: SlipLeg, m: WcMatchRow | undefined, events?: ApifEvent[] | null): LegResult {
  if (!m) return { status: 'handvirkt', detail: 'Leikur fannst ekki — merktu handvirkt' }

  if (leg.market === 'handvirkt') {
    return leg.manualDone
      ? { status: 'vann', detail: 'Merkt handvirkt' }
      : { status: started(m) ? 'i_gangi' : 'obyrjad', detail: 'Handvirkt hólf — tikkaðu við þegar leggurinn dettur' }
  }

  if (!started(m)) return { status: 'obyrjad', detail: `Hefst ${new Date(m.date).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}` }

  const total = (m.home_score ?? 0) + (m.away_score ?? 0)

  switch (leg.market) {
    case 'urslit': {
      if (!finished(m)) return { status: 'i_gangi', detail: 'Leikur í gangi — lokatölur ókomnar' }
      const outcome = m.home_score! > m.away_score! ? '1' : m.home_score! < m.away_score! ? '2' : 'X'
      return outcome === leg.pick
        ? { status: 'vann', detail: `Lauk ${m.home_score}–${m.away_score}` }
        : { status: 'tapad', detail: `Lauk ${m.home_score}–${m.away_score}` }
    }
    case 'mork_yfir': {
      if (finished(m))
        return total > (leg.line ?? 0)
          ? { status: 'vann', detail: `${total} mörk` }
          : { status: 'tapad', detail: `${total} mörk` }
      // can secure early once over the line even without final score
      return total > (leg.line ?? 0)
        ? { status: 'vann', detail: `${total} mörk komin` }
        : { status: 'i_gangi', detail: `${total} mörk — vantar ${Math.ceil((leg.line ?? 0) - total + 0.5)}` }
    }
    case 'mork_undir': {
      if (finished(m))
        return total < (leg.line ?? 0)
          ? { status: 'vann', detail: `${total} mörk` }
          : { status: 'tapad', detail: `${total} mörk` }
      return total < (leg.line ?? 0)
        ? { status: 'i_gangi', detail: `${total} mörk — heldur enn` }
        : { status: 'tapad', detail: `${total} mörk komin — sprungið` }
    }
    case 'baedi_skora': {
      const both = (m.home_score ?? 0) > 0 && (m.away_score ?? 0) > 0
      if (both) return { status: 'vann', detail: 'Bæði lið skoruð' }
      if (finished(m)) return { status: 'tapad', detail: `Lauk ${m.home_score}–${m.away_score}` }
      return { status: 'i_gangi', detail: `Staðan ${m.home_score ?? 0}–${m.away_score ?? 0}` }
    }
    case 'markaskorari': {
      if (events?.length) {
        const scored = events.some(
          (e) => e.type === 'Goal' && !/own goal|missed penalty/i.test(e.detail ?? '') && e.player.name && leg.player && norm(e.player.name).includes(norm(leg.player)),
        )
        if (scored) return { status: 'vann', detail: `${leg.player} skoraði` }
        if (finished(m)) return { status: 'tapad', detail: 'Skoraði ekki' }
        return { status: 'i_gangi', detail: 'Ekki skorað enn' }
      }
      // no event feed yet (Free plan) — manual fallback
      if (leg.manualDone) return { status: 'vann', detail: 'Merkt handvirkt' }
      if (finished(m)) return { status: 'handvirkt', detail: 'Lokatölur komnar — staðfestu handvirkt (live-gögn koma með API-uppfærslu)' }
      return { status: started(m) ? 'i_gangi' : 'obyrjad', detail: 'Vaktað handvirkt þar til API-áskrift virkjast' }
    }
  }
}

export interface SlipStatus {
  legs: (SlipLeg & LegResult)[]
  vann: number
  tapad: number
  iGangi: number
  alive: boolean // no leg lost yet
}

export function evaluateSlip(
  legs: SlipLeg[],
  matches: Map<number, WcMatchRow>,
  eventsByMatch?: Map<number, ApifEvent[]>,
): SlipStatus {
  const out = legs.map((l) => ({ ...l, ...evaluateLeg(l, matches.get(l.match_id), eventsByMatch?.get(l.match_id) ?? null) }))
  const vann = out.filter((l) => l.status === 'vann').length
  const tapad = out.filter((l) => l.status === 'tapad').length
  return {
    legs: out,
    vann,
    tapad,
    iGangi: out.filter((l) => l.status === 'i_gangi').length,
    alive: tapad === 0,
  }
}

export const MARKET_LABELS: Record<LegMarket, string> = {
  urslit: 'Úrslit (1X2)',
  mork_yfir: 'Yfir X mörk',
  mork_undir: 'Undir X mörk',
  baedi_skora: 'Bæði lið skora',
  markaskorari: 'Leikmaður skorar',
  handvirkt: 'Annað (handvirkt)',
}
