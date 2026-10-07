import { FEET_Y, H as FH, W as FW, cheerPose, figure, idlePose, jugglePose, palette, runPose, sulkPose, type Kit, type Pose } from '@/lib/leidin/sprite'
import { PERFECT, STADIUMS, roadX, stadiumX } from '@/lib/leidin/road'

/**
 * The road, drawn on a small canvas that the page scales up without smoothing,
 * so one canvas pixel is one pixel of the stadium pictures and of the runner.
 * Everything is drawn again each frame from the camera position: sky, two
 * layers of hills that move slower than the road, the grounds, the pavement
 * the runner is on, the road and the verge in front.
 */

export type Mood = 'idle' | 'juggle' | 'cheer' | 'sulk'

const TIER_COLORS: Record<number, string> = { 10: '#9aa7b8', 25: '#6fcf6a', 50: '#4fb3ff', 75: '#c77dff', 100: '#ffd23f' }

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'],
}

const BALL = ['.kkk.', 'kwkwk', 'kkwkk', 'kwkwk', '.kkk.']
const BALL2 = ['.kwk.', 'wkkkw', 'kwwwk', 'wkkkw', '.kwk.']

/** a fixed pseudo-random number for an integer, so the scenery never shuffles */
const hash = (n: number) => {
  let h = (n * 374761393) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}

/** sky top and horizon from morning at the school pitch to dusk at Laugardalur */
const SKY = [
  { at: 0, top: '#4f9fe0', low: '#c7ecff' },
  { at: 0.45, top: '#3a86d4', low: '#a9dcff' },
  { at: 0.75, top: '#4a63b0', low: '#ffc98f' },
  { at: 1, top: '#1d1f4d', low: '#ff8f6b' },
]
function skyAt(p: number) {
  const i = Math.max(0, SKY.findIndex((k, j) => j < SKY.length - 1 && p >= k.at && p <= SKY[j + 1].at))
  const a = SKY[i], b = SKY[Math.min(i + 1, SKY.length - 1)]
  const t = b.at === a.at ? 0 : (p - a.at) / (b.at - a.at)
  return { top: mix(a.top, b.top, t), low: mix(a.low, b.low, t) }
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

export class RoadScene {
  private ctx: CanvasRenderingContext2D
  private vw = 320
  private vh = 240
  private images: (HTMLImageElement | null)[] = STADIUMS.map(() => null)
  private frames = new Map<string, HTMLCanvasElement[]>()
  private x = roadX(0)
  private target = roadX(0)
  private cam = roadX(0) - 100
  private phase = 0
  private mood: Mood = 'juggle'
  private moodT = 0
  private t = 0
  private flagsFrom: number | null = null
  private hit: number | null = null
  private particles: Particle[] = []
  private raf = 0
  private last = 0
  private running = false
  private stars: { x: number; y: number }[] = []

  /** bottom of the screen hidden under the answer box, in screen pixels */
  bottomPad = 90
  onPass: ((index: number) => void) | null = null
  onArrive: (() => void) | null = null

  constructor(private canvas: HTMLCanvasElement, kit: Kit) {
    this.ctx = canvas.getContext('2d')!
    this.setKit(kit)
    STADIUMS.forEach((s, i) => {
      const img = new Image()
      img.onload = () => { this.images[i] = img }
      img.src = s.image
    })
    for (let i = 0; i < 70; i++) this.stars.push({ x: hash(i * 7 + 1), y: hash(i * 13 + 5) })
    this.resize()
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy() { cancelAnimationFrame(this.raf) }

  setKit(kit: Kit) {
    const pal = palette(kit)
    const make = (pose: Pose) => {
      const g = figure(pose, kit.pattern)
      const c = document.createElement('canvas')
      c.width = FW; c.height = FH
      const cx = c.getContext('2d')!
      for (let i = 0; i < g.length; i++) if (g[i]) { cx.fillStyle = pal[g[i]]; cx.fillRect(i % FW, Math.floor(i / FW), 1, 1) }
      return c
    }
    const cycle = (fn: (p: number) => Pose, n: number) => Array.from({ length: n }, (_, i) => make(fn(i / n)))
    this.frames.set('run', cycle(runPose, 8))
    this.frames.set('idle', cycle(idlePose, 2))
    this.frames.set('juggle', cycle(jugglePose, 8))
    this.frames.set('cheer', cycle(cheerPose, 8))
    this.frames.set('sulk', cycle(sulkPose, 2))
  }

  /** Fit the canvas to its box: the biggest whole-number scale that still shows a good stretch of road. */
  resize() {
    const box = this.canvas.parentElement!.getBoundingClientRect()
    const scale = Math.max(1, Math.floor(Math.min(box.width / 330, box.height / 230)))
    this.vw = Math.ceil(box.width / scale)
    this.vh = Math.ceil(box.height / scale)
    this.canvas.width = this.vw
    this.canvas.height = this.vh
    this.scaleNow = scale
    this.ctx.imageSmoothingEnabled = false
  }
  scaleNow = 1

  /** Move the runner to a score; instantly when restoring a road. */
  moveTo(points: number, instant = false) {
    this.target = roadX(points)
    if (instant) { this.x = this.target; this.cam = this.camGoal() }
    else if (this.target > this.x) this.running = true
  }

  setMood(mood: Mood) { this.mood = mood; this.moodT = 0 }

  /** Flags along the road ahead for each possible score, or none. */
  showFlags(from: number | null) { this.flagsFrom = from; this.hit = null }
  markFlag(points: number | null) { this.hit = points }

  /** Confetti over the runner, and fireworks over a ground for the big moments. */
  celebrate(color: string, fireworks = false) {
    const sx = this.x - this.cam, sy = this.groundTop() - 20
    for (let i = 0; i < 40; i++) {
      this.particles.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 70, life: 1.6, color: Math.random() < 0.5 ? color : '#ffffff', size: Math.random() < 0.3 ? 2 : 1 })
    }
    if (fireworks) {
      for (let b = 0; b < 5; b++) {
        const bx = sx - 60 + Math.random() * 160, by = 20 + Math.random() * (this.groundTop() * 0.35)
        const c = ['#ffd23f', '#ff5a5f', '#4fb3ff', '#ffffff', '#c77dff'][b]
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2, v = 40 + Math.random() * 25
          this.particles.push({ x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + b * 0.25, color: c, size: 1 })
        }
      }
    }
  }

  /** Screen position (CSS pixels, from the canvas box) of a world x on the pavement. */
  toScreen(points: number): { x: number; y: number } {
    return { x: (roadX(points) - this.cam) * this.scaleNow, y: this.groundTop() * this.scaleNow }
  }

  private groundTop() {
    return this.vh - Math.ceil(this.bottomPad / this.scaleNow) - 34
  }
  private camGoal() { return this.x - this.vw * 0.32 }

  private loop = (now: number) => {
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0)
    this.last = now
    this.update(dt)
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    this.t += dt
    this.moodT += dt
    if (this.running) {
      const gap = this.target - this.x
      const speed = Math.min(340, Math.max(75, gap * 1.7))
      const before = this.x
      this.x = Math.min(this.target, this.x + speed * dt)
      this.phase = (this.phase + (dt * speed) / 36) % 1
      STADIUMS.forEach((_, i) => {
        if (i > 0 && before < stadiumX(i) && this.x >= stadiumX(i)) this.onPass?.(i)
      })
      if (this.x >= this.target) { this.running = false; this.onArrive?.() }
    }
    this.cam += (this.camGoal() - this.cam) * Math.min(1, dt * 3.5)
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.vx *= 0.99; p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  private px(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }

  private text(s: string, x: number, y: number, color: string) {
    let cx = Math.round(x)
    for (const ch of s) {
      const g = DIGITS[ch]
      if (g) g.forEach((row, r) => [...row].forEach((b, c) => { if (b === '1') this.px(cx + c, y + r, 1, 1, color) }))
      cx += 4
    }
  }

  private draw() {
    const { ctx, vw, vh } = this
    const ground = this.groundTop()
    const progress = Math.min(1, Math.max(0, (this.x - stadiumX(0)) / (stadiumX(STADIUMS.length - 1) - stadiumX(0))))
    const sky = skyAt(progress)

    // sky in hard bands, the way old games did gradients
    const bands = 12, horizon = ground - 6
    for (let i = 0; i < bands; i++) {
      this.px(0, (horizon * i) / bands, vw, Math.ceil(horizon / bands) + 1, mix(this.hex(sky.top), this.hex(sky.low), i / (bands - 1)))
    }
    this.px(0, horizon, vw, vh - horizon, this.hex(sky.low))
    if (progress > 0.8) {
      const a = (progress - 0.8) / 0.2
      for (const s of this.stars) if (s.y < 0.45 && hash(Math.floor(this.t * 2) + s.x * 1e4) < a) this.px(s.x * vw, s.y * horizon, 1, 1, '#ffffff')
    }
    // sun going down over the day
    const sunX = vw * 0.78, sunY = horizon * (0.18 + 0.55 * progress)
    const sunC = progress < 0.7 ? '#fff3b0' : '#ffb36b'
    for (let dy = -7; dy <= 7; dy++) {
      const w = Math.round(Math.sqrt(49 - dy * dy))
      this.px(sunX - w, sunY + dy, w * 2, 1, sunC)
    }

    // clouds drifting slowly
    for (let i = 0; i < 9; i++) {
      const span = vw + 120
      const cx = ((hash(i) * span - this.cam * 0.06 - this.t * (2 + hash(i + 50) * 3)) % span + span) % span - 60
      const cy = 10 + hash(i + 9) * horizon * 0.45
      const w = 18 + Math.round(hash(i + 3) * 26)
      this.px(cx, cy, w, 4, '#ffffff')
      this.px(cx + 4, cy - 3, w - 10, 3, '#ffffff')
      this.px(cx + 8, cy - 5, Math.max(4, w - 20), 2, '#ffffff')
      this.px(cx + 2, cy + 4, w - 4, 1, progress > 0.7 ? '#f3c3b0' : '#dbe9f5')
    }

    // far mountains: dark slopes with snow on the tops, like Esja across the bay
    const far = this.cam * 0.12
    const farCol = mix('#6f86a3', '#3b3f6b', progress), snow = mix('#eef4fb', '#c9c2dd', progress)
    for (let x = 0; x < vw; x++) {
      const w = x + far
      const h = 24 + 13 * Math.sin(w * 0.011 + 1) + 8 * Math.sin(w * 0.029 + 2) + 4 * Math.sin(w * 0.071)
      const top = Math.round(horizon - Math.min(h, 40))
      this.px(x, top, 1, horizon - top, farCol)
      if (h > 31) this.px(x, top, 1, Math.min(3, Math.round(h - 30)), snow)
    }
    // nearer hills with houses and the odd sheep
    const near = this.cam * 0.35
    const hillCol = mix('#5e9a4c', '#35593f', progress), hillDark = mix('#4b8240', '#2b4834', progress)
    const hillTop = (w: number) => Math.round(horizon - (9 + 6 * Math.sin(w * 0.018) + 4 * Math.sin(w * 0.047 + 1)))
    for (let x = 0; x < vw; x++) {
      const w = x + near, top = hillTop(w)
      this.px(x, top, 1, ground - top, hillCol)
      if ((x + top) % 7 === 0) this.px(x, top + 3, 1, 1, hillDark)
    }
    const firstLot = Math.floor(near / 46) - 1
    for (let lot = firstLot; lot < firstLot + vw / 46 + 3; lot++) {
      const r = hash(lot + 1000)
      const sx = lot * 46 - near + r * 20
      const base = hillTop(sx + near) + 2
      if (r < 0.42) {
        const body = ['#f4efe2', '#d9523f', '#f2c230', '#3f7cc4', '#e9e9e9'][Math.floor(hash(lot + 7) * 5)]
        const roof = ['#b6372b', '#2f5244', '#2d2d33', '#355f9e'][Math.floor(hash(lot + 3) * 4)]
        if (hash(lot + 11) < 0.12) {
          // a little white church with a red roof
          this.px(sx, base - 6, 9, 6, '#f6f3ea'); this.px(sx - 1, base - 8, 11, 2, '#c23a2d')
          this.px(sx + 6, base - 14, 3, 8, '#f6f3ea'); this.px(sx + 6, base - 16, 3, 2, '#c23a2d'); this.px(sx + 7, base - 17, 1, 1, '#c23a2d')
          this.px(sx + 3, base - 4, 2, 4, '#5a4636')
        } else {
          this.px(sx, base - 6, 10, 6, body); this.px(sx - 1, base - 8, 12, 2, roof); this.px(sx + 1, base - 9, 8, 1, roof)
          this.px(sx + 2, base - 4, 2, 2, '#ffe9a3'); this.px(sx + 6, base - 4, 2, 4, '#4d3b30')
        }
      } else if (r > 0.82) {
        // sheep
        this.px(sx, base - 3, 5, 3, '#f5f5f0'); this.px(sx + 5, base - 3, 2, 2, '#2a2a2a'); this.px(sx + 1, base, 1, 1, '#2a2a2a'); this.px(sx + 3, base, 1, 1, '#2a2a2a')
      }
    }

    // grass behind the pavement
    this.px(0, ground - 4, vw, 6, mix('#6aa84f', '#3f6a41', progress))

    // the grounds
    STADIUMS.forEach((s, i) => {
      const img = this.images[i]
      const sx = stadiumX(i) - this.cam
      if (!img || sx + img.width < -20 || sx - img.width > vw + 20) return
      ctx.drawImage(img, Math.round(sx - img.width / 2), ground - img.height + 2)
    })

    // pavement, kerb, road, verge
    this.px(0, ground + 1, vw, 7, '#b8bcc4')
    for (let x = -((Math.round(this.cam) % 9) + 9) % 9; x < vw; x += 9) this.px(x, ground + 1, 1, 7, '#9ea3ad')
    this.px(0, ground + 8, vw, 1, '#6b6f78')
    this.px(0, ground + 9, vw, 20, '#3e4149')
    for (let x = -((Math.round(this.cam) % 24) + 24) % 24; x < vw; x += 24) this.px(x, ground + 18, 12, 2, '#f2c94c')
    this.px(0, ground + 29, vw, vh - ground - 29, mix('#4f8a3c', '#2f5233', progress))
    const nearV = this.cam * 1.15
    for (let k = Math.floor(nearV / 23) - 1; k < nearV / 23 + vw / 23 + 2; k++) {
      const vx = k * 23 - nearV, r = hash(k + 5000)
      if (r < 0.45) {
        // lupines: the purple that covers Iceland in summer
        const h = 4 + Math.round(r * 8)
        this.px(vx, ground + 33 - h, 1, h, '#3f7a34'); this.px(vx, ground + 33 - h, 1, Math.ceil(h / 2), '#8a64d6'); this.px(vx + 2, ground + 35 - h, 1, h - 2, '#3f7a34'); this.px(vx + 2, ground + 35 - h, 1, 2, '#a07ae6')
      } else if (r > 0.9) this.px(vx, ground + 33, 4, 2, '#6c6a66')
    }

    // lamp posts and the signs that count down to the next ground
    for (let k = Math.floor(this.cam / 150) - 1; k < this.cam / 150 + vw / 150 + 2; k++) {
      const wx = k * 150 + 75
      const nearest = STADIUMS.reduce((d, _, i) => Math.min(d, Math.abs(wx - stadiumX(i))), Infinity)
      if (nearest < 190) continue
      const sx = wx - this.cam
      this.px(sx, ground - 30, 1, 31, '#4a4e57'); this.px(sx - 1, ground - 31, 4, 2, '#4a4e57'); this.px(sx + 1, ground - 29, 2, 1, progress > 0.75 ? '#ffe58a' : '#d9dde3')
    }
    STADIUMS.forEach((s, i) => {
      if (i === 0) return
      const sx = stadiumX(i) - 240 - this.cam
      if (sx < -20 || sx > vw + 20) return
      const label = String(s.at), w = label.length * 4 + 5
      this.px(sx, ground - 18, 1, 19, '#5b5f68')
      this.px(sx - Math.floor(w / 2), ground - 27, w, 10, '#ffffff')
      this.px(sx - Math.floor(w / 2) + 1, ground - 26, w - 2, 8, '#1f5fb8')
      this.text(label, sx - Math.floor(w / 2) + 3, ground - 25, '#ffffff')
    })

    // flags for each score the answer could bring
    if (this.flagsFrom !== null) {
      for (const tier of [10, 25, 50, 75, 100]) {
        const pts = Math.min(PERFECT, this.flagsFrom + tier)
        const sx = roadX(pts) - this.cam
        if (sx < -10 || sx > vw + 10) continue
        const wave = Math.round(Math.sin(this.t * 6 + tier) * 1)
        const lit = this.hit === tier
        this.px(sx, ground - 16, 1, 17, '#e8e8e8')
        this.px(sx + 1, ground - 16 + wave, 7, 5, TIER_COLORS[tier])
        if (lit) this.px(sx + 1, ground - 17 + wave, 7, 1, '#ffffff')
        if (lit || this.hit === null) this.text(`+${tier}`, sx - 2, ground - 24, lit ? '#ffffff' : TIER_COLORS[tier])
      }
    }

    // the runner and the ball
    const rx = Math.round(this.x - this.cam), feet = ground + 5
    this.px(rx - 6, feet, 13, 1, 'rgba(0,0,0,0.25)')
    const set = this.running ? 'run' : this.mood
    const frames = this.frames.get(set)!
    const fps = set === 'run' ? 0 : set === 'juggle' ? 7 : set === 'cheer' ? 9 : 2.5
    const frame = set === 'run' ? frames[Math.floor(this.phase * frames.length) % frames.length] : frames[Math.floor(this.moodT * fps) % frames.length]
    ctx.drawImage(frame, rx - 11, feet - FEET_Y)
    let bx = rx + 8, by = feet - 4, spin = Math.floor(this.t * 8) % 2
    if (this.running) {
      bx = rx + 10 + Math.round(Math.sin(this.phase * Math.PI * 2) * 2)
      by = feet - 4 - Math.round(Math.abs(Math.sin(this.phase * Math.PI * 2)) * 3)
      spin = Math.floor(this.phase * 4) % 2
    } else if (this.mood === 'juggle') {
      const p = (this.moodT * 7 / 8) % 1
      bx = rx + 6
      by = feet - 9 - Math.round(16 * Math.sin(Math.PI * ((p + 0.75) % 1)))
    } else if (this.mood === 'cheer') {
      bx = rx - 12
    }
    const ball = spin ? BALL2 : BALL
    ball.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '.') this.px(bx + c, by + r, 1, 1, ch === 'k' ? '#1b1b22' : '#fafafa')
    }))

    for (const p of this.particles) this.px(p.x, p.y, p.size, p.size, p.color)
  }

  private hex(rgb: string) {
    if (rgb.startsWith('#')) return rgb
    const [r, g, b] = rgb.slice(4, -1).split(',').map(Number)
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
}
