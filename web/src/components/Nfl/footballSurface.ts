/** Deterministic leather maps: color, physical relief and varying roughness. */
export function createFootballLeather() {
  const width = 2048, height = 1024
  const make = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c }
  const color = make(), bump = make(), roughness = make()
  const c = color.getContext('2d')!, b = bump.getContext('2d')!, r = roughness.getContext('2d')!
  c.fillStyle = '#29130f'; c.fillRect(0, 0, width, height)
  b.fillStyle = '#282828'; b.fillRect(0, 0, width, height)
  r.fillStyle = '#bfbfbf'; r.fillRect(0, 0, width, height)
  let seed = 1427
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  // Jittered, irregular pebbles avoid a printed dot-grid appearance.
  for (let y = -8; y < height + 8; y += 7) for (let x = -8; x < width + 8; x += 8) {
    const px = x + (y % 14 ? 4 : 0) + (random() - .5) * 3
    const py = y + (random() - .5) * 2.6
    const rx = 2.7 + random() * 1.2, ry = 2.1 + random() * 1.2, rotation = random() * Math.PI
    const tone = random()
    c.fillStyle = `rgb(${57 + tone * 25},${25 + tone * 13},${19 + tone * 10})`
    c.beginPath(); c.ellipse(px, py, rx, ry, rotation, 0, Math.PI * 2); c.fill()
    const relief = b.createRadialGradient(px, py, .4, px, py, rx)
    relief.addColorStop(0, '#d9d9d9'); relief.addColorStop(.55, '#b4b4b4'); relief.addColorStop(1, '#383838')
    b.fillStyle = relief; b.beginPath(); b.ellipse(px, py, rx, ry, rotation, 0, Math.PI * 2); b.fill()
    const rough = Math.floor(130 + random() * 40)
    r.fillStyle = `rgb(${rough},${rough},${rough})`; r.beginPath(); r.ellipse(px, py, rx, ry, rotation, 0, Math.PI * 2); r.fill()
  }
  // Four leather panels with recessed, subtly highlighted sewn joins.
  for (const x of [0, 512, 1024, 1536, 2048]) {
    for (const [ctx, dark, edge] of [[c, '#160b09', '#61392a'], [b, '#080808', '#797979'], [r, '#dddddd', '#a0a0a0']] as const) {
      ctx.fillStyle = dark; ctx.fillRect(x - 3, 0, 6, height)
      ctx.fillStyle = edge; ctx.fillRect(x - 5, 0, 1, height); ctx.fillRect(x + 4, 0, 1, height)
    }
  }
  return { color, bump, roughness }
}

/** Rounded regulation-like profile (length to diameter about 1.65). */
export function footballRadius(y: number) {
  return Math.pow(Math.max(0, Math.cos(y / 1.65 * Math.PI / 2)), .63)
}
