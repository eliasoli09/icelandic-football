type Vec3 = readonly [number, number, number]
type StarPatch = { center: Vec3; points: Vec3[] }

const unit = ([x, y, z]: Vec3): Vec3 => {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const fixed = (n: number) => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(2)

/** The twelve icosahedron vertices place five-point stars evenly around a sphere.
 * Tips face neighboring stars; interpolated spherical edges make perspective
 * change naturally as the entire object turns, rather than spinning a flat SVG.
 */
export function createStarPatches(): StarPatch[] {
  const phi = (1 + Math.sqrt(5)) / 2
  const centers: Vec3[] = []
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    centers.push(unit([0, a, b * phi]), unit([a, b * phi, 0]), unit([b * phi, 0, a]))
  }
  return centers.map(center => {
    const tangent = unit(cross(center, Math.abs(center[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]))
    const bitangent = cross(center, tangent)
    const neighbors = centers.filter(other => dot(center, other) > 0.4 && dot(center, other) < 0.9)
    const bearings = neighbors.map(other => Math.atan2(dot(other, bitangent), dot(other, tangent))).sort((a, b) => a - b)
    const corners: Vec3[] = []
    for (let i = 0; i < 10; i++) {
      const bearing = bearings[0] + i * Math.PI / 5
      const radius = i % 2 === 0 ? 0.55 : 0.245
      corners.push(unit(center.map((value, axis) => value * Math.cos(radius) + Math.sin(radius) * (tangent[axis] * Math.cos(bearing) + bitangent[axis] * Math.sin(bearing))) as unknown as Vec3))
    }
    const points: Vec3[] = []
    for (let i = 0; i < 10; i++) {
      const a = corners[i], b = corners[(i + 1) % 10]
      for (let j = 0; j < 8; j++) {
        const t = j / 8
        points.push(unit([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]))
      }
    }
    return { center, points }
  })
}

const patches = createStarPatches()

export function projectStarBall(angle: number) {
  // Normalize before calculating to keep the end of the 72-second cycle exact.
  const turn = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const sin = Math.sin(turn + 0.28), cos = Math.cos(turn + 0.28)
  const tilt = 0.45, roll = -0.22
  const rotate = ([x, y, z]: Vec3): Vec3 => {
    const ty = y * Math.cos(tilt) - z * Math.sin(tilt)
    const tz = y * Math.sin(tilt) + z * Math.cos(tilt)
    const rx = x * cos + tz * sin, rz = tz * cos - x * sin
    return [rx * Math.cos(roll) - ty * Math.sin(roll), rx * Math.sin(roll) + ty * Math.cos(roll), rz]
  }
  return patches.map((patch, index) => {
    const center = rotate(patch.center)
    const path = patch.points.map((point, i) => {
      const [x, y] = rotate(point)
      return `${i === 0 ? 'M' : 'L'}${fixed(250 + x * 221)},${fixed(250 - y * 221)}`
    }).join('') + 'Z'
    return { index, path, opacity: Number((center[2] < 0 ? 0.07 : 0.3 + center[2] * 0.65).toFixed(4)), depth: center[2] }
  })
}

/** Smooth, nested edge contours. Phase changes the silhouette by only ~2%. */
export function roundedStarContour(scale: number, phase: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2
    const radius = (i % 2 ? 0.55 : 1) * scale * (1 + 0.018 * Math.sin(phase + i * 0.8))
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })
  const near = (a: number[], b: number[]) => [a[0] * 0.91 + b[0] * 0.09, a[1] * 0.91 + b[1] * 0.09]
  let path = ''
  for (let i = 0; i < points.length; i++) {
    const before = near(points[i], points[(i + 9) % 10])
    const after = near(points[i], points[(i + 1) % 10])
    path += `${i === 0 ? 'M' : 'L'}${fixed(before[0])},${fixed(before[1])}Q${fixed(points[i][0])},${fixed(points[i][1])} ${fixed(after[0])},${fixed(after[1])}`
  }
  return path + 'Z'
}
