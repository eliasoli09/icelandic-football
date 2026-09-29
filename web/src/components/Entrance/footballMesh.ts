export type Vec3 = readonly [number, number, number]

export interface FootballPanel {
  vertices: number[]
  center: Vec3
}

export interface FootballTopology {
  vertices: Vec3[]
  panels: FootballPanel[]
}

export interface FootballMesh {
  /** Position, surface normal, angular distance from a seam, panel side count. */
  vertices: Float32Array
  indices: Uint16Array
}

export const FOOTBALL_VERTEX_STRIDE = 8
export const FOOTBALL_CREST = { scale: 0.55, centerY: 0.035 } as const

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v)
  return [v[0] / length, v[1] / length, v[2] / length]
}
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Truncates every directed edge of an icosahedron at one third of its length. */
export function buildFootballTopology(): FootballTopology {
  const phi = (1 + Math.sqrt(5)) / 2
  const icosahedron: Vec3[] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ]
  const neighbors = icosahedron.map(() => [] as number[])
  const directed = new Map<string, number>()
  const vertices: Vec3[] = []
  for (let a = 0; a < icosahedron.length; a++) {
    for (let b = 0; b < icosahedron.length; b++) {
      if (a === b || Math.abs(Math.hypot(...icosahedron[a].map((value, i) => value - icosahedron[b][i])) - 2) > 1e-8) continue
      neighbors[a].push(b)
      directed.set(`${a}:${b}`, vertices.length)
      vertices.push(normalize(mix(icosahedron[a], icosahedron[b], 1 / 3)))
    }
  }

  const faces: number[][] = neighbors.map((adjacent, a) => adjacent.map(b => directed.get(`${a}:${b}`)!))
  for (let a = 0; a < icosahedron.length; a++) {
    for (const b of neighbors[a]) {
      if (b <= a) continue
      for (const c of neighbors[b]) {
        if (c <= b || !neighbors[a].includes(c)) continue
        faces.push([[a, b], [b, a], [b, c], [c, b], [c, a], [a, c]].map(([from, to]) => directed.get(`${from}:${to}`)!))
      }
    }
  }

  // A hexagon faces +Z with a horizontal upper edge. This gives the crest a
  // single uninterrupted panel at the identity rotation.
  const frontFace = faces.find(face => face.length === 6)!
  const frontSum = frontFace.reduce<number[]>((sum, index) => sum.map((value, axis) => value + vertices[index][axis]), [0, 0, 0])
  const front = normalize(frontSum as unknown as Vec3)
  const topEdge = mix(vertices[frontFace[0]], vertices[frontFace[1]], 0.5)
  const up = normalize(topEdge.map((value, axis) => value - front[axis] * dot(topEdge, front)) as unknown as Vec3)
  const right = cross(up, front)
  const oriented = vertices.map((v): Vec3 => [dot(v, right), dot(v, up), dot(v, front)])
  const panels = faces.map(indices => {
    const sum = indices.reduce<number[]>((result, index) => result.map((value, axis) => value + oriented[index][axis]), [0, 0, 0])
    const center = normalize(sum as unknown as Vec3)
    const tangent = normalize(cross(Math.abs(center[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], center))
    const bitangent = cross(center, tangent)
    const vertices = indices.sort((a, b) => Math.atan2(dot(oriented[a], bitangent), dot(oriented[a], tangent)) - Math.atan2(dot(oriented[b], bitangent), dot(oriented[b], tangent)))
    return { vertices, center }
  })
  return { vertices: oriented, panels }
}

/** A spherical panel surface with actual groove depth, not lines on a smooth ball. */
export function createFootballMesh(detail: 'hero' | 'follower' = 'hero'): FootballMesh {
  const topology = buildFootballTopology()
  const segments = detail === 'hero' ? 6 : 2
  // Extra samples are concentrated at the bevel instead of spent on flat metal.
  const rings = detail === 'hero' ? [0.22, 0.45, 0.66, 0.82, 0.91, 0.955, 0.977, 0.992, 1] : [0.93, 1]
  const vertices: number[] = []
  const indices: number[] = []

  for (const panel of topology.panels) {
    const corners = panel.vertices.map(index => topology.vertices[index])
    const edgeNormals = corners.map((corner, i) => normalize(cross(corner, corners[(i + 1) % corners.length])))
    const addVertex = (direction: Vec3) => {
      let nearest = edgeNormals[0]
      let distance = dot(direction, nearest)
      for (const edgeNormal of edgeNormals) {
        const candidate = dot(direction, edgeNormal)
        if (candidate < distance) { distance = candidate; nearest = edgeNormal }
      }
      distance = Math.max(0, distance)
      const t = Math.min(1, Math.max(0, (distance - 0.0015) / 0.0215))
      const radius = 0.992 + 0.008 * t * t * (3 - 2 * t)
      const slope = 0.008 * 6 * t * (1 - t) / 0.0215
      const normal = normalize(direction.map((value, axis) => value - slope / radius * (nearest[axis] - value * distance)) as unknown as Vec3)
      const index = vertices.length / FOOTBALL_VERTEX_STRIDE
      vertices.push(direction[0] * radius, direction[1] * radius, direction[2] * radius, ...normal, distance, corners.length)
      return index
    }

    const center = addVertex(panel.center)
    const border: Vec3[] = []
    for (let edge = 0; edge < corners.length; edge++) {
      for (let segment = 0; segment < segments; segment++) {
        border.push(normalize(mix(corners[edge], corners[(edge + 1) % corners.length], segment / segments)))
      }
    }
    let previous: number[] = []
    for (const radius of rings) {
      const current = border.map(point => addVertex(normalize(mix(panel.center, point, radius))))
      for (let i = 0; i < current.length; i++) {
        const next = (i + 1) % current.length
        if (previous.length === 0) indices.push(center, current[i], current[next])
        else indices.push(previous[i], current[i], current[next], previous[i], current[next], previous[next])
      }
      previous = current
    }
  }

  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}
