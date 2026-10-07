/**
 * Eight-bit blips made on the spot with the Web Audio API: no files to load.
 * Browsers only allow sound after the player has pressed something, so the
 * context is made on the first call, which always follows a click or a key.
 */
let ctx: AudioContext | null = null
let muted = false

export const setMuted = (m: boolean) => { muted = m }

function tone(freq: number, start: number, length: number, type: OscillatorType = 'square', volume = 0.06, slide = 0) {
  if (muted || typeof window === 'undefined') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + start
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + length)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  } catch { /* no sound is fine */ }
}

/** a short whistle-like noise burst, for the referee */
function whistle(start = 0) {
  tone(2400, start, 0.12, 'triangle', 0.05, 200)
  tone(2600, start + 0.14, 0.32, 'triangle', 0.05, -150)
}

export const sfx = {
  tick: () => tone(880, 0, 0.05, 'square', 0.03),
  urgent: () => tone(1320, 0, 0.06, 'square', 0.04),
  kick: () => tone(180, 0, 0.12, 'triangle', 0.12, -90),
  wrong: () => { tone(220, 0, 0.18, 'square', 0.05); tone(160, 0.16, 0.28, 'square', 0.05) },
  timeout: () => whistle(),
  /** the rarer the answer, the higher and longer the jingle */
  tier: (points: number) => {
    const steps = points >= 100 ? 5 : points >= 75 ? 4 : points >= 50 ? 3 : points >= 25 ? 2 : 1
    const scale = [523, 659, 784, 1047, 1319]
    for (let i = 0; i < steps; i++) tone(scale[i], i * 0.08, 0.14, 'square', 0.05)
    if (points >= 100) tone(1568, steps * 0.08, 0.4, 'square', 0.05)
  },
  arrive: () => {
    const notes = [392, 523, 659, 784]
    notes.forEach((n, i) => tone(n, i * 0.1, 0.18, 'square', 0.05))
    tone(1047, 0.42, 0.45, 'triangle', 0.06)
  },
  fanfare: () => {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047]
    notes.forEach((n, i) => tone(n, i * 0.13, 0.16, 'square', 0.06))
    whistle(1.2)
  },
  start: () => whistle(),
}
