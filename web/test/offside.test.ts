import { describe, it, expect } from 'vitest'
import { computeHomography, apply, invert, rmsError, spansArea, type Pt } from '../src/lib/offside/homography'
import { templatePoints, IFAB } from '../src/lib/offside/pitch'
import { evaluateOffside, type PitchPlayer } from '../src/lib/offside/offside'
import { cleanBallTrack, detectBallEvents, findReceiver, trackPersons, type Box, type Frame } from '../src/lib/offside/tracking'
import { clusterTeams, rgbToLab, shirtColour } from '../src/lib/offside/teams'
import { foot } from '../src/lib/offside/tracking'
import scanFixture from './fixtures/offside_scan.json'

// A plausible broadcast-style camera: pitch (u, v) → image pixels.
const CAM = [22, -9, 640, 3, 7, 300, 0.004, 0.0012, 1] as const
const toImage = (p: Pt): Pt => {
  const [a, b, c, d, e, f, g, h, i] = CAM
  const w = g * p.x + h * p.y + i
  return { x: (a * p.x + b * p.y + c) / w, y: (d * p.x + e * p.y + f) / w }
}

describe('homography', () => {
  const pitch = templatePoints('box').map((p) => p.pitch)
  const image = pitch.map(toImage)

  it('recovers pitch coordinates from 4 IFAB box points', () => {
    const idx = [0, 3, 6, 9] // the four box corners
    const H = computeHomography(idx.map((i) => image[i]), idx.map((i) => pitch[i]))!
    expect(H).not.toBeNull()
    // Any other ground point maps back exactly.
    const probe = { x: 13.7, y: -4.2 }
    const back = apply(H, toImage(probe))!
    expect(back.x).toBeCloseTo(probe.x, 6)
    expect(back.y).toBeCloseTo(probe.y, 6)
  })

  it('least-squares fit with all points has ~zero error on exact data', () => {
    const H = computeHomography(image, pitch)!
    expect(rmsError(H, image, pitch)).toBeLessThan(1e-6)
  })

  it('averages out click noise when given extra points', () => {
    const noisy = image.map((p, i) => ({ x: p.x + ((i * 7) % 5) - 2, y: p.y + ((i * 3) % 5) - 2 }))
    const H = computeHomography(noisy, pitch)!
    const back = apply(H, toImage({ x: 16.5, y: 0 }))!
    expect(Math.abs(back.x - 16.5)).toBeLessThan(0.5)
  })

  it('inverse maps pitch back to image', () => {
    const H = computeHomography(image, pitch)!
    const Hi = invert(H)!
    const p = apply(Hi, { x: 11, y: 0 })!
    const q = toImage({ x: 11, y: 0 })
    expect(p.x).toBeCloseTo(q.x, 4)
    expect(p.y).toBeCloseTo(q.y, 4)
  })

  it('rejects collinear points', () => {
    const line = [0, 1, 2, 3] // all on the goal line
    expect(spansArea(line.map((i) => pitch[i]))).toBe(false)
    expect(spansArea([0, 3, 6, 9].map((i) => pitch[i]))).toBe(true)
    expect(computeHomography(line.map((i) => image[i]), line.map((i) => pitch[i]))).toBeNull()
  })

  it('box template uses the IFAB 40.32 × 16.5 m penalty area', () => {
    const pts = templatePoints('box')
    const far = pts.find((p) => p.key === 'box-far')!.pitch
    const near = pts.find((p) => p.key === 'box-near')!.pitch
    expect(near.y - far.y).toBeCloseTo(40.32, 6)
    expect(far.x).toBe(IFAB.boxDepth)
  })
})

describe('evaluateOffside', () => {
  const P = (id: string, role: PitchPlayer['role'], u: number): PitchPlayer => ({ id, role, u, v: 0 })
  const base = { halfwayU: 52.5, tolerance: 0.1 }

  it('attacker beyond the second-last defender is offside (keeper visible)', () => {
    const r = evaluateOffside({ ...base, ballU: 30, players: [P('gk', 'keeper', 2), P('d1', 'defender', 12), P('d2', 'defender', 15), P('a', 'attacker', 11)] })
    expect(r.secondLastId).toBe('d1')
    expect(r.lineU).toBe(12)
    expect(r.verdicts[0]).toMatchObject({ id: 'a', status: 'offside' })
    expect(r.verdicts[0].margin).toBeCloseTo(1, 6)
  })

  it('with the keeper out of frame the deepest visible defender is second-last', () => {
    const r = evaluateOffside({ ...base, ballU: 30, players: [P('d1', 'defender', 12), P('d2', 'defender', 15), P('a', 'attacker', 13)] })
    expect(r.keeperAssumed).toBe(true)
    expect(r.secondLastId).toBe('d1')
    expect(r.verdicts[0].status).toBe('onside')
  })

  it('a keeper who has come out still counts as one of the last two', () => {
    const r = evaluateOffside({ ...base, ballU: 40, players: [P('d1', 'defender', 3), P('gk', 'keeper', 20), P('d2', 'defender', 25), P('a', 'attacker', 18)] })
    expect(r.secondLastId).toBe('gk')
    expect(r.verdicts[0].status).toBe('offside')
  })

  it('a player behind the ball is onside even if past the defender', () => {
    const r = evaluateOffside({ ...base, ballU: 8, players: [P('gk', 'keeper', 1), P('d1', 'defender', 12), P('a', 'attacker', 10)] })
    expect(r.lineSource).toBe('ball')
    expect(r.lineU).toBe(8)
    expect(r.verdicts[0].status).toBe('onside')
  })

  it('level is onside, and near-level is flagged too close to call', () => {
    const players = [P('gk', 'keeper', 1), P('d1', 'defender', 12)]
    const level = evaluateOffside({ ...base, tolerance: 0, ballU: 40, players: [...players, P('a', 'attacker', 12)] })
    expect(level.verdicts[0].status).not.toBe('offside')
    const close = evaluateOffside({ ...base, ballU: 40, players: [...players, P('a', 'attacker', 11.95)] })
    expect(close.verdicts[0].status).toBe('close')
  })

  it('cannot be offside in own half', () => {
    const r = evaluateOffside({ ...base, ballU: 70, players: [P('gk', 'keeper', 1), P('d1', 'defender', 60), P('a', 'attacker', 55)] })
    expect(r.verdicts[0].status).toBe('onside')
    expect(r.verdicts[0].reason).toMatch(/eigin/)
  })

  it('ignores referees and warns when defenders are missing', () => {
    const r = evaluateOffside({ ...base, ballU: 30, players: [P('ref', 'ignore', 5), P('a', 'attacker', 10)] })
    expect(r.lineU).toBeNull()
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.verdicts[0].status).toBe('close')
  })
})

// --- tracking / kick detection ---------------------------------------------

const person = (x: number, y: number): Box => ({ x: x - 15, y: y - 60, w: 30, h: 60, score: 0.9 })
const ballAt = (x: number, y: number): Box => ({ x: x - 4, y: y - 4, w: 8, h: 8, score: 0.6 })

/**
 * Synthetic pass at 10 fps: kicker A dribbles slowly at x≈300, passes at
 * t=1.0 s; the ball travels fast to receiver B at x≈900, arriving ~t=1.6 s.
 */
function passClip(): Frame[] {
  const frames: Frame[] = []
  for (let i = 0; i <= 25; i++) {
    const t = i / 10
    const ax = 290 + t * 10
    const bx = 880 + t * 8
    let bxBall: number
    if (t <= 1.0) bxBall = ax + 8
    else if (t < 1.6) bxBall = 300 + 8 + ((t - 1.0) / 0.6) * (bx - 300 - 8)
    else bxBall = bx + 6
    const balls = i === 13 ? [] : [ballAt(bxBall, 452)] // one missed detection mid-flight
    if (i === 5) balls.push({ ...ballAt(100, 100), score: 0.2 }) // spurious white blob
    frames.push({ t, persons: [person(ax, 460), person(bx, 462), person(600, 300)], balls })
  }
  return frames
}

describe('ball tracking and kick detection', () => {
  const frames = passClip()
  const ball = cleanBallTrack(frames, 1280)

  it('drops the spurious detection and interpolates the gap', () => {
    expect(ball[5]!.x).toBeGreaterThan(250)
    expect(ball[13]).not.toBeNull()
    expect(ball[13]!.detected).toBe(false)
  })

  it('finds the kick at the right moment, at the kicker', () => {
    const events = detectBallEvents(frames, ball, 1280)
    const kicks = events.filter((e) => e.type === 'kick').sort((a, b) => b.confidence - a.confidence)
    expect(kicks[0].t).toBeCloseTo(1.0, 5)
    expect(kicks[0].playerIndex).toBe(0)
  })

  it('identifies the receiver and returns their index at the kick frame', () => {
    const events = detectBallEvents(frames, ball, 1280)
    const kick = events.filter((e) => e.type === 'kick').sort((a, b) => b.confidence - a.confidence)[0]
    const tracks = trackPersons(frames)
    const rec = findReceiver(frames, ball, tracks, kick)
    expect(rec).not.toBeNull()
    expect(rec!.personIndexAtKick).toBe(1)
    expect(rec!.receptionT).toBeGreaterThan(1.4)
  })

  it('keeps stable track ids for moving players', () => {
    const tracks = trackPersons(frames)
    expect(new Set(tracks.map((t) => t[0])).size).toBe(1)
    expect(new Set(tracks.map((t) => t[1])).size).toBe(1)
  })
})

describe('receiver identification', () => {
  it('picks the player where the ball stops, not a bystander it passes in flight', () => {
    // Same pass, but a third attacker stands right on the ball's path at x≈600
    // and the ball detection jitters as it flies past him.
    const frames = passClip().map((f, i) => {
      const persons = [...f.persons.slice(0, 2), person(600, 458)]
      // Frame 13 (t=1.3) has the ball flying past him; detection jitters down 30 px.
      const balls = i === 13 ? [ballAt(599, 482)] : f.balls
      return { ...f, persons, balls }
    })
    const ball = cleanBallTrack(frames, 1280)
    const events = detectBallEvents(frames, ball, 1280)
    const kick = events.filter((e) => e.type === 'kick').sort((a, b) => b.confidence - a.confidence)[0]
    expect(kick.t).toBeCloseTo(1.0, 5)
    const rec = findReceiver(frames, ball, trackPersons(frames), kick)
    expect(rec?.personIndexAtKick).toBe(1)
  })
})

/**
 * Real detector output (EfficientDet-Lite2, 10 fps) on a synthetic clip with
 * known ground truth: the kick is at t=2.0 s, the pass flies to the receiver
 * whose feet are at ≈(810, 445) px at the kick. Along the way the detector also
 * reports the penalty spot at ≈(930, 356) as a "ball", and the ball is lost
 * behind the receiver for several frames.
 */
describe('real scan regression', () => {
  const { frames, width } = scanFixture as { frames: Frame[]; width: number }
  const ball = cleanBallTrack(frames, width)
  const events = detectBallEvents(frames, ball, width)
  const kick = events.filter((e) => e.type === 'kick').sort((a, b) => b.confidence - a.confidence)[0]

  it('finds the kick at 2.0 s', () => {
    expect(kick.t).toBeCloseTo(2.0, 5)
  })

  it('does not let the penalty spot hijack the ball track', () => {
    // Spurious detections of the (static) spot, frame → centre.
    const spot: Record<number, [number, number]> = { 24: [928, 356], 26: [934, 356], 28: [978, 356], 29: [1001, 354] }
    for (const [i, [x, y]] of Object.entries(spot)) {
      const b = ball[+i]
      if (b) expect(Math.hypot(b.x - x, b.y - y)).toBeGreaterThan(20)
    }
    // …while the real ball is kept through the flight.
    expect(ball[28]!.x).toBeCloseTo(804, -1)
  })

  it('names the true receiver at the kick frame', () => {
    const rec = findReceiver(frames, ball, trackPersons(frames), kick)!
    expect(rec.arrival.x).toBeGreaterThan(900)
    const f = foot(frames[kick.index].persons[rec.personIndexAtKick])
    expect(Math.hypot(f.x - 810, f.y - 445)).toBeLessThan(25)
  })
})

describe('team colours', () => {
  const box = (rgb: [number, number, number], w = 10, h = 20) => {
    const a = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      // bottom half grass, top half shirt
      const grass = Math.floor(i / w) > h * 0.6
      const [r, g, b] = grass ? [40, 140, 50] : rgb
      a.set([r, g, b, 255], i * 4)
    }
    return shirtColour(a, w, h)
  }

  it('ignores grass pixels when measuring the shirt', () => {
    const lab = box([220, 30, 30])!
    const red = rgbToLab(220, 30, 30)
    expect(lab[0]).toBeCloseTo(red[0], 3)
  })

  it('splits two kits and flags a referee in black', () => {
    const cols = [
      box([240, 240, 240]), box([235, 238, 240]), box([245, 245, 245]), box([230, 230, 235]),
      box([20, 60, 200]), box([25, 70, 210]), box([30, 55, 190]), box([22, 65, 205]),
      box([15, 15, 15]),
    ]
    const c = clusterTeams(cols)!
    const white = c.labels[0]
    expect(c.labels.slice(0, 4).every((l) => l === white)).toBe(true)
    expect(c.labels.slice(4, 8).every((l) => l === 1 - white)).toBe(true)
    expect(c.labels[8]).toBe(-1)
  })
})
