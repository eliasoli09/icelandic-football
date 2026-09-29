import { describe, expect, it } from 'vitest'
import { buildFootballTopology, createFootballMesh, FOOTBALL_VERTEX_STRIDE, FOOTBALL_CREST } from '../src/components/Entrance/footballMesh'
import { BallRenderer } from '../src/components/Entrance/BallRenderer'

describe('football topology', () => {
  it('forms a closed truncated icosahedron with 12 pentagons and 20 hexagons', () => {
    const { vertices, panels } = buildFootballTopology()
    expect(vertices).toHaveLength(60)
    expect(panels).toHaveLength(32)
    expect(panels.filter(panel => panel.vertices.length === 5)).toHaveLength(12)
    expect(panels.filter(panel => panel.vertices.length === 6)).toHaveLength(20)
    const edges = new Map<string, number>()
    for (const panel of panels) {
      for (let i = 0; i < panel.vertices.length; i++) {
        const edge = [panel.vertices[i], panel.vertices[(i + 1) % panel.vertices.length]].sort((a, b) => a - b).join(':')
        edges.set(edge, (edges.get(edge) ?? 0) + 1)
      }
    }
    expect(edges.size).toBe(90)
    expect([...edges.values()].every(count => count === 2)).toBe(true)
    expect(vertices.length - edges.size + panels.length).toBe(2)
  })

  it('places the panel vertices on a unit sphere and a hexagon squarely toward the viewer', () => {
    const { vertices, panels } = buildFootballTopology()
    for (const vertex of vertices) expect(Math.hypot(...vertex)).toBeCloseTo(1, 12)
    expect(panels.find(panel => Math.abs(panel.center[0]) < 1e-9 && Math.abs(panel.center[1]) < 1e-9 && panel.center[2] > 0.999999)?.vertices).toHaveLength(6)
  })

  it('keeps the original crest alpha bounds inside the front hexagon, clear of its seams', () => {
    const { vertices, panels } = buildFootballTopology()
    const front = panels.find(panel => panel.center[2] > 0.999999)!
    const corners = front.vertices.map(index => vertices[index])
    // The supplied 507px source has nontransparent bounds x30–469, y40–467.
    for (const sourceX of [30, 469]) {
      for (const sourceY of [40, 467]) {
        const x = (sourceX / 507 - 0.5) * FOOTBALL_CREST.scale
        const y = (0.5 - sourceY / 507) * FOOTBALL_CREST.scale + FOOTBALL_CREST.centerY
        const z = Math.sqrt(1 - x * x - y * y)
        for (let i = 0; i < corners.length; i++) {
          const a = corners[i], b = corners[(i + 1) % corners.length]
          const edge = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
          expect((x * edge[0] + y * edge[1] + z * edge[2]) / Math.hypot(...edge)).toBeGreaterThan(0.012)
        }
      }
    }
  })
})

describe('football renderer availability', () => {
  it('reports unsupported WebGL2 so the entrance can use its accessible fallback', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
    expect(() => new BallRenderer(canvas, {} as HTMLImageElement)).toThrow(/WebGL2/)
  })
})

describe('curved gold football geometry', () => {
  it('has finite outward normals, a round surface, and physically recessed panel borders', () => {
    const mesh = createFootballMesh('hero')
    expect(mesh.vertices.length % FOOTBALL_VERTEX_STRIDE).toBe(0)
    let seamVertices = 0
    let surfaceVertices = 0
    let valid = true
    let minNormal = Infinity, maxNormal = 0, minFacing = Infinity, maxRadius = 0, maxSeamRadius = 0, maxSurfaceError = 0
    for (let offset = 0; offset < mesh.vertices.length; offset += FOOTBALL_VERTEX_STRIDE) {
      const [x, y, z, nx, ny, nz, seamDistance, sides] = mesh.vertices.slice(offset, offset + FOOTBALL_VERTEX_STRIDE)
      valid &&= [x, y, z, nx, ny, nz, seamDistance, sides].every(Number.isFinite) && (sides === 5 || sides === 6)
      const normal = Math.hypot(nx, ny, nz), radius = Math.hypot(x, y, z)
      minNormal = Math.min(minNormal, normal); maxNormal = Math.max(maxNormal, normal)
      minFacing = Math.min(minFacing, x * nx + y * ny + z * nz)
      maxRadius = Math.max(maxRadius, radius)
      if (seamDistance < 0.00001) {
        seamVertices++
        maxSeamRadius = Math.max(maxSeamRadius, radius)
      } else if (seamDistance > 0.03) {
        surfaceVertices++
        maxSurfaceError = Math.max(maxSurfaceError, Math.abs(radius - 1))
      }
    }
    expect(seamVertices).toBeGreaterThan(100)
    expect(surfaceVertices).toBeGreaterThan(100)
    expect(valid).toBe(true)
    expect(minNormal).toBeCloseTo(1, 5); expect(maxNormal).toBeCloseTo(1, 5)
    expect(minFacing).toBeGreaterThan(.7)
    expect(maxRadius).toBeLessThanOrEqual(1.000001)
    expect(maxSeamRadius).toBeLessThan(.994)
    expect(maxSurfaceError).toBeLessThan(.000005)
  })

  it('has valid consistently outward triangles without degenerate faces', () => {
    const mesh = createFootballMesh('hero')
    const count = mesh.vertices.length / FOOTBALL_VERTEX_STRIDE
    expect(mesh.indices.length % 3).toBe(0)
    let validIndices = true, minimumFacing = Infinity
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const corners = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]]
      validIndices &&= corners.every(index => index >= 0 && index < count)
      const [a, b, c] = corners.map(index => mesh.vertices.slice(index * FOOTBALL_VERTEX_STRIDE, index * FOOTBALL_VERTEX_STRIDE + 3))
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      minimumFacing = Math.min(minimumFacing, cross[0] * a[0] + cross[1] * a[1] + cross[2] * a[2])
    }
    expect(validIndices).toBe(true)
    expect(minimumFacing).toBeGreaterThan(1e-9)
  })

  it('bounds the follower mesh cost for a 240-ball instanced draw', () => {
    const follower = createFootballMesh('follower')
    const hero = createFootballMesh('hero')
    expect(follower.indices.length / 3).toBeLessThanOrEqual(1200)
    expect(hero.indices.length / 3).toBeLessThanOrEqual(20000)
    expect(hero.indices.length).toBeGreaterThan(follower.indices.length * 4)
    expect(Math.max(...hero.indices)).toBeLessThan(65536)
  })
})
