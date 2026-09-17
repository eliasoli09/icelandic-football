import type { CupPlayer, CupSide, Line } from './types'

export const FORMATIONS: { id: string; label: string; lines: Record<Line, number> }[] = [
  { id: '4-3-3', label: 'Jafnvægi í sókn og breidd', lines: { GK: 1, DEF: 4, MID: 3, FWD: 3 } },
  { id: '4-4-2', label: 'Klassísk og traust', lines: { GK: 1, DEF: 4, MID: 4, FWD: 2 } },
  { id: '3-5-2', label: 'Yfirráð á miðjunni', lines: { GK: 1, DEF: 3, MID: 5, FWD: 2 } },
  { id: '4-2-3-1', label: 'Varnarsinnuð með skapandi frelsi', lines: { GK: 1, DEF: 4, MID: 5, FWD: 1 } },
  { id: '3-4-3', label: 'Allt í sókn', lines: { GK: 1, DEF: 3, MID: 4, FWD: 3 } },
  { id: '5-3-2', label: 'Varnarmúr og skyndisóknir', lines: { GK: 1, DEF: 5, MID: 3, FWD: 2 } },
]
export const LINE_LABEL: Record<Line, string> = { GK: 'Markvörður', DEF: 'Varnarmenn', MID: 'Miðjumenn', FWD: 'Sóknarmenn' }
export const ROUNDS = ['32-liða úrslit', '16-liða úrslit', '8-liða úrslit', 'Undanúrslit', 'Úrslitaleikur'] as const

/** A small seeded generator, so a run can be replayed from its seed. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Picked { player: CupPlayer; side: string }
export interface Draft { formation: string; picks: Picked[]; offered: string[] }

export const newDraft = (formation: string): Draft => ({ formation, picks: [], offered: [] })
export const formationOf = (draft: Draft) => FORMATIONS.find((f) => f.id === draft.formation)!

export function openSlots(draft: Draft): Record<Line, number> {
  const f = formationOf(draft).lines
  const used = (line: Line) => draft.picks.filter((p) => p.player.line === line).length
  return { GK: f.GK - used('GK'), DEF: f.DEF - used('DEF'), MID: f.MID - used('MID'), FWD: f.FWD - used('FWD') }
}

export const draftDone = (draft: Draft) => draft.picks.length === 11

/** The players of a side still worth offering: a free slot in their line, and not already picked from another season. */
export function eligible(draft: Draft, side: CupSide): CupPlayer[] {
  const open = openSlots(draft)
  const taken = new Set(draft.picks.map((p) => p.player.id))
  return side.players.filter((p) => open[p.line] > 0 && !taken.has(p.id))
}

/** The next side to pick from: one not offered this run that has someone to pick. */
export function nextSide(draft: Draft, sides: CupSide[], random: () => number): CupSide {
  const fresh = sides.filter((s) => !draft.offered.includes(s.id) && eligible(draft, s).length > 0)
  const pool = fresh.length ? fresh : sides.filter((s) => eligible(draft, s).length > 0)
  return pool[Math.floor(random() * pool.length)]
}

export function pick(draft: Draft, side: CupSide, player: CupPlayer): Draft {
  if (!eligible(draft, side).some((p) => p.id === player.id)) return draft
  return { ...draft, picks: [...draft.picks, { player, side: side.id }] }
}

export const offer = (draft: Draft, side: CupSide): Draft =>
  draft.offered.includes(side.id) ? draft : { ...draft, offered: [...draft.offered, side.id] }

export const teamRating = (draft: Draft) =>
  draft.picks.length ? Math.round(draft.picks.reduce((a, p) => a + p.player.rating, 0) / draft.picks.length) : 0

// ── the cup ──────────────────────────────────────────────────────────

/**
 * The opponents on the way to the final, weaker to stronger: each round draws
 * from a band of the ranking, and the final is against one of the two greatest.
 */
export const BANDS: [number, number][] = [[26, 41], [16, 25], [8, 15], [3, 7], [1, 2]]

export function drawOpponents(sides: CupSide[], random: () => number): CupSide[] {
  const ready = sides.filter((s) => s.strength !== null)
  return BANDS.map(([from, to]) => {
    const band = ready.filter((s) => s.rank >= from && s.rank <= to)
    return band[Math.floor(random() * band.length)]
  })
}

function poisson(lambda: number, random: () => number) {
  const l = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= random() } while (p > l)
  return k - 1
}

export interface Goal { minute: number; scorer: string; ours: boolean }
export interface MatchResult {
  round: string
  opponent: string
  ours: number
  theirs: number
  extraTime: boolean
  penalties: [number, number] | null
  won: boolean
  goals: Goal[]
}

/** Goals expected for a side of this strength against that one, in 90 minutes. */
export const expectedGoals = (own: number, other: number) => 1.35 * Math.pow(10, (own - other) / 40)

function scorer(players: CupPlayer[], random: () => number): string {
  const weight = (p: CupPlayer) => ({ GK: 0, DEF: 0.6, MID: 2, FWD: 4 })[p.line] * (p.rating / 80) * (1 + p.goals / Math.max(1, p.starts))
  const total = players.reduce((a, p) => a + weight(p), 0)
  let r = random() * total
  for (const p of players) { r -= weight(p); if (r <= 0) return p.name }
  return players[players.length - 1].name
}

export function playMatch(round: string, ours: CupPlayer[], opponent: CupSide, random: () => number): MatchResult {
  const us = ours.reduce((a, p) => a + p.rating, 0) / ours.length
  const them = opponent.strength!
  const theirPlayers = opponent.players
  const goals: Goal[] = []
  const period = (from: number, to: number, share: number) => {
    const a = poisson(expectedGoals(us, them) * share, random), b = poisson(expectedGoals(them, us) * share, random)
    for (let i = 0; i < a; i++) goals.push({ minute: from + Math.floor(random() * (to - from)) + 1, scorer: scorer(ours, random), ours: true })
    for (let i = 0; i < b; i++) goals.push({ minute: from + Math.floor(random() * (to - from)) + 1, scorer: scorer(theirPlayers, random), ours: false })
    return [a, b]
  }
  let [a, b] = period(0, 90, 1)
  let extraTime = false, penalties: [number, number] | null = null
  if (a === b) {
    extraTime = true
    const [c, d] = period(90, 120, 1 / 3)
    a += c; b += d
    if (a === b) {
      // five each, then sudden death; the stronger side is a little likelier to score each kick
      const p = (x: number, y: number) => Math.min(0.85, Math.max(0.6, 0.75 + (x - y) / 200))
      let pa = 0, pb = 0, kicks = 0
      while (kicks < 5 || pa === pb) {
        if (random() < p(us, them)) pa++
        if (random() < p(them, us)) pb++
        kicks++
        if (kicks < 5 && (pa > pb + (5 - kicks) || pb > pa + (5 - kicks))) break
      }
      penalties = [pa, pb]
    }
  }
  goals.sort((x, y) => x.minute - y.minute)
  const won = penalties ? penalties[0] > penalties[1] : a > b
  return { round, opponent: opponent.id, ours: a, theirs: b, extraTime, penalties, won, goals }
}

/** How far a run went, in words. */
export function outcome(results: MatchResult[]): string {
  const lost = results.find((r) => !r.won)
  if (!lost) return 'Bikarmeistari!'
  const where = lost.round === 'Úrslitaleikur' ? 'úrslitaleiknum' : lost.round.replace(/úrslit$/, 'úrslitum').replace(/^U/, 'u')
  return `Úr leik í ${where}`
}

export function shareText(results: MatchResult[], formation: string, rating: number, url: string): string {
  const marks = results.map((r) => (r.won ? '🟩' : '🟥')).join('')
  return `Reyndu að verða bikarmeistari 🏆\n${outcome(results)}\n${marks} · ${formation} · styrkur ${rating}\n${url}`
}
