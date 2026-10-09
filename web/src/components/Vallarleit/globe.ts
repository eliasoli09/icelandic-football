import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { heatRgb, formatM } from '@/lib/vallarleit/geo'
import type { VClub } from '@/lib/vallarleit/types'

export interface Flag {
  club: VClub
  heat: number
  m: number
  correct: boolean
  sameGround: boolean
  /** performance.now() when it was planted; old flags pass 0 and appear at once */
  born: number
}

interface View { lon: number; lat: number; k: number }
interface Tween { from: View; to: View; start: number; ms: number; dip: number }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; spin: number; a: number; color: string; life: number }

const PALETTE = {
  dark: { space: '#070a09', ocean0: '#11293a', ocean1: '#081620', land: '#1d2d25', landHi: '#24382d', border: 'rgba(255,255,255,0.13)', grat: 'rgba(160,210,255,0.06)', dot: 'rgba(235,242,236,0.62)', dotHalo: 'rgba(0,0,0,0.5)', glow: 'rgba(90,170,255,0.22)', text: '#f2f5f0', pill: 'rgba(10,14,12,0.86)' },
  light: { space: '#f3f5f2', ocean0: '#d6eaf4', ocean1: '#a9cde0', land: '#f7f3e8', landHi: '#ffffff', border: 'rgba(30,50,40,0.28)', grat: 'rgba(30,80,120,0.10)', dot: 'rgba(16,24,18,0.66)', dotHalo: 'rgba(255,255,255,0.8)', glow: 'rgba(60,140,220,0.20)', text: '#101510', pill: 'rgba(255,255,255,0.94)' },
}

export const EUROPE: View = { lon: 13, lat: 50, k: 3.05 }
const MIN_K = 0.85, MAX_K = 40

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutBack = (t: number) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }
function bounce(t: number) {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

export class Globe {
  private ctx: CanvasRenderingContext2D
  private land: { features: GeoPermissibleObjects[] } | null = null
  private landLayer = document.createElement('canvas')
  private landKey = ''
  private view: View = { lon: -25, lat: 22, k: 0.95 }
  private tween: Tween | null = null
  private dots: VClub[] = []
  private flags: Flag[] = []
  private particles: Particle[] = []
  private rings: { lon: number; lat: number; start: number; color: string; max: number; ms: number }[] = []
  private hover: VClub | null = null
  private dark = true
  private w = 0
  private h = 0
  private dpr = 1
  private raf = 0
  private pointers = new Map<number, { x: number; y: number }>()
  private dragged = 0
  private pinch = 0
  private reveal: VClub | null = null
  private alive = true

  constructor(private canvas: HTMLCanvasElement, private on: { hover: (c: VClub | null, x: number, y: number) => void; pick: (c: VClub) => void }) {
    this.ctx = canvas.getContext('2d')!
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.up)
    canvas.addEventListener('pointercancel', this.up)
    canvas.addEventListener('pointerleave', this.leave)
    canvas.addEventListener('wheel', this.wheel, { passive: false })
    canvas.addEventListener('dblclick', this.dbl)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.alive = false
    cancelAnimationFrame(this.raf)
    const c = this.canvas
    c.removeEventListener('pointerdown', this.down)
    c.removeEventListener('pointermove', this.move)
    c.removeEventListener('pointerup', this.up)
    c.removeEventListener('pointercancel', this.up)
    c.removeEventListener('pointerleave', this.leave)
    c.removeEventListener('wheel', this.wheel)
    c.removeEventListener('dblclick', this.dbl)
  }

  setLand(geo: { features: GeoPermissibleObjects[] }) { this.land = geo; this.landKey = '' }
  setDots(clubs: VClub[]) { this.dots = clubs }
  setFlags(flags: Flag[]) { this.flags = flags }
  setDark(dark: boolean) { if (dark !== this.dark) { this.dark = dark; this.landKey = '' } }
  setReveal(club: VClub | null) { this.reveal = club }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = Math.max(1, r.width)
    this.h = Math.max(1, r.height)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.landLayer.width = this.canvas.width
    this.landLayer.height = this.canvas.height
    this.landKey = ''
  }

  /** fly the camera, zooming out on the way when the hop is long */
  flyTo(to: Partial<View>, ms = 1300) {
    const from = { ...this.view }
    const target = { lon: to.lon ?? from.lon, lat: to.lat ?? from.lat, k: Math.min(MAX_K, Math.max(MIN_K, to.k ?? from.k)) }
    const arc = geoDistance([from.lon, from.lat], [target.lon, target.lat])
    this.tween = { from, to: target, start: performance.now(), ms, dip: Math.min(0.65, arc * 1.6) }
  }

  /** frame a guess against the rest without losing Europe */
  frame2(points: { lat: number; lon: number }[], ms = 1300) {
    if (!points.length) return
    const latest = points[points.length - 1]
    this.flyTo({ lon: latest.lon, lat: Math.max(-60, Math.min(70, latest.lat)), k: Math.max(this.view.k, 3.6) }, ms)
  }

  celebrate(club: VClub) {
    const now = performance.now()
    for (let i = 0; i < 3; i++) this.rings.push({ lon: club.lon, lat: club.lat, start: now + 650 + i * 260, color: '#f6c445', max: 140, ms: 1500 })
    setTimeout(() => {
      if (!this.alive) return
      const p = this.projection()([club.lon, club.lat])
      if (!p) return
      const colors = ['#f6c445', '#ff6b4a', '#4ade80', '#6fb7ff', '#ffffff', '#e8b93c', '#ff3d7f']
      for (let i = 0; i < 160; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3
        const v = 4 + Math.random() * 9
        this.particles.push({ x: p[0], y: p[1] - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2.5 + Math.random() * 3.5, spin: (Math.random() - 0.5) * 0.4, a: Math.random() * 6, color: colors[i % colors.length], life: 1 })
      }
    }, 900)
  }

  zoomBy(f: number) { this.flyTo({ k: this.view.k * f }, 380) }
  home() { this.flyTo(EUROPE, 1200) }

  // ---------------------------------------------------------------- input

  private down = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY })
    this.dragged = 0
    this.tween = null
    if (this.pointers.size === 2) this.pinch = this.spread()
  }

  private spread() {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev) { this.hoverAt(e.offsetX, e.offsetY); return }
    const dx = e.offsetX - prev.x, dy = e.offsetY - prev.y
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY })
    this.dragged += Math.abs(dx) + Math.abs(dy)
    if (this.pointers.size === 2) {
      const s = this.spread()
      if (this.pinch) this.view.k = Math.min(MAX_K, Math.max(MIN_K, this.view.k * (s / this.pinch)))
      this.pinch = s
      return
    }
    const deg = 180 / Math.PI / this.scale()
    this.view.lon -= dx * deg
    this.view.lat = Math.max(-85, Math.min(85, this.view.lat + dy * deg))
    if (this.dragged > 4) { this.hover = null; this.on.hover(null, 0, 0) }
  }

  private up = (e: PointerEvent) => {
    const had = this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinch = 0
    if (had && this.dragged < 6 && e.type === 'pointerup') {
      const hit = this.hitTest(e.offsetX, e.offsetY, e.pointerType === 'touch' ? 18 : 10)
      if (hit) this.on.pick(hit)
    }
  }

  private leave = () => { if (!this.pointers.size) { this.hover = null; this.on.hover(null, 0, 0) } }

  private wheel = (e: WheelEvent) => {
    e.preventDefault()
    this.tween = null
    this.view.k = Math.min(MAX_K, Math.max(MIN_K, this.view.k * Math.exp(-e.deltaY * 0.0016)))
  }

  private dbl = (e: MouseEvent) => {
    const ll = this.projection().invert?.([e.offsetX, e.offsetY])
    if (ll) this.flyTo({ lon: ll[0], lat: ll[1], k: this.view.k * 2 }, 600)
  }

  private hoverAt(x: number, y: number) {
    const hit = this.hitTest(x, y, 10)
    this.hover = hit
    this.on.hover(hit, x, y)
    this.canvas.style.cursor = hit ? 'pointer' : 'grab'
  }

  private hitTest(x: number, y: number, radius: number): VClub | null {
    const proj = this.projection()
    const center: [number, number] = [this.view.lon, this.view.lat]
    let best: VClub | null = null, bestD = radius
    const consider = (c: VClub) => {
      if (geoDistance([c.lon, c.lat], center) > Math.PI / 2 - 0.02) return
      const p = proj([c.lon, c.lat])
      if (!p) return
      const d = Math.hypot(p[0] - x, p[1] - y)
      if (d < bestD) { bestD = d; best = c }
    }
    for (const c of this.dots) consider(c)
    return best
  }

  // ---------------------------------------------------------------- drawing

  private scale() { return Math.min(this.w, this.h) * 0.46 * this.view.k }

  private projection() {
    return geoOrthographic()
      .rotate([-this.view.lon, -this.view.lat])
      .scale(this.scale())
      .translate([this.w / 2, this.h / 2])
      .clipAngle(90)
      .precision(0.4)
  }

  private frame = (now: number) => {
    if (!this.alive) return
    this.raf = requestAnimationFrame(this.frame)
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.ms)
      const e = easeInOut(t)
      const { from, to, dip } = this.tween
      const [lon, lat] = geoInterpolate([from.lon, from.lat], [to.lon, to.lat])(e)
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e) * (1 - Math.sin(Math.PI * e) * dip)
      this.view = { lon, lat, k: Math.max(MIN_K, k) }
      if (t >= 1) this.tween = null
    }
    this.draw(now)
  }

  private drawLand(proj: ReturnType<typeof geoOrthographic>, pal: typeof PALETTE.dark) {
    const key = `${this.view.lon.toFixed(3)}|${this.view.lat.toFixed(3)}|${this.view.k.toFixed(4)}|${this.w}|${this.h}|${this.dark}|${!!this.land}`
    if (key === this.landKey) return
    this.landKey = key
    const g = this.landLayer.getContext('2d')!
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, this.w, this.h)
    const path = geoPath(proj, g)
    const r = proj.scale(), [cx, cy] = proj.translate()
    // atmosphere
    const glow = g.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.12)
    glow.addColorStop(0, pal.glow)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = glow
    g.beginPath(); g.arc(cx, cy, r * 1.12, 0, Math.PI * 2); g.fill()
    // ocean, lit from the upper left
    const sea = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
    sea.addColorStop(0, pal.ocean0)
    sea.addColorStop(1, pal.ocean1)
    g.fillStyle = sea
    g.beginPath(); path({ type: 'Sphere' }); g.fill()
    g.strokeStyle = pal.grat
    g.lineWidth = 1
    g.beginPath(); path(geoGraticule10()); g.stroke()
    if (this.land) {
      g.fillStyle = pal.land
      g.beginPath()
      for (const f of this.land.features) path(f)
      g.fill()
      g.strokeStyle = pal.border
      g.lineWidth = Math.min(1.4, 0.5 + this.view.k * 0.08)
      g.lineJoin = 'round'
      g.stroke()
    }
    // a soft terminator so the globe reads as round
    const shade = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.5, cx, cy, r * 1.02)
    shade.addColorStop(0, 'rgba(0,0,0,0)')
    shade.addColorStop(1, this.dark ? 'rgba(0,0,0,0.38)' : 'rgba(20,50,80,0.16)')
    g.fillStyle = shade
    g.beginPath(); path({ type: 'Sphere' }); g.fill()
  }

  private draw(now: number) {
    const pal = this.dark ? PALETTE.dark : PALETTE.light
    const ctx = this.ctx
    const proj = this.projection()
    this.drawLand(proj, pal)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.drawImage(this.landLayer, 0, 0)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    const center: [number, number] = [this.view.lon, this.view.lat]
    const visible = (c: { lon: number; lat: number }) => geoDistance([c.lon, c.lat], center) < Math.PI / 2 - 0.015
    const flagged = new Set(this.flags.map((f) => f.club.id))

    // grounds
    const dotR = Math.min(4.2, 1.6 + this.view.k * 0.16)
    for (const c of this.dots) {
      if (flagged.has(c.id) || !visible(c)) continue
      const p = proj([c.lon, c.lat])
      if (!p) continue
      const hot = this.hover?.id === c.id
      ctx.beginPath()
      ctx.arc(p[0], p[1], hot ? dotR + 3 : dotR, 0, Math.PI * 2)
      ctx.fillStyle = hot ? '#f6c445' : pal.dot
      ctx.strokeStyle = pal.dotHalo
      ctx.lineWidth = 1
      ctx.fill()
      ctx.stroke()
    }

    // rings
    this.rings = this.rings.filter((r) => now - r.start < r.ms)
    for (const r of this.rings) {
      const t = (now - r.start) / r.ms
      if (t < 0 || !visible(r)) continue
      const p = proj([r.lon, r.lat])
      if (!p) continue
      ctx.beginPath()
      ctx.ellipse(p[0], p[1], r.max * t, r.max * t * 0.42, 0, 0, Math.PI * 2)
      ctx.strokeStyle = r.color
      ctx.globalAlpha = (1 - t) * 0.9
      ctx.lineWidth = 3 * (1 - t) + 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // flags, back to front
    const placed = this.flags
      .filter((f) => visible(f.club))
      .map((f) => ({ f, p: proj([f.club.lon, f.club.lat])! }))
      .filter((x) => x.p)
      .sort((a, b) => a.p[1] - b.p[1])
    const newest = this.flags.reduce((a, f) => Math.max(a, f.born), 0)
    for (const { f, p } of placed) this.drawFlag(ctx, f, p[0], p[1], now, f.born === newest && newest > 0, pal)

    // the answer, once the game is given up
    if (this.reveal && !flagged.has(this.reveal.id) && visible(this.reveal)) {
      const p = proj([this.reveal.lon, this.reveal.lat])
      if (p) this.drawFlag(ctx, { club: this.reveal, heat: 1, m: 0, correct: true, sameGround: false, born: 0 }, p[0], p[1], now, false, pal, true)
    }

    // confetti
    if (this.particles.length) {
      for (const q of this.particles) {
        q.vy += 0.22; q.vx *= 0.99; q.x += q.vx; q.y += q.vy; q.a += q.spin; q.life -= 0.006
        ctx.save()
        ctx.translate(q.x, q.y)
        ctx.rotate(q.a)
        ctx.globalAlpha = Math.max(0, q.life)
        ctx.fillStyle = q.color
        ctx.fillRect(-q.r, -q.r * 0.45, q.r * 2, q.r * 0.9)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      this.particles = this.particles.filter((q) => q.life > 0 && q.y < this.h + 40)
    }
  }

  private drawFlag(ctx: CanvasRenderingContext2D, f: Flag, x: number, y: number, now: number, latest: boolean, pal: typeof PALETTE.dark, ghost = false) {
    const age = f.born ? now - f.born : 99999
    const drop = Math.min(1, age / 650)
    const lift = (1 - bounce(drop)) * 90
    const grow = f.born ? easeOutBack(Math.min(1, age / 500)) : 1
    const big = f.correct ? 1.35 : 1
    const pole = 30 * big * Math.max(0.2, grow)
    const [r, g, b] = f.correct ? [246, 196, 69] : f.sameGround ? [236, 72, 153] : heatRgb(f.heat)
    const color = `rgb(${r},${g},${b})`
    const edge = `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`

    // landing ripple
    if (age > 520 && age < 1700) {
      const t = (age - 520) / 1180
      ctx.beginPath()
      ctx.ellipse(x, y, 6 + 46 * t, (6 + 46 * t) * 0.4, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.globalAlpha = 1 - t
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // a steady pulse under the newest flag
    if (latest || f.correct) {
      const t = ((now / 1400) % 1)
      ctx.beginPath()
      ctx.ellipse(x, y, 5 + 16 * t, (5 + 16 * t) * 0.42, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.6 * (1 - t)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const by = y - lift
    ctx.globalAlpha = ghost ? 0.85 : Math.min(1, 0.2 + drop * 1.6)
    // shadow on the ground
    ctx.beginPath()
    ctx.ellipse(x, y, 4.5 * big, 1.8 * big, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
    // pole
    ctx.beginPath()
    ctx.moveTo(x, by)
    ctx.lineTo(x, by - pole)
    ctx.strokeStyle = this.dark ? '#d8dcd6' : '#3b4540'
    ctx.lineWidth = 1.8 * big
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, by - pole, 1.9 * big, 0, Math.PI * 2)
    ctx.fillStyle = this.dark ? '#ffffff' : '#222'
    ctx.fill()
    // cloth, waving
    const fw = 19 * big * grow, fh = 12 * big * grow
    const top = by - pole + 1
    const phase = now / 260 + f.club.lat * 3
    ctx.beginPath()
    ctx.moveTo(x, top)
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      const u = i / steps
      ctx.lineTo(x + fw * u, top + Math.sin(phase + u * 3.2) * 2.2 * u)
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps
      ctx.lineTo(x + fw * u, top + fh + Math.sin(phase + u * 3.2) * 2.2 * u)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = 1
    ctx.stroke()
    if (f.correct) {
      // a ball on the winning flag
      ctx.beginPath()
      ctx.arc(x + fw * 0.5, top + fh * 0.5 + Math.sin(phase + 1.6) * 1.1, fh * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // distance tag over the newest flag
    if ((latest && age < 4200 && drop >= 1) || ghost) {
      const t = ghost ? 1 : Math.min(1, (age - 650) / 250) * Math.min(1, (4200 - age) / 400)
      const label = ghost ? f.club.name : f.correct ? 'Rétt!' : formatM(f.m)
      ctx.font = '600 12px var(--font-geist-sans), system-ui, sans-serif'
      const tw = ctx.measureText(label).width
      const lx = x + fw / 2, ly = top - 16
      ctx.globalAlpha = Math.max(0, t)
      ctx.fillStyle = pal.pill
      ctx.beginPath()
      ctx.roundRect(lx - tw / 2 - 8, ly - 10, tw + 16, 20, 10)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = pal.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, lx, ly + 0.5)
      ctx.globalAlpha = 1
    }
  }
}
