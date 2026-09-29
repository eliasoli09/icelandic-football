'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apply, computeHomography, invert, rmsError, spansArea, type Mat3, type Pt } from '@/lib/offside/homography'
import { DEFAULT_PITCH, IFAB, templatePoints, type PitchDims, type TemplateId } from '@/lib/offside/pitch'
import { evaluateOffside, fmtM, type PitchPlayer, type Role } from '@/lib/offside/offside'
import {
  cleanBallTrack, detectBallEvents, findReceiver, foot, nearestPlayer, trackPersons,
  type BallEvent, type BallPoint, type Box, type Frame,
} from '@/lib/offside/tracking'
import { clusterTeams, labToCss, shirtColour } from '@/lib/offside/teams'
import { drawOverlay, ROLE_COLOUR, STATUS_COLOUR, type Player } from './draw'
import { PitchMap } from './PitchMap'

type Mode = 'select' | 'calibrate' | 'add-attacker' | 'add-defender' | 'ball' | 'receiver'

interface Kick {
  t: number
  source: 'ai' | 'manual'
  confidence?: number
  /** Image points at the kick frame, from the scan, used to seed the analysis. */
  kickerHint?: Pt
  receiverHint?: Pt
  ballHint?: Pt
}

interface Scan {
  frames: Frame[]
  ball: (BallPoint | null)[]
  tracks: number[][]
  events: BallEvent[]
  width: number
}

type Busy = { kind: 'model' | 'scan' | 'refine' | 'analyse'; progress: number; text: string } | null

const STEP_FPS = [25, 30, 50, 60]
const SCAN_FPS = 10

const fmtT = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

const tick = () => new Promise((r) => setTimeout(r, 0))

export function OffsideTool() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLCanvasElement | null>(null)
  const abortRef = useRef(false)
  const detectorRef = useRef<typeof import('@/lib/offside/detector') | null>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [stepFps, setStepFps] = useState(25)
  const [view, setView] = useState<'video' | 'frame'>('video')
  const [frameVersion, setFrameVersion] = useState(0)

  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [scanBoxes, setScanBoxes] = useState<{ persons: Box[]; balls: Box[] } | null>(null)
  const [kick, setKick] = useState<Kick | null>(null)

  const [template, setTemplate] = useState<TemplateId>('box')
  const [goalSide, setGoalSide] = useState<'left' | 'right'>('right')
  const [dims, setDims] = useState<PitchDims>(DEFAULT_PITCH)
  const [clicks, setClicks] = useState<Record<string, Pt | null>>({})
  const [calibIdx, setCalibIdx] = useState(0)
  const [calibT, setCalibT] = useState<number | null>(null)
  const [showLines, setShowLines] = useState(true)

  const [players, setPlayers] = useState<Player[]>([])
  const [ball, setBall] = useState<Pt | null>(null)
  const [ballEstimated, setBallEstimated] = useState(false)
  const [receiverId, setReceiverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('select')
  const [tolerance, setTolerance] = useState(0.3)
  const [pointer, setPointer] = useState<Pt | null>(null)
  const dragRef = useRef<{ kind: 'player' | 'ball' | 'calib'; id: string } | null>(null)
  const nextId = useRef(0)

  // ---- calibration ---------------------------------------------------------
  const tpl = useMemo(() => templatePoints(template, dims), [template, dims])
  const pairs = useMemo(() => tpl.filter((p) => clicks[p.key]).map((p) => ({ img: clicks[p.key]!, pitch: p.pitch })), [tpl, clicks])
  const H: Mat3 | null = useMemo(() => {
    if (pairs.length < 4 || !spansArea(pairs.map((p) => p.pitch))) return null
    return computeHomography(pairs.map((p) => p.img), pairs.map((p) => p.pitch))
  }, [pairs])
  const Hinv = useMemo(() => (H ? invert(H) : null), [H])
  const calibError = useMemo(() => (H && pairs.length > 4 ? rmsError(H, pairs.map((p) => p.img), pairs.map((p) => p.pitch)) : null), [H, pairs])

  const toPitch = useCallback((p: Pt) => {
    if (!H) return null
    const q = apply(H, p)
    return q ? { u: q.x, v: q.y } : null
  }, [H])

  // ---- labels & offside ----------------------------------------------------
  const labels = useMemo(() => {
    const m = new Map<string, string>()
    let a = 0
    let d = 0
    for (const p of players) {
      if (p.role === 'attacker') m.set(p.id, `S${++a}`)
      else if (p.role === 'defender') m.set(p.id, `V${++d}`)
      else if (p.role === 'keeper') m.set(p.id, 'M')
    }
    return m
  }, [players])

  const pitchPlayers: PitchPlayer[] = useMemo(() => {
    if (!H) return []
    return players.flatMap((p) => {
      const q = toPitch(p.foot)
      return q && Math.abs(q.u) < 200 && Math.abs(q.v) < 200 ? [{ id: p.id, role: p.role, u: q.u, v: q.v }] : []
    })
  }, [players, H, toPitch])

  const ballPitch = useMemo(() => (ball ? toPitch(ball) : null), [ball, toPitch])

  const result = useMemo(() => {
    if (!H) return null
    return evaluateOffside({ players: pitchPlayers, ballU: ballPitch?.u ?? null, halfwayU: dims.length / 2, tolerance })
  }, [H, pitchPlayers, ballPitch, dims.length, tolerance])

  const receiverVerdict = result?.verdicts.find((v) => v.id === receiverId) ?? null
  const receiverU = pitchPlayers.find((p) => p.id === receiverId)?.u ?? null

  /** Metres per image pixel at the receiver's feet — a floor on the precision. */
  const resolution = useMemo(() => {
    const rec = players.find((p) => p.id === receiverId)
    if (!H || !rec) return null
    const a = apply(H, rec.foot)
    const bx = apply(H, { x: rec.foot.x + 1, y: rec.foot.y })
    const by = apply(H, { x: rec.foot.x, y: rec.foot.y + 1 })
    if (!a || !bx || !by) return null
    return Math.max(Math.abs(bx.x - a.x), Math.abs(by.x - a.x))
  }, [H, players, receiverId])

  // ---- drawing -------------------------------------------------------------
  const redraw = useCallback(() => {
    const cv = canvasRef.current
    const fr = frameRef.current
    if (!cv || !fr) return
    if (cv.width !== fr.width || cv.height !== fr.height) {
      cv.width = fr.width
      cv.height = fr.height
    }
    const rect = cv.getBoundingClientRect()
    const s = rect.width ? cv.width / rect.width : 1
    const calibrating = mode === 'calibrate'
    drawOverlay(cv.getContext('2d')!, {
      frame: fr,
      width: fr.width,
      height: fr.height,
      Hinv,
      dims,
      showLines: showLines || calibrating,
      calib: calibrating
        ? tpl.flatMap((p, i) => (clicks[p.key] ? [{ key: p.key, n: i + 1, pt: clicks[p.key]!, active: i === calibIdx }] : []))
        : [],
      players: scanBoxes ? [] : players,
      labels,
      selectedId,
      receiverId,
      ball: scanBoxes ? null : ball,
      result: scanBoxes ? null : result,
      receiverU,
      receiverStatus: receiverVerdict?.status ?? null,
      scanBoxes,
      pointer,
      loupe: !!pointer && (calibrating || mode === 'add-attacker' || mode === 'add-defender' || mode === 'ball' || !!dragRef.current),
    }, s)
  }, [Hinv, dims, showLines, mode, tpl, clicks, calibIdx, players, labels, selectedId, receiverId, ball, result, receiverU, receiverVerdict, scanBoxes, pointer])

  useEffect(() => {
    if (view === 'frame') redraw()
  }, [view, redraw, frameVersion])

  useEffect(() => {
    const onResize = () => view === 'frame' && redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [view, redraw])

  // ---- video ---------------------------------------------------------------
  const onFile = (f: File | undefined) => {
    if (!f) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(f))
    setFileName(f.name)
    setScan(null)
    setKick(null)
    setPlayers([])
    setBall(null)
    setReceiverId(null)
    setClicks({})
    setCalibIdx(0)
    setCalibT(null)
    setView('video')
    setError(null)
    frameRef.current = null
  }

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  const getDetector = async () => {
    if (!detectorRef.current) detectorRef.current = await import('@/lib/offside/detector')
    const d = detectorRef.current
    setBusy({ kind: 'model', progress: 0, text: 'Hleð inn gervigreindarlíkani (~35 MB, aðeins í fyrsta skipti)…' })
    try {
      await d.loadDetector()
    } catch (e) {
      throw new Error(
        `gat ekki hlaðið gervigreindarlíkaninu (${(e as Error).message}). Athugaðu nettenginguna — ` +
          'þú getur samt merkt sparkið, kvarðað og bætt leikmönnum við handvirkt.',
      )
    }
    return d
  }

  const step = (frames: number) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + frames / stepFps))
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  // ---- key-frame analysis --------------------------------------------------
  /** Detect players at the kick frame, split teams by shirt colour, seed roles. */
  const analyseFrame = async (k: Kick) => {
    const fr = frameRef.current
    if (!fr) return
    try {
      const d = await getDetector()
      setBusy({ kind: 'analyse', progress: 0.5, text: 'Finn leikmenn og bolta á sparkramma…' })
      await tick()
      const det = await d.detect(fr, [3, 2], true)
      const ctx = fr.getContext('2d', { willReadFrequently: true })!
      const colours = det.persons.map((b) => {
        const x = Math.max(0, Math.floor(b.x))
        const y = Math.max(0, Math.floor(b.y))
        const w = Math.max(1, Math.min(fr.width - x, Math.ceil(b.w)))
        const h = Math.max(1, Math.min(fr.height - y, Math.ceil(b.h)))
        return shirtColour(ctx.getImageData(x, y, w, h).data, w, h)
      })
      const cl = clusterTeams(colours)

      // Ball: nearest detection to the hint, else the one closest to someone's feet.
      let ballBox: Box | null = null
      if (det.balls.length) {
        const hint = k.ballHint ?? k.kickerHint
        ballBox = [...det.balls].sort((a, b) => {
          const da = hint ? Math.hypot(a.x - hint.x, a.y - hint.y) : nearestPlayer(det.persons, foot(a)).d
          const db = hint ? Math.hypot(b.x - hint.x, b.y - hint.y) : nearestPlayer(det.persons, foot(b)).d
          return da - db
        })[0]
      }
      const ballPt = ballBox ? foot(ballBox) : null

      // Kicker → attacking team.
      const kickRef = k.kickerHint ?? ballPt
      const kicker = kickRef ? nearestPlayer(det.persons, kickRef).index : -1
      const attackLabel = cl && kicker >= 0 && cl.labels[kicker] >= 0 ? cl.labels[kicker] : 0

      const ps: Player[] = det.persons.map((b, i) => {
        const label = cl ? cl.labels[i] : -1
        return {
          id: `p${nextId.current++}`,
          box: b,
          foot: foot(b),
          role: label < 0 ? 'ignore' : label === attackLabel ? 'attacker' : 'defender',
          shirt: colours[i] ? labToCss(colours[i]!) : undefined,
          outlier: label < 0,
        }
      })

      let rec: string | null = null
      if (k.receiverHint) {
        const idx = nearestPlayer(ps.map((p) => p.box!), k.receiverHint).index
        if (idx >= 0 && idx !== kicker) {
          rec = ps[idx].id
          ps[idx].role = 'attacker'
        }
      }
      setPlayers(ps)
      setReceiverId(rec)
      setBall(ballPt ?? (kicker >= 0 ? foot(det.persons[kicker]) : null))
      setBallEstimated(!ballPt)
      setSelectedId(null)
      if (!H) setMode('calibrate')
    } catch (e) {
      setError(`Greining mistókst: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  /** Once calibrated, an off-colour player deepest near the goal is probably the keeper. */
  useEffect(() => {
    if (!H) return
    setPlayers((ps) => {
      if (ps.some((p) => p.role === 'keeper')) return ps
      const cands = ps
        .map((p) => ({ p, q: toPitch(p.foot) }))
        .filter((x) => x.q && x.p.outlier && x.p.role === 'ignore' && x.q.u >= -1 && x.q.u < 8 && Math.abs(x.q.v) < 22)
        .sort((a, b) => a.q!.u - b.q!.u)
      if (!cands.length) return ps
      const deepestDef = Math.min(...ps.filter((p) => p.role === 'defender').map((p) => toPitch(p.foot)?.u ?? Infinity))
      if (cands[0].q!.u > deepestDef) return ps
      return ps.map((p) => (p.id === cands[0].p.id ? { ...p, role: 'keeper' as Role } : p))
    })
  }, [H, toPitch])

  const openKick = async (k: Kick) => {
    const v = videoRef.current
    if (!v) return
    detectorRef.current ??= await import('@/lib/offside/detector')
    const d = detectorRef.current
    v.pause()
    await d.seek(v, k.t)
    frameRef.current = d.grabFrame(v, frameRef.current ?? undefined)
    setFrameVersion((x) => x + 1)
    setKick(k)
    setScanBoxes(null)
    setView('frame')
    await analyseFrame(k)
  }

  /** Manual kick: the user says "the ball is played now". Seeds hints from the scan if we have one. */
  const markKickHere = async () => {
    const v = videoRef.current
    if (!v) return
    const t = v.currentTime
    const k: Kick = { t, source: 'manual' }
    if (scan && scan.frames.length) {
      let fi = 0
      scan.frames.forEach((f, i) => {
        if (Math.abs(f.t - t) < Math.abs(scan.frames[fi].t - t)) fi = i
      })
      if (Math.abs(scan.frames[fi].t - t) < 0.2) {
        const f = scan.frames[fi]
        const b = scan.ball[fi]
        const near = b ? nearestPlayer(f.persons, b) : { index: -1, d: Infinity }
        if (near.index >= 0) {
          const ev: BallEvent = { index: fi, t: f.t, ball: b!, type: 'kick', dv: 0, playerIndex: near.index, proximity: near.d, confidence: 0 }
          const rec = findReceiver(scan.frames, scan.ball, scan.tracks, scan.events, ev)
          k.kickerHint = foot(f.persons[near.index])
          k.ballHint = b ?? undefined
          if (rec) k.receiverHint = foot(f.persons[rec.personIndexAtKick])
        }
      }
    }
    await openKick(k)
  }

  // ---- AI scan -------------------------------------------------------------
  const runScan = async (whole: boolean) => {
    const v = videoRef.current
    if (!v || !duration) return
    setError(null)
    abortRef.current = false
    v.pause()
    const t0 = whole ? 0 : Math.max(0, v.currentTime - 3)
    const t1 = whole ? Math.min(duration, 90) : Math.min(duration, v.currentTime + 3)
    try {
      const d = await getDetector()
      const frames: Frame[] = []
      const canvas = document.createElement('canvas')
      frameRef.current = canvas
      setView('frame')
      const n = Math.max(2, Math.floor((t1 - t0) * SCAN_FPS))
      for (let i = 0; i <= n; i++) {
        if (abortRef.current) throw new Error('Hætt við')
        const t = t0 + ((t1 - t0) * i) / n
        await d.seek(v, t)
        d.grabFrame(v, canvas)
        const det = await d.detect(canvas, [2, 2], true)
        frames.push({ t, ...det })
        setScanBoxes(det)
        setFrameVersion((x) => x + 1)
        setBusy({ kind: 'scan', progress: i / n, text: `Gervigreind skannar myndbandið — ${fmtT(t)} (${frames.length}/${n + 1} rammar)` })
        await tick()
      }
      const W = v.videoWidth
      const ballTrack = cleanBallTrack(frames, W)
      const tracks = trackPersons(frames)
      const events = detectBallEvents(frames, ballTrack, W)
      setScan({ frames, ball: ballTrack, tracks, events, width: W })
      const kicks = events.filter((e) => e.type === 'kick').sort((a, b) => b.confidence - a.confidence)
      const best = kicks[0]
      if (!best || best.confidence < 0.15) {
        setScanBoxes(null)
        setView('video')
        setError(
          `Gervigreindin fann ekki skýrt spark (bolti fannst í ${ballTrack.filter((b) => b?.detected).length} af ${frames.length} römmum). ` +
            'Finndu augnablikið sjálf(ur) og ýttu á „Merkja spark hér“.',
        )
        return
      }

      // Refine to single-frame precision around the coarse kick.
      const kicker = frames[best.index].persons[best.playerIndex]
      const fine: Frame[] = []
      const span = 1.5 / SCAN_FPS
      const nf = Math.round(2 * span * stepFps)
      for (let i = 0; i <= nf; i++) {
        if (abortRef.current) throw new Error('Hætt við')
        const t = Math.max(0, best.t - span + i / stepFps)
        await d.seek(v, t)
        d.grabFrame(v, canvas)
        const det = await d.detect(canvas, [3, 2], true)
        fine.push({ t, ...det })
        setScanBoxes(det)
        setFrameVersion((x) => x + 1)
        setBusy({ kind: 'refine', progress: i / nf, text: `Fínstilli sparkaugnablikið ramma fyrir ramma (${i + 1}/${nf + 1})` })
        await tick()
      }
      const fineBall = cleanBallTrack(fine, W)
      const fineKick = detectBallEvents(fine, fineBall, W, { window: 2, minDv: 0.08 })
        .filter((e) => e.type === 'kick' && Math.hypot(e.ball.x - foot(kicker).x, e.ball.y - foot(kicker).y) < kicker.h * 2)
        .sort((a, b) => b.dv * b.confidence - a.dv * a.confidence)[0]
      const kickT = fineKick?.t ?? best.t

      const rec = findReceiver(frames, ballTrack, tracks, events, best)
      const hintFrame = fineKick ? fine[fineKick.index] : frames[best.index]
      const kickerNow = fineKick && fineKick.playerIndex >= 0 ? hintFrame.persons[fineKick.playerIndex] : kicker
      await openKick({
        t: kickT,
        source: 'ai',
        confidence: best.confidence,
        kickerHint: foot(kickerNow),
        ballHint: fineKick?.ball ?? best.ball,
        receiverHint: rec ? foot(frames[best.index].persons[rec.personIndexAtKick]) : undefined,
      })
    } catch (e) {
      setError((e as Error).message === 'Hætt við' ? 'Hætt við skönnun.' : `Skönnun mistókst: ${(e as Error).message}`)
      setScanBoxes(null)
      setView('video')
    } finally {
      setBusy(null)
    }
  }

  // ---- canvas interaction --------------------------------------------------
  const toImage = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }
  }
  const pxScale = () => {
    const cv = canvasRef.current!
    return cv.width / cv.getBoundingClientRect().width
  }

  const hitTest = (p: Pt) => {
    const tol = 12 * pxScale()
    if (mode === 'calibrate') {
      for (const c of tpl) {
        const q = clicks[c.key]
        if (q && Math.hypot(q.x - p.x, q.y - p.y) < tol) return { kind: 'calib' as const, id: c.key }
      }
      return null
    }
    if (ball && Math.hypot(ball.x - p.x, ball.y - p.y) < tol) return { kind: 'ball' as const, id: 'ball' }
    for (const pl of players) if (Math.hypot(pl.foot.x - p.x, pl.foot.y - p.y) < tol) return { kind: 'player' as const, id: pl.id }
    return null
  }

  const playerAt = (p: Pt) =>
    players.find((pl) => pl.box && p.x >= pl.box.x && p.x <= pl.box.x + pl.box.w && p.y >= pl.box.y && p.y <= pl.box.y + pl.box.h) ??
    players.find((pl) => Math.hypot(pl.foot.x - p.x, pl.foot.y - p.y) < 14 * pxScale())

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || !frameRef.current) return
    const p = toImage(e)
    const hit = hitTest(p)
    if (hit && (mode === 'select' || mode === 'calibrate')) {
      dragRef.current = hit
      e.currentTarget.setPointerCapture(e.pointerId)
      if (hit.kind === 'player') setSelectedId(hit.id)
      if (hit.kind === 'calib') setCalibIdx(tpl.findIndex((c) => c.key === hit.id))
      return
    }
    if (mode === 'calibrate') {
      const key = tpl[calibIdx]?.key
      if (!key) return
      setClicks((c) => ({ ...c, [key]: p }))
      setCalibT(kick?.t ?? null)
      const nextFree = tpl.findIndex((c, i) => i > calibIdx && !clicks[c.key])
      setCalibIdx(nextFree >= 0 ? nextFree : Math.min(calibIdx + 1, tpl.length))
    } else if (mode === 'add-attacker' || mode === 'add-defender') {
      const id = `p${nextId.current++}`
      setPlayers((ps) => [...ps, { id, box: null, foot: p, role: mode === 'add-attacker' ? 'attacker' : 'defender' }])
      setSelectedId(id)
      setMode('select')
    } else if (mode === 'ball') {
      setBall(p)
      setBallEstimated(false)
      setMode('select')
    } else if (mode === 'receiver') {
      const pl = playerAt(p)
      if (pl) {
        setReceiverId(pl.id)
        setPlayers((ps) => ps.map((x) => (x.id === pl.id ? { ...x, role: 'attacker' } : x)))
        setMode('select')
      }
    } else {
      setSelectedId(playerAt(p)?.id ?? null)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toImage(e)
    setPointer(p)
    const d = dragRef.current
    if (!d) return
    if (d.kind === 'player') setPlayers((ps) => ps.map((x) => (x.id === d.id ? { ...x, foot: p } : x)))
    else if (d.kind === 'ball') {
      setBall(p)
      setBallEstimated(false)
    } else setClicks((c) => ({ ...c, [d.id]: p }))
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || !videoUrl || busy) return
      if (view === 'video') {
        if (e.key === 'ArrowRight') step(e.shiftKey ? 10 : 1)
        else if (e.key === 'ArrowLeft') step(e.shiftKey ? -10 : -1)
        else if (e.key === ' ') togglePlay()
        else if (e.key.toLowerCase() === 'k') void markKickHere()
        else return
        e.preventDefault()
      } else if (e.key === 'Escape') setMode('select')
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setPlayers((ps) => ps.filter((p) => p.id !== selectedId))
        if (receiverId === selectedId) setReceiverId(null)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- export --------------------------------------------------------------
  const exportPng = () => {
    const cv = canvasRef.current
    const fr = frameRef.current
    if (!cv || !fr) return
    const out = document.createElement('canvas')
    const bar = Math.round(fr.height * 0.09)
    out.width = fr.width
    out.height = fr.height + bar
    const ctx = out.getContext('2d')!
    ctx.drawImage(cv, 0, 0)
    ctx.fillStyle = '#0c1220'
    ctx.fillRect(0, fr.height, fr.width, bar)
    const st = receiverVerdict?.status
    ctx.fillStyle = st ? STATUS_COLOUR[st] : '#fff'
    ctx.font = `700 ${Math.round(bar * 0.42)}px system-ui, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(st ? STATUS_TEXT[st] : 'Rangstöðugreining', bar * 0.4, fr.height + bar / 2)
    ctx.fillStyle = '#8b96ab'
    ctx.font = `400 ${Math.round(bar * 0.28)}px system-ui, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`${receiverVerdict?.reason ?? ''}  ·  ${fmtT(kick?.t ?? 0)}  ·  Besta spáin`, fr.width - bar * 0.4, fr.height + bar / 2)
    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `rangstada-${fileName.replace(/\.[^.]+$/, '') || 'greining'}-${(kick?.t ?? 0).toFixed(2)}s.png`
    a.click()
  }

  // ---- render --------------------------------------------------------------
  const selected = players.find((p) => p.id === selectedId) ?? null
  const setRole = (id: string, role: Role) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, role } : p)))
  const swapTeams = () =>
    setPlayers((ps) => ps.map((p) => ({ ...p, role: p.role === 'attacker' ? 'defender' : p.role === 'defender' ? 'attacker' : p.role })))
  const teamSwatch = (role: Role) => players.find((p) => p.role === role && p.shirt)?.shirt
  const calibCount = pairs.length
  const staleCalib = H && kick && calibT !== null && Math.abs(calibT - kick.t) > 0.2

  return (
    <div className="grid gap-5">
      {/* Stage */}
      <div className="card overflow-hidden">
        {!videoUrl ? (
          <label
            className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files[0])
            }}
          >
            <span className="text-4xl">🎥</span>
            <span className="font-semibold">Veldu myndband eða dragðu það hingað</span>
            <span className="text-sm muted max-w-md">
              MP4/WebM úr niðurhalsmöppunni. Myndbandið er greint í vafranum þínum — því er aldrei hlaðið upp á netþjón.
            </span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Velja skrá
            </span>
          </label>
        ) : (
          <>
            <div className="relative bg-black">
              <video
                ref={videoRef}
                src={videoUrl}
                className={view === 'video' ? 'w-full max-h-[70vh] block mx-auto' : 'hidden'}
                playsInline
                muted
                preload="auto"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onSeeked={(e) => setTime(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onError={() => setError('Vafrinn getur ekki spilað þetta myndband. Prófaðu MP4 (H.264) eða WebM.')}
              />
              <canvas
                ref={canvasRef}
                className={view === 'frame' ? 'w-full block touch-none' : 'hidden'}
                style={{ cursor: mode === 'select' ? 'default' : 'crosshair' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => setPointer(null)}
              />
              {busy && (
                <div className="absolute inset-x-0 bottom-0 p-3 text-sm text-white" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span>{busy.text}</span>
                    {(busy.kind === 'scan' || busy.kind === 'refine') && (
                      <button className="px-2 py-1 rounded border border-white/40 text-xs" onClick={() => (abortRef.current = true)}>
                        Hætta við
                      </button>
                    )}
                  </div>
                  <div className="h-1.5 rounded bg-white/20 overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.round(busy.progress * 100)}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Transport */}
            <div className="p-3 grid gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {view === 'video' ? (
                <>
                  <Timeline duration={duration} time={time} kick={kick} scan={scan} onSeek={(t) => videoRef.current && (videoRef.current.currentTime = t)} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Btn onClick={() => step(-1)} title="Einn rammi aftur (←)">◀︎ 1</Btn>
                    <Btn onClick={togglePlay} title="Spila / stöðva (bil)">{playing ? '❚❚' : '▶︎'}</Btn>
                    <Btn onClick={() => step(1)} title="Einn rammi áfram (→)">1 ▶︎</Btn>
                    <span className="num muted px-1">{fmtT(time)} / {fmtT(duration)}</span>
                    <select className="rounded-lg border px-2 py-1.5 bg-transparent" style={{ borderColor: 'var(--border)' }} value={stepFps} onChange={(e) => setStepFps(+e.target.value)} title="Rammatíðni fyrir rammaskref">
                      {STEP_FPS.map((f) => <option key={f} value={f}>{f} rammar/s</option>)}
                    </select>
                    <span className="flex-1" />
                    <Btn primary onClick={markKickHere} disabled={!!busy} title="Merkja augnablikið sem boltinn er spilaður (K)">⚽ Merkja spark hér</Btn>
                    {kick && <Btn onClick={() => openKick(kick)} disabled={!!busy}>Fara í sparkramma</Btn>}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Btn onClick={() => { setView('video'); setMode('select') }} disabled={!!busy}>← Myndband</Btn>
                  {kick && (
                    <span className="muted">
                      Sparkrammi <b className="num" style={{ color: 'var(--text)' }}>{fmtT(kick.t)}</b> ·{' '}
                      {kick.source === 'ai' ? `fundinn af gervigreind (${Math.round((kick.confidence ?? 0) * 100)}% öryggi)` : 'merktur handvirkt'}
                    </span>
                  )}
                  <span className="flex-1" />
                  {kick && !busy && (
                    <>
                      <Btn onClick={() => openKick({ ...kick, t: Math.max(0, kick.t - 1 / stepFps), source: 'manual' })} title="Sparkið var einum ramma fyrr">◀︎ Rammi</Btn>
                      <Btn onClick={() => openKick({ ...kick, t: kick.t + 1 / stepFps, source: 'manual' })} title="Sparkið var einum ramma síðar">Rammi ▶︎</Btn>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="card p-3 text-sm" style={{ borderColor: 'var(--loss)' }}>
          {error}
        </div>
      )}

      {videoUrl && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-5 content-start">
            {/* 1. Kick */}
            <Section n={1} title="Finna sparkið" done={!!kick}>
              <p className="text-sm muted mb-3">
                Gervigreindin fylgir boltanum og leitar að augnablikinu þegar hraði hans breytist skyndilega við fætur leikmanns — og
                fínstillir svo ramma fyrir ramma. Sjáist boltinn illa, eða hitti hún ekki á rétta augnablikið, finndu rammann sjálf(ur)
                og ýttu á <b>Merkja spark hér</b>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Btn primary onClick={() => runScan(false)} disabled={!!busy || !duration}>🤖 Greina ±3 s í kringum núverandi stað</Btn>
                <Btn onClick={() => runScan(true)} disabled={!!busy || !duration}>Greina allt {duration > 90 ? '(fyrstu 90 s)' : 'myndbandið'}</Btn>
              </div>
              {scan && (
                <div className="mt-3 text-sm">
                  <p className="muted mb-2">
                    Bolti fannst í {scan.ball.filter((b) => b?.detected).length} af {scan.frames.length} römmum.{' '}
                    {scan.events.filter((e) => e.type === 'kick').length} möguleg spörk:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scan.events
                      .filter((e) => e.type === 'kick')
                      .sort((a, b) => a.t - b.t)
                      .map((e) => (
                        <button
                          key={e.index}
                          className="px-2.5 py-1 rounded-lg border num text-xs"
                          style={{ borderColor: kick && Math.abs(kick.t - e.t) < 0.15 ? 'var(--accent)' : 'var(--border)' }}
                          onClick={() => {
                            const rec = findReceiver(scan.frames, scan.ball, scan.tracks, scan.events, e)
                            const f = scan.frames[e.index]
                            void openKick({
                              t: e.t,
                              source: 'ai',
                              confidence: e.confidence,
                              kickerHint: foot(f.persons[e.playerIndex]),
                              ballHint: e.ball,
                              receiverHint: rec ? foot(f.persons[rec.personIndexAtKick]) : undefined,
                            })
                          }}
                        >
                          {fmtT(e.t)} · {Math.round(e.confidence * 100)}%
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </Section>

            {/* 2. Calibration */}
            <Section n={2} title="Kvarða völlinn" done={!!H}>
              <p className="text-sm muted mb-3">
                Stærð valla er mismunandi, en merkingar innan þeirra eru staðlaðar (IFAB): vítateigur er alltaf 40,32 × 16,5 m. Smelltu á
                að minnsta kosti 4 punkta sem sjást á sparkrammanum — kerfið reiknar út frá þeim hvar hver pixill liggur á vellinum í metrum.
              </p>
              <div className="flex flex-wrap gap-2 mb-3 text-sm">
                <Seg value={template} onChange={(v) => { setTemplate(v); setClicks({}); setCalibIdx(0) }} options={[['box', 'Vítateigur'], ['halfway', 'Miðja']]} />
                <Seg value={goalSide} onChange={setGoalSide} options={[['left', 'Mark til vinstri'], ['right', 'Mark til hægri']]} />
                <Btn primary={mode !== 'calibrate'} onClick={() => setMode(mode === 'calibrate' ? 'select' : 'calibrate')} disabled={view !== 'frame'}>
                  {mode === 'calibrate' ? 'Ljúka kvörðun' : H ? 'Breyta kvörðun' : 'Hefja kvörðun'}
                </Btn>
              </div>
              {template === 'halfway' && (
                <p className="text-xs muted mb-3">Miðjukvörðun: veldu í hvora áttina sóknin er. Notaðu hana þegar vítateigurinn sést ekki.</p>
              )}
              <div className="grid sm:grid-cols-[200px_1fr] gap-4 items-start">
                <CalibDiagram template={template} side={goalSide} dims={dims} active={mode === 'calibrate' ? tpl[calibIdx]?.key : undefined} done={new Set(Object.keys(clicks).filter((k) => clicks[k]))} />
                <div className="text-sm">
                  {mode === 'calibrate' && tpl[calibIdx] ? (
                    <div className="mb-2">
                      <p className="font-semibold">
                        Punktur {calibIdx + 1}/{tpl.length}: {tpl[calibIdx].label}
                      </p>
                      <p className="muted text-xs mb-2">{tpl[calibIdx].hint}</p>
                      <div className="flex gap-2">
                        <Btn onClick={() => setCalibIdx((i) => Math.min(i + 1, tpl.length))}>Sést ekki — sleppa</Btn>
                        <Btn onClick={() => setCalibIdx((i) => Math.max(0, i - 1))}>Til baka</Btn>
                        <Btn onClick={() => { setClicks({}); setCalibIdx(0) }}>Hreinsa</Btn>
                      </div>
                    </div>
                  ) : mode === 'calibrate' ? (
                    <p className="mb-2">Allir punktar farnir í gegn. Dragðu krossana til að fínstilla, eða ýttu á „Ljúka kvörðun“.</p>
                  ) : null}
                  <p className={H ? '' : 'muted'}>
                    {calibCount} punktar merktir.{' '}
                    {H ? '✓ Völlurinn er kvarðaður — athugaðu að bláu línurnar falli á vallarlínurnar.' : calibCount >= 4 ? 'Punktarnir liggja of nálægt einni línu — bættu við punkti utan línunnar.' : `Vantar ${4 - calibCount} í viðbót.`}
                  </p>
                  {calibError !== null && (
                    <p className="text-xs mt-1" style={{ color: calibError > 0.5 ? 'var(--loss)' : 'var(--text-2)' }}>
                      Meðalskekkja punkta: {fmtM(calibError)}{calibError > 0.5 ? ' — einhver punktur er líklega rangt settur.' : ''}
                    </p>
                  )}
                  {staleCalib && <p className="text-xs mt-1" style={{ color: 'var(--loss)' }}>Kvörðunin var gerð á öðrum ramma — ef myndavélin hreyfðist þarf að kvarða aftur.</p>}
                  <label className="flex items-center gap-2 mt-2 text-xs muted">
                    <input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} /> Sýna vallarlínur
                  </label>
                  <div className="flex gap-3 mt-2 text-xs muted items-center">
                    Vallarstærð:
                    <NumIn value={dims.length} onChange={(length) => setDims((d) => ({ ...d, length }))} /> ×
                    <NumIn value={dims.width} onChange={(width) => setDims((d) => ({ ...d, width }))} /> m
                    <span className="hidden sm:inline">(skiptir aðeins máli fyrir miðlínureglu og teikningu)</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* 3. Players */}
            <Section n={3} title="Leikmenn og bolti" done={!!receiverId && !!H}>
              <p className="text-sm muted mb-3">
                Liðum er skipt eftir lit á treyjum; það lið sem sparkar er sóknarliðið. Smelltu á leikmann til að breyta, dragðu punktinn á
                fremsta líkamshluta sem má skora með (við jörð). Handleggir teljast ekki með.
              </p>
              <div className="flex flex-wrap gap-2 mb-3 text-sm">
                <Btn onClick={() => kick && analyseFrame(kick)} disabled={!!busy || !kick}>🤖 Greina leikmenn aftur</Btn>
                <Btn onClick={swapTeams} disabled={!players.length}>⇄ Skipta um lið</Btn>
                <ModeBtn mode={mode} setMode={setMode} m="receiver" disabled={view !== 'frame'}>🎯 Velja móttakanda</ModeBtn>
                <ModeBtn mode={mode} setMode={setMode} m="ball" disabled={view !== 'frame'}>⚽ Staðsetja bolta</ModeBtn>
                <ModeBtn mode={mode} setMode={setMode} m="add-attacker" disabled={view !== 'frame'}>+ Sóknarmaður</ModeBtn>
                <ModeBtn mode={mode} setMode={setMode} m="add-defender" disabled={view !== 'frame'}>+ Varnarmaður</ModeBtn>
              </div>
              {mode !== 'select' && mode !== 'calibrate' && (
                <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>
                  {mode === 'receiver' ? 'Smelltu á leikmanninn sem tekur við boltanum.' : mode === 'ball' ? 'Smelltu þar sem boltinn snertir jörð við sparkið.' : 'Smelltu á fætur leikmannsins.'} (Esc hættir við)
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
                <Legend colour={ROLE_COLOUR.attacker} swatch={teamSwatch('attacker')}>Sóknarlið ({players.filter((p) => p.role === 'attacker').length})</Legend>
                <Legend colour={ROLE_COLOUR.defender} swatch={teamSwatch('defender')}>Varnarlið ({players.filter((p) => p.role === 'defender').length})</Legend>
                <Legend colour={ROLE_COLOUR.keeper}>Markvörður</Legend>
                <Legend colour={ROLE_COLOUR.ignore}>Hunsað (dómari o.fl.)</Legend>
                <Legend colour="#ffe14d">Bolti{ballEstimated ? ' (áætlaður við fætur sparkara)' : ''}</Legend>
              </div>
              {selected ? (
                <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    {selected.shirt && <span className="w-4 h-4 rounded" style={{ background: selected.shirt }} />}
                    <b>{labels.get(selected.id) ?? 'Hunsaður'}</b>
                    {(() => {
                      const q = pitchPlayers.find((p) => p.id === selected.id)
                      return q ? <span className="muted num">· {fmtM(q.u)} frá marklínu</span> : null
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['attacker', 'defender', 'keeper', 'ignore'] as Role[]).map((r) => (
                      <button key={r} onClick={() => setRole(selected.id, r)} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: selected.role === r ? ROLE_COLOUR[r] : 'var(--border)', background: selected.role === r ? ROLE_COLOUR[r] + '22' : 'transparent' }}>
                        {ROLE_NAME[r]}
                      </button>
                    ))}
                    <button onClick={() => { setReceiverId(selected.id); setRole(selected.id, 'attacker') }} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: receiverId === selected.id ? '#fff' : 'var(--border)' }}>
                      🎯 Móttakandi
                    </button>
                    <button onClick={() => { setPlayers((ps) => ps.filter((p) => p.id !== selected.id)); if (receiverId === selected.id) setReceiverId(null); setSelectedId(null) }} className="px-2.5 py-1 rounded-lg border text-xs" style={{ borderColor: 'var(--border)', color: 'var(--loss)' }}>
                      Eyða
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs muted">{players.length ? `${players.length} leikmenn fundust. Smelltu á leikmann í myndinni til að breyta.` : 'Engir leikmenn enn — merktu spark fyrst.'}</p>
              )}
            </Section>
          </div>

          {/* Verdict */}
          <aside className="grid gap-4 content-start">
            <div className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider muted mb-2">Niðurstaða</h2>
              {!kick ? (
                <p className="text-sm muted">Finndu sparkið fyrst.</p>
              ) : !H ? (
                <p className="text-sm muted">Kvarðaðu völlinn á sparkrammanum.</p>
              ) : !receiverVerdict ? (
                <p className="text-sm muted">Veldu móttakanda (🎯) til að fá úrskurð.</p>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tracking-tight" style={{ color: STATUS_COLOUR[receiverVerdict.status] }}>
                    {STATUS_TEXT[receiverVerdict.status]}
                  </p>
                  <p className="text-sm mt-1">{receiverVerdict.reason}</p>
                  {resolution !== null && (
                    <p className="text-xs muted mt-2">
                      Upplausn við móttakanda: 1 px ≈ {Math.max(1, Math.round(resolution * 100))} cm. Rammi til eða frá getur munað
                      tugum sentímetra á spretthlaupi.
                    </p>
                  )}
                </>
              )}
              {result && (
                <div className="mt-3 pt-3 border-t text-xs grid gap-1" style={{ borderColor: 'var(--border)' }}>
                  <p>
                    Rangstöðulína:{' '}
                    {result.lineU === null ? '—' : <b className="num">{fmtM(result.lineU)} frá marklínu</b>}{' '}
                    {result.lineSource === 'ball' ? '(boltinn)' : result.lineSource === 'defender' ? `(næstaftasti varnarmaður ${labels.get(result.secondLastId!) ?? ''})` : ''}
                  </p>
                  {result.verdicts.filter((v) => v.id !== receiverId).length > 0 && (
                    <div className="mt-1">
                      <p className="muted mb-1">Aðrir sóknarmenn:</p>
                      {result.verdicts.filter((v) => v.id !== receiverId).map((v) => (
                        <p key={v.id} className="flex justify-between">
                          <span>{labels.get(v.id)}</span>
                          <span style={{ color: STATUS_COLOUR[v.status] }}>{STATUS_SHORT[v.status]} · {fmtM(Math.abs(v.margin))}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {result.warnings.map((w) => (
                    <p key={w} className="muted">⚠︎ {w}</p>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 mt-3 text-xs muted">
                Óvissumörk
                <input type="range" min={0} max={1} step={0.05} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className="flex-1" />
                <span className="num w-12 text-right">±{Math.round(tolerance * 100)} cm</span>
              </label>
              {view === 'frame' && kick && (
                <button onClick={exportPng} className="mt-3 w-full px-3 py-2 rounded-lg border text-sm font-medium" style={{ borderColor: 'var(--border)' }}>
                  ⤓ Vista mynd (PNG)
                </button>
              )}
            </div>
            {H && (
              <div className="card p-3">
                <PitchMap dims={dims} players={pitchPlayers} labels={labels} ballU={ballPitch?.u ?? null} ballV={ballPitch?.v ?? null} result={result} receiverId={receiverId} />
                <p className="text-[11px] muted mt-2">Ofan frá: mark sóknarliðsins til hægri. Blá lína = rangstöðulína.</p>
              </div>
            )}
            <p className="text-[11px] muted leading-relaxed">
              Tólið metur <b>rangstöðustöðu</b> (lög 11). Hvort leikmaður hafi áhrif á leikinn er mat dómara, og ekki er dæmd rangstaða
              úr markspyrnu, innkasti eða hornspyrnu. Ein myndavél, ~25 rammar/s og fótpunktur sem nálgun — notið sem stuðning, ekki
              endanlegan dóm.
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}

const STATUS_TEXT = { offside: 'RANGSTAÐA', onside: 'EKKI RANGSTAÐA', close: 'OF TÆPT' } as const
const STATUS_SHORT = { offside: 'Rangstaða', onside: 'Réttstaða', close: 'Tæpt' } as const
const ROLE_NAME: Record<Role, string> = { attacker: 'Sóknarmaður', defender: 'Varnarmaður', keeper: 'Markvörður', ignore: 'Hunsa' }

function Btn({ children, primary, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      style={primary ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' } : { borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {children}
    </button>
  )
}

function ModeBtn({ mode, setMode, m, children, disabled }: { mode: Mode; setMode: (m: Mode) => void; m: Mode; children: React.ReactNode; disabled?: boolean }) {
  const on = mode === m
  return (
    <button
      disabled={disabled}
      onClick={() => setMode(on ? 'select' : m)}
      className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40"
      style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface)' }}
    >
      {children}
    </button>
  )
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className="px-3 py-1.5 text-sm" style={value === v ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)' }}>
          {l}
        </button>
      ))}
    </div>
  )
}

function NumIn({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={45}
      max={120}
      value={value}
      onChange={(e) => {
        const n = +e.target.value
        if (n >= 45 && n <= 120) onChange(n)
      }}
      className="w-14 rounded border px-1.5 py-0.5 bg-transparent num"
      style={{ borderColor: 'var(--border)' }}
    />
  )
}

function Section({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="font-bold mb-2 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full text-xs flex items-center justify-center text-white" style={{ background: done ? 'var(--win)' : 'var(--accent)' }}>
          {done ? '✓' : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Legend({ colour, swatch, children }: { colour: string; swatch?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: colour }} />
      {swatch && <span className="w-2.5 h-2.5 rounded-sm border" style={{ background: swatch, borderColor: 'var(--border)' }} />}
      {children}
    </span>
  )
}

function Timeline({ duration, time, kick, scan, onSeek }: { duration: number; time: number; kick: Kick | null; scan: Scan | null; onSeek: (t: number) => void }) {
  const pct = (t: number) => `${(t / (duration || 1)) * 100}%`
  return (
    <div className="relative h-6">
      <input type="range" min={0} max={duration || 0} step={0.01} value={time} onChange={(e) => onSeek(+e.target.value)} className="absolute inset-0 w-full" aria-label="Tímalína" />
      {scan?.events.filter((e) => e.type === 'kick').map((e) => (
        <span key={e.index} className="absolute top-0 w-0.5 h-2 pointer-events-none" style={{ left: pct(e.t), background: '#f5b700' }} />
      ))}
      {kick && <span className="absolute -top-0.5 w-1 h-3 rounded pointer-events-none" style={{ left: pct(kick.t), background: 'var(--accent)' }} title="Spark" />}
    </div>
  )
}

/** Mini pitch-end diagram showing which calibration point to click next. */
function CalibDiagram({ template, side, dims, active, done }: { template: TemplateId; side: 'left' | 'right'; dims: PitchDims; active?: string; done: Set<string> }) {
  const pts = templatePoints(template, dims)
  const h = dims.length / 2
  // Diagram space: x = distance from goal line (flipped for side), y = v.
  const flip = side === 'left'
  const view = template === 'box' ? { u0: -2, u1: 22, v: 24 } : { u0: h - 13, u1: h + 13, v: 14 }
  const w = view.u1 - view.u0
  const X = (u: number) => (flip ? u - view.u0 : view.u1 - u)
  const Y = (v: number) => v + view.v
  const { boxDepth: bd, boxHalfWidth: bw, goalAreaDepth: gd, goalAreaHalfWidth: gw } = IFAB
  const line = 'rgba(255,255,255,0.75)'
  return (
    <svg viewBox={`0 0 ${w} ${view.v * 2}`} className="w-full rounded-lg" style={{ background: '#1f7a3f' }} aria-label="Kvörðunarpunktar">
      <g fill="none" stroke={line} strokeWidth={0.3}>
        {template === 'box' ? (
          <>
            <line x1={X(0)} x2={X(0)} y1={0} y2={view.v * 2} />
            <polyline points={`${X(0)},${Y(-bw)} ${X(bd)},${Y(-bw)} ${X(bd)},${Y(bw)} ${X(0)},${Y(bw)}`} />
            <polyline points={`${X(0)},${Y(-gw)} ${X(gd)},${Y(-gw)} ${X(gd)},${Y(gw)} ${X(0)},${Y(gw)}`} />
            <path d={`M ${X(bd)} ${Y(-7.31)} A 9.15 9.15 0 0 ${flip ? 1 : 0} ${X(bd)} ${Y(7.31)}`} />
          </>
        ) : (
          <>
            <line x1={X(h)} x2={X(h)} y1={0} y2={view.v * 2} />
            <circle cx={X(h)} cy={Y(0)} r={9.15} />
            <text x={flip ? 1 : w - 1} y={2.6} fontSize={2.2} fill={line} stroke="none" textAnchor={flip ? 'start' : 'end'}>{flip ? '← sókn' : 'sókn →'}</text>
          </>
        )}
      </g>
      <text x={w / 2} y={2.4} fontSize={1.8} fill="rgba(255,255,255,0.6)" textAnchor="middle">fjær</text>
      <text x={w / 2} y={view.v * 2 - 0.8} fontSize={1.8} fill="rgba(255,255,255,0.6)" textAnchor="middle">nær myndavél</text>
      {pts.map((p, i) => {
        const on = p.key === active
        const ok = done.has(p.key)
        return (
          <g key={p.key}>
            <circle cx={X(p.pitch.x)} cy={Y(p.pitch.y)} r={on ? 1.5 : 1} fill={on ? '#00e5ff' : ok ? '#22c58b' : 'rgba(255,255,255,0.35)'} stroke="#000" strokeWidth={0.15} />
            <text x={X(p.pitch.x)} y={Y(p.pitch.y) - 1.6} fontSize={1.8} fill="#fff" textAnchor="middle" fontWeight={700}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}
