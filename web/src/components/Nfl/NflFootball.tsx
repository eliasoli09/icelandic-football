'use client'

import { useEffect, useRef } from 'react'
import styles from './NflStadium.module.css'
import { createFootballLeather, footballRadius } from './footballSurface'
import { createFootballTrails } from './footballTrails'

/** Decorative scene; rendering stops offscreen, in hidden tabs and when paused. */
export function NflFootball({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => {
    const root = host.current!
    let disposed = false
    let cleanup = () => {}
    void import('three').then(THREE => {
      if (disposed) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) }
      catch { return }
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 30)
      camera.position.set(0, 0, 6.4)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFShadowMap
      const maps = createFootballLeather()
      const texture = new THREE.CanvasTexture(maps.color)
      const bump = new THREE.CanvasTexture(maps.bump)
      const roughness = new THREE.CanvasTexture(maps.roughness)
      texture.colorSpace = THREE.SRGBColorSpace
      for (const map of [texture, bump, roughness]) {
        map.wrapS = THREE.RepeatWrapping
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      }
      const leather = new THREE.MeshPhysicalMaterial({
        map: texture, bumpMap: bump, bumpScale: .045, roughnessMap: roughness,
        roughness: .85, metalness: 0, clearcoat: .12, clearcoatRoughness: .6,
      })
      const points = Array.from({ length: 129 }, (_, i) => {
        const y = (i / 128 - .5) * 3.3
        return new THREE.Vector2(i === 0 || i === 128 ? 0 : footballRadius(y), y)
      })
      const geometry = new THREE.LatheGeometry(points, 160)
      const vertices = geometry.attributes.position
      const uv = geometry.attributes.uv
      // Recess the joins into the geometry as well as the surface maps.
      for (let i = 0; i < vertices.count; i++) {
        const u = uv.getX(i) * 4
        const distance = Math.abs(u - Math.round(u))
        const inset = 1 - .009 * Math.exp(-distance * distance / .0005)
        vertices.setX(i, vertices.getX(i) * inset); vertices.setZ(i, vertices.getZ(i) * inset)
      }
      geometry.computeVertexNormals()
      const football = new THREE.Group()
      const body = new THREE.Mesh(geometry, leather)
      body.castShadow = true; body.receiveShadow = true
      football.add(body)
      const weave = document.createElement('canvas'); weave.width = 128; weave.height = 128
      const weaveCtx = weave.getContext('2d')!
      weaveCtx.fillStyle = '#bebebe'; weaveCtx.fillRect(0, 0, 128, 128)
      for (let i = 0; i < 128; i += 4) {
        weaveCtx.fillStyle = '#898989'; weaveCtx.fillRect(i, 0, 1, 128)
        weaveCtx.fillStyle = '#e6e6e6'; weaveCtx.fillRect(0, i, 128, 1)
      }
      const weaveMap = new THREE.CanvasTexture(weave)
      const thread = new THREE.MeshStandardMaterial({ color: '#e2dfcf', roughness: .73, bumpMap: weaveMap, bumpScale: .0015 })
      const holeMaterial = new THREE.MeshStandardMaterial({ color: '#150b08', roughness: 1 })
      const surface = (x: number, y: number) => Math.sqrt(Math.max(0, footballRadius(y) ** 2 - x * x))
      const lace = (points: InstanceType<typeof THREE.Vector3>[], radius: number) => {
        const curve = new THREE.CatmullRomCurve3(points)
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 10, false), thread)
        mesh.castShadow = true; mesh.receiveShadow = true; football.add(mesh)
      }
      for (const x of [-.055, .055]) lace(Array.from({ length: 17 }, (_, i) => {
        const y = -.67 + i / 16 * 1.34
        return new THREE.Vector3(x, y, surface(x, y) + .017)
      }), .022)
      for (let i = 0; i < 8; i++) {
        const y = -.54 + i * .154
        // Flat woven straps conform to the curved leather, with real thickness.
        const strap = new THREE.BoxGeometry(.39, .062, .026, 20, 2, 1)
        const position = strap.attributes.position
        for (let v = 0; v < position.count; v++) {
          const x = position.getX(v), sy = position.getY(v) + y
          const arch = .025 * Math.cos(x / .195 * Math.PI / 2)
          position.setXYZ(v, x, sy, surface(x, sy) + position.getZ(v) + .018 + arch)
        }
        strap.computeVertexNormals()
        const mesh = new THREE.Mesh(strap, thread)
        mesh.castShadow = true; mesh.receiveShadow = true; football.add(mesh)
        for (const x of [-.195, .195]) {
          const hole = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), holeMaterial)
          hole.scale.set(1, .85, .18); hole.position.set(x, y, surface(x, y) + .002); football.add(hole)
        }
      }
      const holder = new THREE.Group()
      holder.scale.setScalar(1.24)
      holder.rotation.z = -1.04
      holder.rotation.x = -.12
      football.rotation.y = -.32
      holder.add(football)
      const trails = createFootballTrails(THREE)
      holder.add(trails.group); trails.update(0)
      scene.add(holder)
      scene.add(new THREE.HemisphereLight('#c1d6ff', '#070b15', .65))
      const key = new THREE.DirectionalLight('#fff1e4', 3.5)
      key.position.set(-3, 5, 3); key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.left = -3; key.shadow.camera.right = 3
      key.shadow.camera.top = 3; key.shadow.camera.bottom = -3
      key.shadow.normalBias = .008; key.shadow.bias = -.0001
      scene.add(key)
      for (const [color, intensity, position] of [
        ['#ff4263', 5, [-3, 2, -2]], ['#58afff', 6, [3, -1, -2]], ['#c9e7ff', .65, [1, -2, 4]],
      ] as const) {
        const light = new THREE.DirectionalLight(color, intensity)
        light.position.set(position[0], position[1], position[2]); scene.add(light)
      }
      root.appendChild(renderer.domElement)
      root.dataset.ready = 'true'
      let visible = true, visibilityCheckedAt = -Infinity, frame = 0, previous = 0, angle = -.32
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
      const render = () => renderer.render(scene, camera)
      const resize = () => {
        const { width, height } = root.getBoundingClientRect()
        renderer.setSize(width, height, false)
        camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); render()
      }
      const observer = new ResizeObserver(resize); observer.observe(root)
      const tick = (time: number) => {
        const dt = previous ? Math.min((time - previous) / 1000, .05) : 0
        previous = time
        // Recheck bounds periodically: viewport changes must never leave the scene asleep.
        if (time - visibilityCheckedAt > 250) {
          const bounds = root.getBoundingClientRect()
          visible = bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth
          visibilityCheckedAt = time
        }
        if (visible && !pausedRef.current && !reduce.matches) {
          angle += dt * .22
          football.rotation.y = angle
          trails.update((angle + .32) / .22)
          holder.position.y = Math.sin(angle * 1.3) * .065
          render()
        }
        frame = requestAnimationFrame(tick)
      }
      function sync() {
        cancelAnimationFrame(frame); previous = 0; visibilityCheckedAt = -Infinity
        if (!document.hidden) frame = requestAnimationFrame(tick)
      }
      document.addEventListener('visibilitychange', sync)
      resize(); sync()
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect()
        document.removeEventListener('visibilitychange', sync)
        scene.traverse(object => {
          if (object instanceof THREE.Mesh) object.geometry.dispose()
        })
        trails.dispose()
        leather.dispose(); thread.dispose(); holeMaterial.dispose()
        texture.dispose(); bump.dispose(); roughness.dispose(); weaveMap.dispose()
        key.shadow.map?.dispose(); renderer.dispose()
        renderer.domElement.remove(); delete root.dataset.ready
      }
    }).catch(() => { /* Keep the CSS football if WebGL cannot initialize. */ })
    return () => { disposed = true; cleanup() }
  }, [])
  return <div className={styles.ballHost} ref={host} aria-hidden="true"><div className={styles.fallbackBall}><span>╫╫╫╫╫╫╫</span></div></div>
}
