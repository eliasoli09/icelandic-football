/**
 * Browser-only object detector (people + ball) on MediaPipe's EfficientDet-Lite2
 * (COCO classes). Runs fully on the user's device: the video never leaves the
 * browser.
 *
 * Broadcast players are ~40–80 px tall and the ball ~6–12 px, which vanish when
 * a whole frame is squeezed into the model's 448×448 input. So we also run the
 * model on overlapping tiles and merge the results.
 */

import type { Box } from './tracking'

// Served from /public by scripts/copy-mediapipe.mjs (runs on npm install).
const WASM_BASE = '/mediapipe'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/latest/efficientdet_lite2.tflite'

export interface Detections {
  persons: Box[]
  balls: Box[]
}

type MpDetector = import('@mediapipe/tasks-vision').ObjectDetector

let loading: Promise<MpDetector> | null = null

export function loadDetector(): Promise<MpDetector> {
  loading ??= (async () => {
    const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'IMAGE' as const,
      scoreThreshold: 0.12,
      maxResults: 60,
      categoryAllowlist: ['person', 'sports ball'],
    })
    try {
      return await ObjectDetector.createFromOptions(fileset, options('GPU'))
    } catch {
      return await ObjectDetector.createFromOptions(fileset, options('CPU'))
    }
  })().catch((e) => {
    loading = null
    throw e
  })
  return loading
}

const iou = (a: Box, b: Box) => {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  return inter / (a.w * a.h + b.w * b.h - inter || 1)
}

/** Share of the smaller box covered by the intersection — catches a crop inside a full box. */
const containment = (a: Box, b: Box) => {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  return inter / Math.min(a.w * a.h, b.w * b.h || 1)
}

function nms(boxes: Box[], thr = 0.45): Box[] {
  const out: Box[] = []
  for (const b of [...boxes].sort((p, q) => q.score - p.score)) {
    if (out.every((o) => iou(o, b) < thr && containment(o, b) < 0.75)) out.push(b)
  }
  return out
}

let scratch: HTMLCanvasElement | null = null

/**
 * Detect on the full frame plus a cols×rows grid of overlapping tiles.
 * Detections cut by an interior tile edge are dropped (the neighbouring,
 * overlapping tile sees them whole).
 */
export async function detect(frame: HTMLCanvasElement, grid: [number, number] = [2, 2], fullFrame = true): Promise<Detections> {
  const det = await loadDetector()
  const W = frame.width
  const H = frame.height
  const persons: Box[] = []
  const balls: Box[] = []

  const run = (src: HTMLCanvasElement, ox: number, oy: number, edges: { l: boolean; r: boolean; t: boolean; b: boolean }) => {
    const res = det.detect(src)
    for (const d of res.detections) {
      const bb = d.boundingBox
      const cat = d.categories[0]
      if (!bb || !cat) continue
      const e = 2
      if ((edges.l && bb.originX <= e) || (edges.t && bb.originY <= e) || (edges.r && bb.originX + bb.width >= src.width - e) || (edges.b && bb.originY + bb.height >= src.height - e)) continue
      const box: Box = { x: bb.originX + ox, y: bb.originY + oy, w: bb.width, h: bb.height, score: cat.score }
      if (cat.categoryName === 'person' && cat.score >= 0.25) persons.push(box)
      else if (cat.categoryName === 'sports ball') balls.push(box)
    }
  }

  if (fullFrame) run(frame, 0, 0, { l: false, r: false, t: false, b: false })
  const [cols, rows] = grid
  if (cols * rows > 1) {
    scratch ??= document.createElement('canvas')
    const ov = 0.2
    const tw = Math.ceil(W / (cols - (cols - 1) * ov))
    const th = Math.ceil(H / (rows - (rows - 1) * ov))
    scratch.width = tw
    scratch.height = th
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ox = Math.min(W - tw, Math.round(c * tw * (1 - ov)))
        const oy = Math.min(H - th, Math.round(r * th * (1 - ov)))
        ctx.clearRect(0, 0, tw, th)
        ctx.drawImage(frame, ox, oy, tw, th, 0, 0, tw, th)
        run(scratch, ox, oy, { l: c > 0, r: c < cols - 1, t: r > 0, b: r < rows - 1 })
      }
  }

  // Sanity filters: a ball is small and roughly square.
  const plausibleBall = (b: Box) => b.w < W * 0.05 && b.h < H * 0.08 && b.w / b.h > 0.5 && b.w / b.h < 2
  return { persons: nms(persons), balls: nms(balls.filter(plausibleBall), 0.3) }
}

/** Seek a video and resolve once the requested frame is decoded. */
export function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(t, (video.duration || t) - 1e-3))
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) return resolve()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
      if (v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(() => finish())
        setTimeout(finish, 250)
      } else finish()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = target
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      finish()
    }, 4000)
  })
}

export function grabFrame(video: HTMLVideoElement, into?: HTMLCanvasElement): HTMLCanvasElement {
  const c = into ?? document.createElement('canvas')
  c.width = video.videoWidth
  c.height = video.videoHeight
  c.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0)
  return c
}
