'use client'

import { useEffect, useRef } from 'react'
import { createStarPatches } from '../Uefa/starGeometry'
import { StarBall } from './TenaballScene'
import { startStarBallMotion } from './starBallMotion'
import styles from './Tenaball.module.css'

/** A real shaded sphere: the star texture wraps around its surface as it turns. */
export function RotatingStarBall({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = host.current!
    let disposed = false
    let release = () => {}
    void import('three').then(THREE => {
      if (disposed) return
      // A procedural texture follows the same spherical star geometry as the existing theme.
      const textureCanvas = document.createElement('canvas')
      textureCanvas.width = 2048
      textureCanvas.height = 1024
      const ctx = textureCanvas.getContext('2d')
      if (!ctx) return
      const w = textureCanvas.width, h = textureCanvas.height
      ctx.fillStyle = '#071952'
      ctx.fillRect(0, 0, w, h)
      for (const patch of createStarPatches()) {
        let previousX: number | null = null
        const points = patch.points.map(([x, y, z]) => {
          let u = (Math.atan2(z, x) / (2 * Math.PI) + .5) * w
          if (previousX !== null) {
            while (u - previousX > w / 2) u -= w
            while (u - previousX < -w / 2) u += w
          }
          previousX = u
          return [u, Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI * h]
        })
        for (const offset of [-w, 0, w]) {
          ctx.beginPath()
          points.forEach(([x, y], i) => i ? ctx.lineTo(x + offset, y) : ctx.moveTo(x + offset, y))
          ctx.closePath()
          ctx.fillStyle = '#f0f7ff'
          ctx.fill()
          ctx.strokeStyle = '#a6cdfc'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      } catch { return } // Preserve the static star-ball when WebGL is unavailable.
      const texture = new THREE.CanvasTexture(textureCanvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      const geometry = new THREE.SphereGeometry(1, 64, 48)
      const material = new THREE.MeshStandardMaterial({
        map: texture, metalness: .25, roughness: .27,
        emissive: '#1237a0', emissiveMap: texture, emissiveIntensity: .14,
      })
      const ball = new THREE.Mesh(geometry, material)
      const scene = new THREE.Scene()
      scene.add(ball)
      scene.add(new THREE.HemisphereLight('#eaf6ff', '#18245c', 1.8))
      const key = new THREE.DirectionalLight('#ffffff', 3.4)
      key.position.set(-3, 4, 5)
      scene.add(key)
      const rim = new THREE.DirectionalLight('#19c9ff', 3)
      rim.position.set(3, 1, 0)
      scene.add(rim)
      const violet = new THREE.DirectionalLight('#824dff', 2)
      violet.position.set(-3, -1, -2)
      scene.add(violet)
      const camera = new THREE.PerspectiveCamera(32, 1, .1, 20)
      camera.position.set(0, 0, 4.2)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
      renderer.setClearColor(0, 0)
      renderer.domElement.setAttribute('aria-hidden', 'true')
      root.appendChild(renderer.domElement)
      const size = () => {
        const width = root.clientWidth || 100, height = root.clientHeight || 100
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      size()
      const motion = startStarBallMotion(root, angle => {
        ball.rotation.set(.24 + .08 * Math.sin(angle), angle + .3, -.12)
        ball.position.y = .04 * Math.sin(angle)
        renderer.render(scene, camera)
      })
      root.dataset.ready = 'true'
      const observer = new ResizeObserver(() => { size(); motion.redraw() })
      observer.observe(root)
      const lost = () => { motion.dispose(); root.dataset.ready = 'false' }
      renderer.domElement.addEventListener('webglcontextlost', lost)
      release = () => {
        motion.dispose()
        observer.disconnect()
        renderer.domElement.removeEventListener('webglcontextlost', lost)
        geometry.dispose()
        material.dispose()
        texture.dispose()
        renderer.dispose()
        renderer.domElement.remove()
        delete root.dataset.ready
      }
      if (disposed) release()
    }).catch(() => { release() })
    return () => { disposed = true; release() }
  }, [])
  return <div ref={host} className={`${className ?? ''} ${styles.rotatingBall}`} aria-hidden="true">
    <span className={styles.ballAura}/>
    <span className={styles.ballPedestal}/>
    <StarBall className={styles.ballFallback}/>
  </div>
}
