/**
 * Turns per-frame detections (people + ball) into:
 *   – person tracks (greedy nearest-neighbour on foot points),
 *   – a cleaned ball trajectory (tracklets, gated by plausible ball speed),
 *   – kick / touch events: moments where the ball's velocity changes sharply
 *     while it is at a player's feet.
 *
 * Everything here is in image pixels and is pure, so it can be unit-tested
 * without a browser or a model.
 */

import type { Pt } from './homography'

export interface Box {
  x: number
  y: number
  w: number
  h: number
  score: number
}

export interface Frame {
  t: number
  persons: Box[]
  balls: Box[]
}

export const foot = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h })
export const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Track id for every person in every frame (same shape as frames[i].persons). */
export function trackPersons(frames: Frame[], gate = 1.0, maxGap = 3): number[][] {
  let next = 0
  const live: { id: number; p: Pt; h: number; last: number }[] = []
  return frames.map((f, fi) => {
    const ids = new Array<number>(f.persons.length).fill(-1)
    const pairs: { d: number; pi: number; ti: number }[] = []
    f.persons.forEach((b, pi) => {
      live.forEach((tr, ti) => {
        const gap = fi - tr.last
        if (gap > maxGap) return
        const d = dist(foot(b), tr.p) / Math.max(b.h, tr.h, 1)
        if (d <= gate * gap) pairs.push({ d, pi, ti })
      })
    })
    pairs.sort((a, b) => a.d - b.d)
    const usedT = new Set<number>()
    for (const { pi, ti } of pairs) {
      if (ids[pi] !== -1 || usedT.has(ti)) continue
      ids[pi] = live[ti].id
      usedT.add(ti)
    }
    f.persons.forEach((b, pi) => {
      if (ids[pi] === -1) {
        ids[pi] = next++
        live.push({ id: ids[pi], p: foot(b), h: b.h, last: fi })
      } else {
        const tr = live.find((t) => t.id === ids[pi])!
        Object.assign(tr, { p: foot(b), h: b.h, last: fi })
      }
    })
    return ids
  })
}

export interface BallPoint extends Pt {
  detected: boolean
}

/**
 * Picks one ball position per frame. Detections are linked into tracklets by
 * constant-velocity prediction (bridging up to `maxGap` missed frames), so a
 * static white blob such as the penalty spot does not hijack a moving ball.
 * Tracklets are then chosen greedily by total confidence without overlapping
 * in time, and short gaps are linearly interpolated.
 */
export function cleanBallTrack(frames: Frame[], width: number, maxDeviation = 0.6, maxGap = 3, maxInterp = 3): (BallPoint | null)[] {
  type Node = { fi: number; t: number; p: Pt; s: number }
  const tracklets: Node[][] = []
  frames.forEach((f, fi) => {
    const used = new Set<Node[]>()
    for (const c of [...f.balls].sort((a, b) => b.score - a.score)) {
      const node = { fi, t: f.t, p: centre(c), s: c.score }
      let best: Node[] | null = null
      let bestD = Infinity
      for (const tr of tracklets) {
        const last = tr[tr.length - 1]
        if (used.has(tr) || last.fi === fi || fi - last.fi > maxGap + 1) continue
        const prev = tr[tr.length - 2]
        const dt = f.t - last.t
        const vx = prev ? (last.p.x - prev.p.x) / (last.t - prev.t) : 0
        const vy = prev ? (last.p.y - prev.p.y) / (last.t - prev.t) : 0
        const d = dist({ x: last.p.x + vx * dt, y: last.p.y + vy * dt }, node.p)
        // Allowed deviation from the prediction grows with time: a kick or a
        // deflection changes velocity, but not by more than ~0.6 frame-widths/s.
        if (d <= (0.03 + maxDeviation * dt) * width && d < bestD) {
          best = tr
          bestD = d
        }
      }
      if (best) best.push(node)
      else tracklets.push((best = [node]))
      used.add(best)
    }
  })

  const out: (BallPoint | null)[] = frames.map(() => null)
  const ranked = tracklets
    .map((tr) => ({ tr, total: tr.reduce((s, n) => s + n.s, 0) }))
    // Single, weak detections are usually white boots, socks or line marks.
    .filter(({ tr, total }) => tr.length >= 2 || total >= 0.5)
    .sort((a, b) => b.total - a.total)
  for (const { tr } of ranked) {
    if (tr.some((n) => out[n.fi])) continue
    for (const n of tr) out[n.fi] = { ...n.p, detected: true }
  }

  // Interpolate short gaps.
  let prev = -1
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue
    if (prev >= 0 && i - prev > 1 && i - prev - 1 <= maxInterp) {
      const a = out[prev]!
      const b = out[i]!
      const ta = frames[prev].t
      const tb = frames[i].t
      for (let k = prev + 1; k < i; k++) {
        const r = (frames[k].t - ta) / (tb - ta)
        out[k] = { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, detected: false }
      }
    }
    prev = i
  }
  return out
}

export interface BallEvent {
  index: number
  t: number
  ball: Pt
  /** 'kick' = ball leaves faster (pass/shot); 'touch' = ball slows (reception/trap). */
  type: 'kick' | 'touch'
  /** Change in velocity in frame-widths per second. */
  dv: number
  /** Index of the player at the ball in frames[index].persons, or -1. */
  playerIndex: number
  /** Distance ball → that player's feet, in player heights. */
  proximity: number
  confidence: number
}

export interface EventOptions {
  window?: number
  minDv?: number
  maxProximity?: number
}

/** Nearest player to p, measured to the feet in units of that player's height. */
export function nearestPlayer(persons: Box[], p: Pt, exclude = -1): { index: number; d: number } {
  let index = -1
  let d = Infinity
  persons.forEach((b, i) => {
    if (i === exclude) return
    // Ball at the feet sits roughly between the knees and the ground.
    const fx = b.x + b.w / 2
    const fy = b.y + b.h * 0.9
    const di = Math.hypot((p.x - fx) / Math.max(b.w, b.h * 0.4), (p.y - fy) / b.h) * 0.5
    if (di < d) {
      d = di
      index = i
    }
  })
  return { index, d }
}

export function detectBallEvents(frames: Frame[], ball: (BallPoint | null)[], width: number, opts: EventOptions = {}): BallEvent[] {
  const { window = 3, minDv = 0.12, maxProximity = 1.0 } = opts
  const raw: BallEvent[] = []
  for (let i = 0; i < frames.length; i++) {
    const b = ball[i]
    if (!b) continue
    let j0 = -1
    let j1 = -1
    for (let k = window; k >= 1; k--) if (j0 < 0 && ball[i - k]) j0 = i - k
    for (let k = window; k >= 1; k--) if (j1 < 0 && ball[i + k]) j1 = i + k
    if (j0 < 0 || j1 < 0) continue
    const a = ball[j0]!
    const c = ball[j1]!
    const vb = { x: (b.x - a.x) / (frames[i].t - frames[j0].t), y: (b.y - a.y) / (frames[i].t - frames[j0].t) }
    const va = { x: (c.x - b.x) / (frames[j1].t - frames[i].t), y: (c.y - b.y) / (frames[j1].t - frames[i].t) }
    const dv = Math.hypot(va.x - vb.x, va.y - vb.y) / width
    if (dv < minDv) continue
    const { index, d } = nearestPlayer(frames[i].persons, b)
    if (index < 0 || d > maxProximity) continue
    let detected = 0
    for (let k = j0; k <= j1; k++) if (ball[k]?.detected) detected++
    const closeness = Math.min(1, Math.max(0, 1.2 - d))
    const confidence = Math.min(1, dv / 0.5) * closeness * (detected / (j1 - j0 + 1))
    raw.push({
      index: i,
      t: frames[i].t,
      ball: { x: b.x, y: b.y },
      type: Math.hypot(va.x, va.y) >= 0.8 * Math.hypot(vb.x, vb.y) ? 'kick' : 'touch',
      dv,
      playerIndex: index,
      proximity: d,
      confidence,
    })
  }
  // Non-maximum suppression in time: one event per burst.
  return raw.filter((e) => !raw.some((o) => o !== e && Math.abs(o.index - e.index) <= 2 && o.dv * o.confidence > e.dv * e.confidence))
}

export interface ReceiverGuess {
  /** Index of the receiver in frames[kick.index].persons, or -1 if unknown. */
  personIndexAtKick: number
  receptionT: number
  /** Where the pass ended: the ball stopped, or its flight was last seen. */
  arrival: Pt
}

/**
 * Where did the pass go, and to whom? The pass ends where the ball's speed
 * collapses (a reception) or, if the ball is lost first — typical when it
 * disappears behind the receiver's legs — at the end of its continuous flight.
 * The receiver is the player there, followed back to the kick frame by track;
 * failing that, the player at the kick frame nearest the arrival point (the
 * caller can narrow this to the kicker's teammates once shirt colours are known).
 * Merely passing close to a player mid-flight does not count.
 */
export function findReceiver(frames: Frame[], ball: (BallPoint | null)[], tracks: number[][], kick: BallEvent, maxSeconds = 5): ReceiverGuess | null {
  const kickerTrack = kick.playerIndex >= 0 ? tracks[kick.index][kick.playerIndex] : -1
  const speed = (fi: number) => {
    const a = ball[fi - 1]
    const b = ball[fi + 1]
    if (!a || !b) return null
    return Math.hypot(b.x - a.x, b.y - a.y) / (frames[fi + 1].t - frames[fi - 1].t)
  }

  let flight = 0
  for (let fi = kick.index + 1; fi <= kick.index + 3 && fi < frames.length - 1; fi++) flight = Math.max(flight, speed(fi) ?? 0)

  // End of flight: first sustained slowdown, else the last point of the continuous track.
  let end = kick.index
  for (let fi = kick.index + 1; fi < frames.length && ball[fi] && frames[fi].t <= kick.t + maxSeconds; fi++) {
    end = fi
    if (fi < kick.index + 2 || fi >= frames.length - 2) continue
    const s0 = speed(fi)
    const s1 = speed(fi + 1)
    if (flight > 0 && s0 !== null && s1 !== null && s0 <= 0.45 * flight && s1 <= 0.45 * flight) break
  }
  const arrival = ball[end]
  const kickerBox = kick.playerIndex >= 0 ? frames[kick.index].persons[kick.playerIndex] : null
  if (!arrival || end === kick.index || dist(arrival, kick.ball) < (kickerBox?.h ?? 40)) return null
  const at = { x: arrival.x, y: arrival.y }

  // Someone at the ball when the flight ends, whose track reaches back to the kick?
  const near = nearestPlayer(frames[end].persons, arrival, tracks[end].indexOf(kickerTrack))
  if (near.index >= 0 && near.d < 0.9) {
    const tr = tracks[end][near.index]
    const idx = tr === kickerTrack ? -1 : tracks[kick.index].indexOf(tr)
    if (idx >= 0) return { personIndexAtKick: idx, receptionT: frames[end].t, arrival: at }
  }

  // Otherwise: the player at the kick frame nearest the arrival point, ahead of the kick.
  const dir = { x: arrival.x - kick.ball.x, y: arrival.y - kick.ball.y }
  let best = -1
  let bestD = Infinity
  frames[kick.index].persons.forEach((b, i) => {
    if (i === kick.playerIndex) return
    const f = foot(b)
    if ((f.x - kick.ball.x) * dir.x + (f.y - kick.ball.y) * dir.y <= 0) return
    const d = dist(f, arrival) / b.h
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return { personIndexAtKick: best, receptionT: frames[end].t, arrival: at }
}
