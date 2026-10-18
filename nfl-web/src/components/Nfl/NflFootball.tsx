'use client'

import { useEffect, useRef } from 'react'
import styles from './NflStadium.module.css'
import { createFootballLeather, footballRadius } from './footballSurface'
import { createFootballTrails } from './footballTrails'

/**
 * Decorative scene; rendering stops offscreen and in hidden tabs. A click throws
 * the ball: it rockets away into the distance with fire behind it and comes back.
 */
export function NflFootball({ paused = false }: { paused?: boolean }) {
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
      catch { root.dataset.failed = 'true'; return }
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
      let visible = true, visibilityCheckedAt = -Infinity, frame = 0, previous = 0, angle = -.32
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

      // ── The throw: embers are additive sprites from one pool, each with its own material for colour and fade
      const fireCanvas = document.createElement('canvas'); fireCanvas.width = 64; fireCanvas.height = 64
      const fctx = fireCanvas.getContext('2d')!
      const flame = fctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      flame.addColorStop(0, '#ffffffff'); flame.addColorStop(.25, '#fff2b0ee'); flame.addColorStop(.55, '#ff8a1a66'); flame.addColorStop(1, '#ff2a0000')
      fctx.fillStyle = flame; fctx.fillRect(0, 0, 64, 64)
      const fireTexture = new THREE.CanvasTexture(fireCanvas)
      const embers = Array.from({ length: 320 }, () => {
        const material = new THREE.SpriteMaterial({ map: fireTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
        const sprite = new THREE.Sprite(material); sprite.visible = false; scene.add(sprite)
        return { sprite, material, vel: new THREE.Vector3(), life: 0, max: 1, size: 1 }
      })
      let nextEmber = 0
      const hot = new THREE.Color('#fff4c4'), warm = new THREE.Color('#ff9a1f'), ember = new THREE.Color('#ff2d10')
      // an ember at `at`, drifting a little the way the ball came from; never towards the camera, or it swells into a blob
      const emit = (at: InstanceType<typeof THREE.Vector3>, back: InstanceType<typeof THREE.Vector3>, spread: number, size = 1) => {
        const e = embers[nextEmber]; nextEmber = (nextEmber + 1) % embers.length
        e.sprite.position.copy(at).add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, 0))
        e.vel.set(back.x, back.y, 0).multiplyScalar(.5 + Math.random() * .6).add(new THREE.Vector3((Math.random() - .5) * .35, (Math.random() - .2) * .35, 0))
        e.max = e.life = .32 + Math.random() * .3; e.size = (.16 + Math.random() * .14) * size; e.sprite.visible = true
      }
      const stepEmbers = (dt: number) => {
        for (const e of embers) {
          if (e.life <= 0) continue
          e.life -= dt
          if (e.life <= 0) { e.sprite.visible = false; continue }
          const k = 1 - e.life / e.max
          e.sprite.position.addScaledVector(e.vel, dt); e.vel.multiplyScalar(1 - dt * 1.8); e.vel.y += dt * .9
          e.sprite.scale.setScalar(e.size * (1 + k * 1.6))
          e.material.color.copy(k < .35 ? hot.clone().lerp(warm, k / .35) : warm.clone().lerp(ember, (k - .35) / .65))
          e.material.opacity = (1 - k) ** 1.4
        }
      }
      // seconds since the throw, -1 at rest: a pull back, the throw into the distance, a beat, and back to rest
      let thrown = -1
      const PULL = .14, AWAY = 1.15, GONE = 1.6, BACK = 2.5
      // where the throw ends: up and to the right, the way the nose points, and far off, still inside the frame
      const FAR = { x: 8, y: 5, z: -32 }
      const easeOutBack = (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2
      const tail = new THREE.Vector3(), towards = new THREE.Vector3(), last = new THREE.Vector3()
      const throwBall = () => { if (thrown < 0 && !reduce.matches) { thrown = 0; visible = true } }
      renderer.domElement.addEventListener('pointerdown', throwBall)
      const stepThrow = (dt: number) => {
        thrown += dt
        last.copy(holder.position)
        let x = 0, y = 0, z = 0, s = 1.24
        if (thrown < PULL) { const k = Math.sin(thrown / PULL * Math.PI / 2); x = -.22 * k; y = -.16 * k; z = .5 * k }
        else if (thrown < AWAY) {
          const k = (thrown - PULL) / (AWAY - PULL), e = k * k
          x = -.22 + (FAR.x + .22) * e; y = -.16 + (FAR.y + .16) * e + Math.sin(k * Math.PI) * .8; z = .5 + (FAR.z - .5) * k ** 1.4
          football.rotation.y += dt * 26
        } else if (thrown < GONE) { x = FAR.x; y = FAR.y; z = FAR.z; s = 0 }
        else if (thrown < BACK) {
          const k = (thrown - GONE) / (BACK - GONE), e = easeOutBack(k), r = 1 - Math.min(1, e)
          x = FAR.x * (1 - e); y = FAR.y * (1 - e); z = FAR.z * r; s = 1.24
          football.rotation.y += dt * 26 * (1 - k)
        } else { thrown = -1 }
        holder.position.set(x, y, z); holder.scale.setScalar(s)
        // a streak of fire along the path it just flew, sparks while it comes back
        towards.subVectors(holder.position, last)
        const flying = thrown > PULL && thrown < AWAY, landing = thrown > GONE && thrown < GONE + .5
        if ((flying || landing) && towards.lengthSq() > 0) {
          const back = towards.clone().normalize().multiplyScalar(-1)
          const n = flying ? 10 : 3
          for (let i = 0; i < n; i++) {
            tail.copy(last).lerp(holder.position, i / n).addScaledVector(back, flying ? .9 : .7)
            emit(tail, back, .12, flying ? 1 : .6)
          }
        }
      }
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
          trails.update((angle + .32) / .22)
          if (thrown >= 0) stepThrow(dt)
          else { football.rotation.y = angle; holder.position.set(0, Math.sin(angle * 1.3) * .065, 0); holder.scale.setScalar(1.24) }
          stepEmbers(dt)
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
      // one frame after the first render, so the fade-in has a start to transition from
      requestAnimationFrame(() => { if (!disposed) root.dataset.ready = 'true' })
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect()
        renderer.domElement.removeEventListener('pointerdown', throwBall)
        for (const e of embers) e.material.dispose()
        fireTexture.dispose()
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
    }).catch(() => { root.dataset.failed = 'true' })
    return () => { disposed = true; cleanup() }
  }, [])
  return <div className={styles.ballHost} ref={host} aria-hidden="true"><div className={styles.fallbackBall}><span>╫╫╫╫╫╫╫</span></div></div>
}
