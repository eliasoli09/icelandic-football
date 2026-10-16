import { franchiseOf, ratingFor, winProb, type EloState } from './elo'
import { pairUp, seasonFormat, type SimTeam } from './sim'
import type { Standings } from './standings'
import { CONFERENCES, type Conference, type NflTeam } from './types'

export interface Slot {
  abbr: string
  seed: number
  /** The simulated chance shown beside the club at this point of the tree. */
  p: number
}

export interface ConfBracket {
  seeds: Slot[]
  byes: Slot[]
  wc: [Slot, Slot][]
  div?: [Slot, Slot][]
  con?: [Slot, Slot]
  champ?: Slot
  /** Clubs just outside, for "Í baráttunni". */
  hunt: Slot[]
}

export type Bracket = Record<Conference, ConfBracket> & { sb?: [Slot, Slot]; winner?: Slot }

const HUNT = 4

/** The bracket if the season ended today, with each club's simulated playoff chance. */
export function todayBracket(st: Standings, sim: Record<string, SimTeam>, season: number): Bracket {
  const fmt = seasonFormat(season)
  const out = {} as Bracket
  for (const c of CONFERENCES) {
    const slot = (abbr: string, seed: number): Slot => ({ abbr, seed, p: sim[abbr]?.p_playoffs ?? 0 })
    const seeds = st.seeds[c].slice(0, fmt.seeds).map((r, i) => slot(r.abbr, i + 1))
    out[c] = {
      seeds,
      byes: seeds.slice(0, fmt.byes),
      wc: pairUp(seeds.slice(fmt.byes)),
      hunt: st.seeds[c].slice(fmt.seeds, fmt.seeds + HUNT).map((r, i) => slot(r.abbr, fmt.seeds + i + 1)),
    }
  }
  return out
}

/**
 * The most likely way it ends. Seeds: the likeliest club-seed pair first, no
 * club twice. Games: the Elo favourite advances (better seed at home, the
 * Super Bowl neutral). Every node carries the simulated chance of that club
 * getting there, so the reader sees how thin "most likely" is.
 */
export function likelyBracket(sim: Record<string, SimTeam>, teams: NflTeam[], state: EloState, season: number): Bracket {
  const fmt = seasonFormat(season)
  const elo = (a: string) => ratingFor(state, franchiseOf(a), season)
  const favourite = (hi: Slot, lo: Slot) => (winProb(elo(hi.abbr) - elo(lo.abbr) + state.params.HFA) >= 0.5 ? hi : lo)
  const out = {} as Bracket

  for (const c of CONFERENCES) {
    const pairs: { abbr: string; seed: number; p: number }[] = []
    for (const t of teams.filter((x) => x.conference === c)) sim[t.abbr]?.p_seed.forEach((p, i) => pairs.push({ abbr: t.abbr, seed: i + 1, p }))
    pairs.sort((a, b) => b.p - a.p || a.seed - b.seed || a.abbr.localeCompare(b.abbr))
    const bySeed = new Map<number, Slot>()
    const used = new Set<string>()
    for (const x of pairs) {
      if (bySeed.has(x.seed) || used.has(x.abbr)) continue
      bySeed.set(x.seed, { abbr: x.abbr, seed: x.seed, p: x.p })
      used.add(x.abbr)
    }
    const seeds = [...bySeed.values()].sort((a, b) => a.seed - b.seed)
    const at = (s: Slot, key: 'p_round2' | 'p_round3' | 'p_sb'): Slot => ({ ...s, p: sim[s.abbr][key] })
    const order = (xs: Slot[]) => xs.sort((a, b) => a.seed - b.seed)

    const wc = pairUp(seeds.slice(fmt.byes))
    const round2 = order([...seeds.slice(0, fmt.byes), ...wc.map(([a, b]) => favourite(a, b))]).map((s) => at(s, 'p_round2'))
    const div = pairUp(round2)
    const round3 = order(div.map(([a, b]) => favourite(a, b))).map((s) => at(s, 'p_round3'))
    const con: [Slot, Slot] = [round3[0], round3[1]]
    const champ = at(favourite(con[0], con[1]), 'p_sb')
    const hunt = teams
      .filter((t) => t.conference === c && !used.has(t.abbr))
      .map((t) => ({ abbr: t.abbr, seed: 0, p: sim[t.abbr]?.p_playoffs ?? 0 }))
      .sort((a, b) => b.p - a.p)
      .slice(0, HUNT)
    out[c] = { seeds, byes: seeds.slice(0, fmt.byes), wc, div, con, champ, hunt }
  }

  const afc = out.AFC.champ!
  const nfc = out.NFC.champ!
  const win = winProb(elo(afc.abbr) - elo(nfc.abbr)) >= 0.5 ? afc : nfc
  out.sb = [afc, nfc]
  out.winner = { ...win, p: sim[win.abbr].p_title }
  return out
}

/** A probability for a table cell: never "0%" for a club that can still make it. */
export function probCell(p: number, eliminated: boolean): string {
  if (p === 0 && eliminated) return 'úr leik'
  if (p === 1) return '100%'
  if (p < 0.005) return '<1%'
  if (p > 0.995) return '>99%'
  return `${Math.round(p * 100)}%`
}
