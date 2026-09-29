import { apply, type Mat3, type Pt } from '@/lib/offside/homography'
import { pitchLines, type PitchDims } from '@/lib/offside/pitch'
import type { OffsideResult, Role, Status } from '@/lib/offside/offside'
import type { Box } from '@/lib/offside/tracking'

export interface Player {
  id: string
  box: Box | null
  /** Ground reference point in image pixels (feet / most advanced part). */
  foot: Pt
  role: Role
  /** Shirt colour (CSS) measured from the frame. */
  shirt?: string
  outlier?: boolean
}

export const ROLE_COLOUR: Record<Role, string> = {
  attacker: '#ff4d5a',
  defender: '#3d8bff',
  keeper: '#f5b700',
  ignore: '#98a1b3',
}

export const STATUS_COLOUR: Record<Status, string> = {
  offside: '#ff4d5a',
  onside: '#22c58b',
  close: '#f5b700',
}

export interface Overlay {
  frame: CanvasImageSource | null
  width: number
  height: number
  /** pitch → image */
  Hinv: Mat3 | null
  dims: PitchDims
  showLines: boolean
  calib: { key: string; n: number; pt: Pt; active: boolean }[]
  players: Player[]
  labels: Map<string, string>
  selectedId: string | null
  receiverId: string | null
  ball: Pt | null
  result: OffsideResult | null
  receiverU: number | null
  receiverStatus: Status | null
  scanBoxes: { persons: Box[]; balls: Box[] } | null
  pointer: Pt | null
  loupe: boolean
}

/** Projects a pitch polyline, splitting where it crosses the camera horizon. */
function projectPolyline(Hinv: Mat3, pts: Pt[], sign: number, step = 2): Pt[][] {
  const out: Pt[][] = []
  let cur: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const segs = b ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step)) : 1
    for (let k = 0; k < segs; k++) {
      if (!b && k > 0) break
      const r = b ? k / segs : 0
      const p = apply(Hinv, { x: a.x + (b ? (b.x - a.x) * r : 0), y: a.y + (b ? (b.y - a.y) * r : 0) })
      if (p && Math.sign(p.w) === sign) cur.push(p)
      else if (cur.length) {
        out.push(cur)
        cur = []
      }
    }
  }
  if (cur.length) out.push(cur)
  return out
}

function stroke(ctx: CanvasRenderingContext2D, runs: Pt[][]) {
  for (const run of runs) {
    if (run.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(run[0].x, run[0].y)
    for (const p of run.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
}

/** Sign of w for points in front of the camera (taken at the calibrated area). */
export function frontSign(Hinv: Mat3): number {
  const p = apply(Hinv, { x: 11, y: 0 })
  return p ? Math.sign(p.w) || 1 : 1
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, s: number) {
  ctx.font = `600 ${12 * s}px ui-sans-serif, system-ui, sans-serif`
  const w = ctx.measureText(text).width + 8 * s
  const h = 16 * s
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h, w, h, 4 * s)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - h / 2 + 0.5 * s)
}

/** Draws the analysed frame with every overlay. `s` = canvas px per CSS px. */
export function drawOverlay(ctx: CanvasRenderingContext2D, o: Overlay, s: number) {
  ctx.save()
  ctx.clearRect(0, 0, o.width, o.height)
  if (o.frame) ctx.drawImage(o.frame, 0, 0, o.width, o.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Live AI boxes while scanning.
  if (o.scanBoxes) {
    ctx.lineWidth = 1.5 * s
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    for (const b of o.scanBoxes.persons) ctx.strokeRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = '#ffe14d'
    ctx.lineWidth = 2.5 * s
    for (const b of o.scanBoxes.balls) {
      ctx.beginPath()
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) / 2 + 4 * s, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  const sign = o.Hinv ? frontSign(o.Hinv) : 1
  if (o.Hinv && o.showLines) {
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)'
    ctx.lineWidth = 1.5 * s
    for (const line of pitchLines(o.dims)) stroke(ctx, projectPolyline(o.Hinv, line, sign))
  }

  // Offside line (second-last defender or ball) and the receiver's line.
  if (o.Hinv && o.result?.lineU != null) {
    const W = o.dims.width / 2 + 3
    const lineAt = (u: number) => projectPolyline(o.Hinv!, [{ x: u, y: -W }, { x: u, y: W }], sign, 1)
    if (o.receiverU != null && o.receiverStatus) {
      // Shade the gap between the two lines.
      const a = lineAt(o.result.lineU).flat()
      const b = lineAt(o.receiverU).flat()
      if (a.length > 1 && b.length > 1) {
        ctx.fillStyle = o.receiverStatus === 'offside' ? 'rgba(255,77,90,0.22)' : 'rgba(34,197,139,0.22)'
        ctx.beginPath()
        ctx.moveTo(a[0].x, a[0].y)
        ctx.lineTo(a[a.length - 1].x, a[a.length - 1].y)
        ctx.lineTo(b[b.length - 1].x, b[b.length - 1].y)
        ctx.lineTo(b[0].x, b[0].y)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = STATUS_COLOUR[o.receiverStatus]
      ctx.lineWidth = 2.5 * s
      ctx.setLineDash([10 * s, 6 * s])
      stroke(ctx, lineAt(o.receiverU))
      ctx.setLineDash([])
    }
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 4 * s
    ctx.strokeStyle = '#3d8bff'
    ctx.lineWidth = 3 * s
    stroke(ctx, lineAt(o.result.lineU))
    ctx.shadowBlur = 0
  }

  // Players.
  for (const p of o.players) {
    const col = ROLE_COLOUR[p.role]
    const sel = p.id === o.selectedId
    const rec = p.id === o.receiverId
    if (p.box) {
      ctx.strokeStyle = col
      ctx.globalAlpha = p.role === 'ignore' ? 0.45 : 0.9
      ctx.lineWidth = (sel ? 2.5 : 1.5) * s
      ctx.strokeRect(p.box.x, p.box.y, p.box.w, p.box.h)
      ctx.globalAlpha = 1
    }
    if (rec) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2.5 * s
      ctx.beginPath()
      ctx.ellipse(p.foot.x, p.foot.y, 16 * s, 7 * s, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = col
    ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.7)'
    ctx.lineWidth = (sel ? 2.5 : 1.5) * s
    ctx.beginPath()
    ctx.arc(p.foot.x, p.foot.y, 5 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const text = o.labels.get(p.id)
    if (text) label(ctx, rec ? `${text} · móttakandi` : text, p.foot.x, (p.box ? p.box.y : p.foot.y - 20 * s) - 3 * s, col, s)
  }

  if (o.ball) {
    ctx.fillStyle = '#ffe14d'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5 * s
    ctx.beginPath()
    ctx.arc(o.ball.x, o.ball.y, 5 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#ffe14d'
    ctx.beginPath()
    ctx.arc(o.ball.x, o.ball.y, 10 * s, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const c of o.calib) {
    ctx.strokeStyle = c.active ? '#00e5ff' : '#fff'
    ctx.lineWidth = 2 * s
    const r = 7 * s
    ctx.beginPath()
    ctx.moveTo(c.pt.x - r, c.pt.y)
    ctx.lineTo(c.pt.x + r, c.pt.y)
    ctx.moveTo(c.pt.x, c.pt.y - r)
    ctx.lineTo(c.pt.x, c.pt.y + r)
    ctx.stroke()
    label(ctx, String(c.n), c.pt.x + 12 * s, c.pt.y - 4 * s, '#0891b2', s)
  }

  // Magnifier for precise clicking.
  if (o.loupe && o.pointer && o.frame) {
    const R = 70 * s
    const zoom = 3
    const src = R / zoom
    const cx = o.pointer.x + (o.pointer.x + R * 2.4 > o.width ? -R * 1.4 : R * 1.4)
    const cy = Math.max(R + 4, Math.min(o.height - R - 4, o.pointer.y - R * 1.2))
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(o.frame, o.pointer.x - src, o.pointer.y - src, src * 2, src * 2, cx - R, cy - R, R * 2, R * 2)
    ctx.restore()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 1 * s
    ctx.beginPath()
    ctx.moveTo(cx - 12 * s, cy)
    ctx.lineTo(cx + 12 * s, cy)
    ctx.moveTo(cx, cy - 12 * s)
    ctx.lineTo(cx, cy + 12 * s)
    ctx.stroke()
  }
  ctx.restore()
}
