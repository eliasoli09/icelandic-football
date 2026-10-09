/**
 * Small sounds made on the spot with the Web Audio API: no files to load.
 * The context is made on the first call, which always follows a click or key.
 */
let ctx: AudioContext | null = null
let muted = false
export const setMuted = (m: boolean) => { muted = m }

function tone(freq: number, start: number, length: number, type: OscillatorType = 'sine', volume = 0.08, slide = 0) {
  if (muted || typeof window === 'undefined') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + start
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + length)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  } catch { /* no sound is fine */ }
}

export const sfx = {
  /** the flag lands; warmer guesses ring higher */
  plant(heat: number) {
    tone(140, 0, 0.12, 'triangle', 0.12, -60)
    tone(360 + heat * 700, 0.06, 0.22, 'sine', 0.06)
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.32, 'triangle', 0.08))
    tone(1568, 0.5, 0.6, 'sine', 0.05)
  },
  nope() { tone(220, 0, 0.18, 'square', 0.03, -80) },
}
