/** One clock for the 3D rotation and float; pausing preserves the exact pose. */
export function startStarBallMotion(root: HTMLElement, paint: (angle: number) => void) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let visible = true, frame = 0, elapsed = 0, previous: number | null = null
  const redraw = () => paint((elapsed % 12_000) / 12_000 * Math.PI * 2)
  const tick = (time: number) => {
    elapsed += previous === null ? 0 : time - previous
    previous = time
    redraw()
    frame = requestAnimationFrame(tick)
  }
  const sync = () => {
    cancelAnimationFrame(frame)
    previous = null
    const running = visible && !document.hidden && !motion.matches
    root.dataset.running = String(running)
    if (running) frame = requestAnimationFrame(tick)
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
  observer.observe(root)
  motion.addEventListener('change', sync)
  document.addEventListener('visibilitychange', sync)
  redraw()
  sync()
  return {
    redraw,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    },
  }
}
