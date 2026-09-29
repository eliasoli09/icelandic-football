'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { project, routePoints, type AtlasClub } from '@/lib/atlas/geo'
import { TapGesture } from './TapGesture'
import styles from './Atlas.module.css'

interface SceneProps {
  clubs: AtlasClub[]
  selection: AtlasClub[]
  visibleIds: number[]
  onChooseClub: (id: number) => void
  onStatus: (status: 'loading' | 'ready' | 'error') => void
  cameraCommand: { type: 'reset' | 'in' | 'out' | 'capital'; sequence: number }
}

interface SceneController {
  select: (clubs: AtlasClub[]) => void
  filter: (ids: number[]) => void
  command: (type: SceneProps['cameraCommand']['type']) => void
}

/** GLTF resources can be shared by many meshes. Dispose each resource once,
 * including ImageBitmaps, which GLTFLoader does not release automatically. */
function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const images = new Set<ImageBitmap>()
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value)
        }
      }
    }
    if (object instanceof THREE.InstancedMesh) object.dispose()
    if (object instanceof THREE.Light && 'shadow' in object) {
      (object as THREE.DirectionalLight).shadow?.dispose()
    }
  })
  for (const texture of textures) {
    const source = texture.source?.data
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) images.add(source)
    texture.dispose()
  }
  for (const image of images) image.close()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
}

export default function AtlasScene(props: SceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<SceneController | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [hover, setHover] = useState<{ club: AtlasClub; x: number; y: number } | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let loaded = false
    let visible = true
    let contextLost = false
    let frameId = 0
    let lastFrame = 0
    let interacting = false
    const tapGesture = new TapGesture()
    let lastHoverId: number | null = null
    let tween: { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 } | null = null
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = media.matches
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#251d16')
    const camera = new THREE.PerspectiveCamera(38, 1, .025, 25)
    const defaultTarget = new THREE.Vector3(0, .013, 0)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    } catch {
      latest.current.onStatus('error')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-label', 'Þrívítt kort. Dragðu til að snúa og notaðu hnappana til að þysja. Félögin eru einnig aðgengileg í skránni.')
    renderer.domElement.setAttribute('role', 'img')
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(defaultTarget)
    controls.enableDamping = !reduced
    controls.dampingFactor = .08
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.minDistance = .23
    controls.maxDistance = 3.4
    controls.minPolarAngle = .08
    controls.maxPolarAngle = Math.PI / 2.5
    controls.rotateSpeed = .55
    controls.zoomSpeed = .65
    controls.panSpeed = .6
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN

    const fill = new THREE.HemisphereLight('#fff4df', '#49301c', 1.2)
    const windowLight = new THREE.DirectionalLight('#fff3d8', 1.5)
    windowLight.position.set(-.7, 1.7, .55)
    windowLight.castShadow = true
    windowLight.shadow.mapSize.set(1024, 1024)
    windowLight.shadow.camera.left = -1.2
    windowLight.shadow.camera.right = 1.2
    windowLight.shadow.camera.top = 1.2
    windowLight.shadow.camera.bottom = -1.2
    windowLight.shadow.camera.near = .1
    windowLight.shadow.camera.far = 5
    windowLight.shadow.bias = -.00015
    windowLight.shadow.normalBias = .003
    scene.add(fill, windowLight)

    const pins = new Map<number, THREE.Object3D>()
    const pinFaces = new Map<number, THREE.Object3D>()
    const decoration = new THREE.Group()
    scene.add(decoration)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const matrix = new THREE.Matrix4()
    const scratch = new THREE.Vector3()

    function defaultPosition() {
      // Narrow screens need a little more distance to retain the west/east edges.
      const narrow = Math.max(1, 1.2 / camera.aspect)
      return new THREE.Vector3(0, 1.28 * Math.sqrt(narrow), 1.02 * Math.sqrt(narrow))
    }

    function schedule() {
      if (!disposed && !contextLost && loaded && visible && !document.hidden && !frameId) frameId = requestAnimationFrame(render)
    }

    function render(now: number) {
      frameId = 0
      if (disposed || contextLost || !visible || document.hidden || !loaded) return
      const delta = Math.min((now - lastFrame) / 1000, .05)
      lastFrame = now
      if (tween) {
        const t = Math.min((now - tween.start) / 850, 1)
        const eased = 1 - (1 - t) ** 3
        camera.position.lerpVectors(tween.from, tween.to, eased)
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased)
        if (t === 1) tween = null
      }
      // Subtle changing window light gives the still life a little movement.
      // It never moves the camera or competes with a user's orbit gesture.
      if (!reduced) windowLight.position.x = -.7 + Math.sin(now / 18000) * .035
      controls.update(delta)
      renderer.render(scene, camera)
      if (!reduced || tween || interacting) schedule()
    }

    function moveCamera(to: THREE.Vector3, toTarget: THREE.Vector3) {
      if (reduced) {
        camera.position.copy(to)
        controls.target.copy(toTarget)
        tween = null
      } else {
        tween = { start: performance.now(), from: camera.position.clone(), to, fromTarget: controls.target.clone(), toTarget }
      }
      schedule()
    }

    function clearDecoration() {
      disposeObject(decoration)
      decoration.clear()
    }

    function markGround(club: AtlasClub) {
      const p = project(club)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.006, .0012, 6, 32), new THREE.MeshBasicMaterial({ color: club.color, depthTest: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.set(p.x, .02, p.z)
      ring.renderOrder = 3
      decoration.add(ring)
    }

    function markBadge(club: AtlasClub) {
      const face = pinFaces.get(club.id)
      if (!face) return
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.024, .0011, 8, 48), new THREE.MeshBasicMaterial({ color: '#f7dda3', depthTest: false, transparent: true, opacity: .95 }))
      face.getWorldPosition(ring.position)
      face.getWorldQuaternion(ring.quaternion)
      // The exported badge's vertices lie in local XZ (Y = 0). Map the
      // torus's local XY plane into XZ before applying the badge quaternion.
      ring.rotateX(-Math.PI / 2)
      ring.position.y += .0015
      ring.renderOrder = 4
      decoration.add(ring)
    }

    function select(clubs: AtlasClub[]) {
      clearDecoration()
      if (!clubs.length) { moveCamera(defaultPosition(), defaultTarget.clone()); return }
      for (const club of clubs) { markGround(club); markBadge(club) }
      if (clubs.length === 2) {
        const points = routePoints(clubs[0], clubs[1])
        const dotSize = Math.max(.0009, Math.min(.0024, Math.hypot(points.at(-1)!.x - points[0].x, points.at(-1)!.z - points[0].z) / 90))
        const dotGeometry = new THREE.SphereGeometry(dotSize, 8, 6)
        const samples = points.filter((_, i) => i % 2 === 0)
        const outline = new THREE.InstancedMesh(new THREE.SphereGeometry(dotSize * 1.48, 8, 6), new THREE.MeshBasicMaterial({ color: '#302319', depthTest: false }), samples.length)
        samples.forEach((point, i) => { matrix.makeTranslation(point.x, point.y, point.z); outline.setMatrixAt(i, matrix) })
        outline.instanceMatrix.needsUpdate = true
        outline.renderOrder = 1
        decoration.add(outline)
        const halfway = Math.ceil(samples.length / 2)
        for (let half = 0; half < 2; half++) {
          const dots = half === 0 ? samples.slice(0, halfway) : samples.slice(halfway)
          const mesh = new THREE.InstancedMesh(dotGeometry, new THREE.MeshBasicMaterial({ color: clubs[half].color, depthTest: false }), dots.length)
          dots.forEach((point, i) => { matrix.makeTranslation(point.x, point.y, point.z); mesh.setMatrixAt(i, matrix) })
          mesh.instanceMatrix.needsUpdate = true
          mesh.renderOrder = 2
          decoration.add(mesh)
        }
      }
      const bounds = new THREE.Box3()
      for (const club of clubs) {
        const ground = project(club)
        bounds.expandByPoint(new THREE.Vector3(ground.x, .02, ground.z))
        const face = pinFaces.get(club.id)
        if (face) bounds.expandByPoint(face.getWorldPosition(scratch))
      }
      const target = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const span = Math.max(size.x / Math.max(camera.aspect, .7), size.z, clubs.length === 1 ? .20 : .28)
      const distance = Math.min(2.1, Math.max(clubs.length === 1 ? .55 : .68, span * 2.2 + .32))
      moveCamera(target.clone().add(new THREE.Vector3(0, distance * .81, distance * .59)), target)
    }

    function filter(ids: number[]) {
      const included = new Set(ids)
      pins.forEach((pin, id) => { pin.visible = included.has(id) })
      setHover(null)
      lastHoverId = null
      schedule()
    }

    function command(type: SceneProps['cameraCommand']['type']) {
      if (type === 'reset') { moveCamera(defaultPosition(), defaultTarget.clone()); return }
      if (type === 'capital') {
        const towns = new Set(['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Garðabær', 'Mosfellsbær', 'Seltjarnarnes'])
        const bounds = new THREE.Box3()
        for (const club of latest.current.clubs) {
          const pin = pins.get(club.id)
          if (pin && towns.has(club.city)) bounds.expandByObject(pin)
        }
        if (bounds.isEmpty()) return
        // Fit the offset badge heads and their ground tips, including on a
        // portrait screen where the horizontal field of view is narrower.
        const sphere = bounds.getBoundingSphere(new THREE.Sphere())
        const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect))
        const distance = Math.max(.45, sphere.radius / Math.sin(halfFov) * 1.22)
        moveCamera(sphere.center.clone().add(new THREE.Vector3(0, .81, .59).normalize().multiplyScalar(distance)), sphere.center)
        return
      }
      const direction = camera.position.clone().sub(controls.target)
      const distance = THREE.MathUtils.clamp(direction.length() * (type === 'in' ? .75 : 1.33), controls.minDistance, controls.maxDistance)
      moveCamera(controls.target.clone().add(direction.setLength(distance)), controls.target.clone())
    }

    function resize() {
      const width = host!.clientWidth
      const height = host!.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 1.75))
      if (!loaded) camera.position.copy(defaultPosition())
      schedule()
    }

    function hitClub(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects([...pins.values()].filter(pin => pin.visible), true)
      for (const hit of hits) {
        let object: THREE.Object3D | null = hit.object
        while (object) {
          const id = Number(object.userData.clubId)
          if (Number.isFinite(id) && pins.has(id)) return id
          object = object.parent
        }
      }
      return null
    }

    function pointerMove(event: PointerEvent) {
      tapGesture.move(event)
      if (!loaded || tapGesture.isActive || event.pointerType === 'touch') return
      const id = hitClub(event)
      renderer.domElement.style.cursor = id === null ? 'grab' : 'pointer'
      if (id === null) { if (lastHoverId !== null) setHover(null); lastHoverId = null; return }
      const club = latest.current.clubs.find(item => item.id === id)
      if (!club) return
      const rect = renderer.domElement.getBoundingClientRect()
      setHover({ club, x: Math.max(75, Math.min(rect.width - 75, event.clientX - rect.left)), y: Math.max(60, event.clientY - rect.top - 15) })
      lastHoverId = id
    }

    function pointerStart(event: PointerEvent) { tapGesture.start(event); setHover(null) }
    function pointerEnd(event: PointerEvent) {
      if (tapGesture.end(event)) {
        const id = hitClub(event)
        if (id !== null) latest.current.onChooseClub(id)
      }
    }
    function pointerLeave() { setHover(null); lastHoverId = null }
    function pointerCancel(event: PointerEvent) { tapGesture.cancel(event.pointerId); pointerLeave() }
    function interactionStart() { interacting = true; tween = null; setHover(null); schedule() }
    function interactionEnd() { interacting = false; schedule() }
    function visibilityChange() {
      if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0 }
      else schedule()
    }
    function motionChange() { reduced = media.matches; controls.enableDamping = !reduced; if (reduced && tween) { camera.position.copy(tween.to); controls.target.copy(tween.toTarget); tween = null }; schedule() }
    function lostContext(event: Event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frameId); frameId = 0; latest.current.onStatus('error') }
    function restoredContext() { contextLost = false; latest.current.onStatus(loaded ? 'ready' : 'loading'); schedule() }

    controls.addEventListener('start', interactionStart)
    controls.addEventListener('end', interactionEnd)
    controls.addEventListener('change', schedule)
    renderer.domElement.addEventListener('pointerdown', pointerStart)
    // A second pinch pointer may finish outside the canvas; observe all releases.
    document.addEventListener('pointerup', pointerEnd)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerleave', pointerLeave)
    document.addEventListener('pointercancel', pointerCancel)
    renderer.domElement.addEventListener('webglcontextlost', lostContext)
    renderer.domElement.addEventListener('webglcontextrestored', restoredContext)
    document.addEventListener('visibilitychange', visibilityChange)
    media.addEventListener('change', motionChange)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    const intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false
      if (visible) schedule()
      else { cancelAnimationFrame(frameId); frameId = 0 }
    }, { threshold: 0 })
    intersectionObserver.observe(host)
    resize()

    new GLTFLoader().load('/atlas/iceland-football.glb', gltf => {
      if (disposed) { disposeObject(gltf.scene); return }
      const importedLights: THREE.Light[] = []
      gltf.scene.traverse(object => {
        // Blender's studio lamps export in candela at this metre scale. The
        // browser has its own calibrated key and fill for the same materials.
        if (object instanceof THREE.Light) importedLights.push(object)
        if (object.userData.clubId !== undefined && object.name.startsWith('ClubPin_')) {
          const id = Number(object.userData.clubId)
          pins.set(id, object)
          const face = object.children.find(child => child.userData.atlasRole === 'badge' || /official[ _]badge/.test(child.name))
          if (face) pinFaces.set(id, face)
        }
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          // Fine printed strokes should read as ink, without magnified shadow
          // bands from the shadow map's much coarser texels.
          const printedInk = materials.every(material => /cartographic ink|Sepia engraving/i.test(material.name))
          object.castShadow = !printedInk && !(object.userData.atlasRole === 'badge' || /official[ _]badge/.test(object.name))
          object.receiveShadow = true
          for (const material of materials) {
            if ('map' in material && material.map instanceof THREE.Texture) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
          }
        }
      })
      for (const light of importedLights) { light.removeFromParent(); disposeObject(light) }
      scene.add(gltf.scene)
      scene.updateMatrixWorld(true)
      loaded = true
      controllerRef.current = { select, filter, command }
      filter(latest.current.visibleIds)
      if (latest.current.selection.length) select(latest.current.selection)
      else { camera.position.copy(defaultPosition()); controls.target.copy(defaultTarget) }
      latest.current.onStatus('ready')
      schedule()
    }, undefined, () => { if (!disposed) latest.current.onStatus('error') })

    return () => {
      disposed = true
      controllerRef.current = null
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', visibilityChange)
      media.removeEventListener('change', motionChange)
      renderer.domElement.removeEventListener('pointerdown', pointerStart)
      document.removeEventListener('pointerup', pointerEnd)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerleave', pointerLeave)
      document.removeEventListener('pointercancel', pointerCancel)
      renderer.domElement.removeEventListener('webglcontextlost', lostContext)
      renderer.domElement.removeEventListener('webglcontextrestored', restoredContext)
      controls.removeEventListener('start', interactionStart)
      controls.removeEventListener('end', interactionEnd)
      controls.removeEventListener('change', schedule)
      controls.dispose()
      disposeObject(scene)
      scene.clear()
      renderer.renderLists.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  useEffect(() => { controllerRef.current?.select(props.selection) }, [props.selection])
  useEffect(() => { controllerRef.current?.filter(props.visibleIds) }, [props.visibleIds])
  useEffect(() => { if (props.cameraCommand.sequence) controllerRef.current?.command(props.cameraCommand.type) }, [props.cameraCommand])

  return <div ref={hostRef} className={styles.canvas}>{hover && <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>{hover.club.name}<small>{hover.club.stadium}</small></div>}</div>
}
