/**
 * The runner, drawn pixel by pixel from a pose instead of from a sprite sheet:
 * hips, knees, shoulders and elbows are angles, limbs are two-pixel strokes and
 * an outline is grown around the lot. Any number of frames and any kit come
 * out of the same few lines, and every frame stays on the same pixel grid as
 * the stadiums.
 */

export const W = 26
export const H = 32

/** palette slots; the scene maps them to a kit's colours */
export const P = {
  None: 0, Outline: 1, Skin: 2, Hair: 3, Shirt: 4, Shirt2: 5, Shorts: 6, Socks: 7, Boot: 8, Eye: 9,
  SkinBack: 10, ShirtBack: 11, ShortsBack: 12, SocksBack: 13,
} as const

export interface Kit {
  id: string
  name: string
  shirt: string
  shirt2: string
  shorts: string
  socks: string
  pattern: 'plain' | 'stripes' | 'sash'
}

export const KITS: Kit[] = [
  { id: 'island', name: 'Ísland', shirt: '#1d4fc4', shirt2: '#e23a3a', shorts: '#f4f4f4', socks: '#1d4fc4', pattern: 'plain' },
  { id: 'fh', name: 'FH', shirt: '#f2f2f2', shirt2: '#151515', shorts: '#151515', socks: '#f2f2f2', pattern: 'plain' },
  { id: 'kr', name: 'KR', shirt: '#f2f2f2', shirt2: '#151515', shorts: '#151515', socks: '#151515', pattern: 'stripes' },
  { id: 'valur', name: 'Valur', shirt: '#d42027', shirt2: '#f2f2f2', shorts: '#f2f2f2', socks: '#d42027', pattern: 'plain' },
  { id: 'vikingur', name: 'Víkingur', shirt: '#d42027', shirt2: '#151515', shorts: '#151515', socks: '#151515', pattern: 'stripes' },
  { id: 'breidablik', name: 'Breiðablik', shirt: '#1f9d55', shirt2: '#f2f2f2', shorts: '#f2f2f2', socks: '#1f9d55', pattern: 'plain' },
  { id: 'ia', name: 'ÍA', shirt: '#ffd400', shirt2: '#151515', shorts: '#151515', socks: '#ffd400', pattern: 'sash' },
  { id: 'stjarnan', name: 'Stjarnan', shirt: '#2a64d6', shirt2: '#f2f2f2', shorts: '#2a64d6', socks: '#f2f2f2', pattern: 'plain' },
]

export interface Limb { a: number; b: number }
export interface Pose {
  /** whole body up (negative) or down, in pixels */
  bob: number
  /** torso top pushed forward, in pixels */
  lean: number
  /** head dropped forward, for the bad news */
  droop: number
  /** front and back leg: hip angle and knee bend (radians, 0 = straight down, + forward) */
  legs: [Limb, Limb]
  /** front and back arm: shoulder angle and elbow bend */
  arms: [Limb, Limb]
}

const TAU = Math.PI * 2

/** One step of the running stride, phase 0..1. */
export function runPose(phase: number): Pose {
  const leg = (f: number): Limb => ({ a: 0.78 * Math.sin(TAU * f), b: 0.25 + 1.25 * Math.max(0, Math.cos(TAU * f)) })
  const arm = (f: number): Limb => ({ a: -0.75 * Math.sin(TAU * f), b: 1.5 })
  return {
    bob: Math.sin(TAU * phase * 2) > 0.2 ? -1 : 0,
    lean: 1,
    droop: 0,
    legs: [leg(phase), leg(phase + 0.5)],
    arms: [arm(phase), arm(phase + 0.5)],
  }
}

/** Standing, breathing; phase 0..1 over a couple of seconds. */
export function idlePose(phase: number): Pose {
  return {
    bob: phase % 1 < 0.5 ? 0 : 1,
    lean: 0,
    droop: 0,
    legs: [{ a: 0.16, b: 0.08 }, { a: -0.14, b: 0.08 }],
    arms: [{ a: 0.12, b: 0.35 }, { a: -0.12, b: 0.35 }],
  }
}

/** Keepy-uppy: the front foot comes up to meet the ball, phase 0..1 per touch. */
export function jugglePose(phase: number): Pose {
  const kick = Math.max(0, Math.sin(Math.PI * Math.min(1, phase * 2.2)))
  return {
    bob: 0,
    lean: 0,
    droop: 1,
    legs: [{ a: 0.15 + 1.05 * kick, b: 0.2 + 1.0 * kick }, { a: -0.08, b: 0.1 }],
    arms: [{ a: 0.55, b: 0.4 }, { a: -0.55, b: 0.4 }],
  }
}

/** Arms up, off the ground. */
export function cheerPose(phase: number): Pose {
  const up = Math.abs(Math.sin(Math.PI * phase))
  return {
    bob: -Math.round(5 * up),
    lean: 0,
    droop: 0,
    legs: [{ a: 0.35, b: 0.9 * up + 0.1 }, { a: -0.25, b: 0.9 * up + 0.1 }],
    // a V over the head: one arm up in front, one up behind
    arms: [{ a: 2.0, b: 0.35 }, { a: -2.0, b: -0.35 }],
  }
}

/** Head down, hands on hips: a wrong answer. */
export function sulkPose(phase: number): Pose {
  return {
    bob: 1,
    lean: 0,
    droop: phase % 1 < 0.5 ? 2 : 1,
    legs: [{ a: 0.1, b: 0.15 }, { a: -0.1, b: 0.15 }],
    arms: [{ a: 0.55, b: -1.9 }, { a: -0.5, b: 1.9 }],
  }
}

const HEAD = [
  '..hhhhh.',
  '.hhhhhhh',
  'hhhhhhss',
  'hhhsssse',
  'hhssssss',
  '.hsssss.',
  '..ssss..',
]

/** The figure as palette slots, row by row (H rows of W). */
export function figure(pose: Pose, pattern: Kit['pattern'] = 'plain'): Uint8Array {
  const g = new Uint8Array(W * H)
  const set = (x: number, y: number, c: number) => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = c
  }
  const stroke = (x0: number, y0: number, x1: number, y1: number, color: (t: number) => number, thick = 2) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 1
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
      for (let dx = 0; dx < thick; dx++) for (let dy = 0; dy < thick; dy++) set(Math.floor(x) + dx, Math.floor(y) + dy, color(t))
    }
  }
  const hipX = 11, hipY = 19 + pose.bob
  const shoulderX = hipX + pose.lean, shoulderY = 12 + pose.bob

  const leg = (l: Limb, back: boolean) => {
    const kx = hipX + 5 * Math.sin(l.a), ky = hipY + 5 * Math.cos(l.a)
    const fa = l.a - l.b
    const fx = kx + 5 * Math.sin(fa), fy = ky + 5 * Math.cos(fa)
    stroke(hipX, hipY, kx, ky, (t) => (t < 0.45 ? (back ? P.ShortsBack : P.Shorts) : back ? P.SkinBack : P.Skin))
    stroke(kx, ky, fx, fy, (t) => (t < 0.25 ? (back ? P.SkinBack : P.Skin) : back ? P.SocksBack : P.Socks))
    // boot: toe points the way the foot is going
    for (let dx = -1; dx <= 2; dx++) { set(fx + dx, fy + 1, P.Boot); set(fx + dx, fy, P.Boot) }
    set(fx + 3, fy + 1, P.Boot)
  }
  const arm = (l: Limb, back: boolean) => {
    const ex = shoulderX + 4 * Math.sin(l.a), ey = shoulderY + 4 * Math.cos(l.a)
    const ha = l.a + l.b
    const hx = ex + 3.5 * Math.sin(ha), hy = ey + 3.5 * Math.cos(ha)
    stroke(shoulderX, shoulderY, ex, ey, (t) => (t < 0.5 ? (back ? P.ShirtBack : P.Shirt) : back ? P.SkinBack : P.Skin))
    stroke(ex, ey, hx, hy, () => (back ? P.SkinBack : P.Skin))
  }

  leg(pose.legs[1], true)
  arm(pose.arms[1], true)
  // torso: shoulders to hips, leaning
  for (let y = shoulderY - 1; y <= hipY; y++) {
    const t = (y - (shoulderY - 1)) / (hipY - shoulderY + 1)
    const cx = shoulderX + (hipX - shoulderX) * t
    for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 3; x++) {
      let c: number = P.Shirt
      if (pattern === 'stripes' && ((x - Math.round(cx)) & 1)) c = P.Shirt2
      if (pattern === 'sash' && Math.abs((x - Math.round(cx)) - (y - shoulderY) / 2 + 1) < 1) c = P.Shirt2
      if (y === shoulderY - 1 && pattern === 'plain' && x === Math.round(cx) + 1) c = P.Shirt2
      if (y >= hipY - 1) c = P.Shorts
      set(x, y, c)
    }
  }
  // head, on a short neck
  const hx = shoulderX - 2 + pose.droop, hy = shoulderY - 9 + Math.max(0, pose.droop - 1)
  HEAD.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === 'h') set(hx + c, hy + r, P.Hair)
    else if (ch === 's') set(hx + c, hy + r, P.Skin)
    else if (ch === 'e') set(hx + c, hy + r, pose.droop > 1 ? P.Skin : P.Eye)
  }))
  set(shoulderX, shoulderY - 2, P.Skin)
  set(shoulderX + 1, shoulderY - 2, P.Skin)
  leg(pose.legs[0], false)
  arm(pose.arms[0], false)

  // outline: every empty pixel that touches the figure
  const out = g.slice()
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y * W + x]) continue
    const near = (x > 0 && g[y * W + x - 1]) || (x < W - 1 && g[y * W + x + 1]) || (y > 0 && g[(y - 1) * W + x]) || (y < H - 1 && g[(y + 1) * W + x])
    if (near) out[y * W + x] = P.Outline
  }
  return out
}

/** Where the boots touch the ground in the figure's own rows: the scene stands it there. */
export const FEET_Y = 30

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)))
  return `rgb(${c(16)},${c(8)},${c(0)})`
}

/** Colours for every palette slot under a kit. */
export function palette(kit: Kit): string[] {
  const skin = '#f2c29b', hair = '#c58b3a'
  return [
    'transparent', '#16121c', skin, hair, kit.shirt, kit.shirt2, kit.shorts, kit.socks, '#1b1b22', '#1b1b22',
    shade(skin, 0.78), shade(kit.shirt, 0.72), shade(kit.shorts, 0.72), shade(kit.socks, 0.72),
  ]
}
