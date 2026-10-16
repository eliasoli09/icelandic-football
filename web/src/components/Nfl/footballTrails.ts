import { footballRadius } from './footballSurface'

type TrailKind = 'red' | 'blue' | 'sweep'

/** World-space paths stay outside the ball so depth testing provides real wrapping. */
export function trailPoint(t: number, kind: TrailKind) {
  const a = t * Math.PI * 2
  if (kind === 'sweep') {
    const y = .65 * Math.sin(a + .4)
    const r = footballRadius(y) + .11
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r }
  }
  const longitude = (kind === 'red' ? .83 : 2.32) + .28 * Math.sin(a * 2)
  const radial = 1.12 * Math.cos(a)
  return { x: radial * Math.cos(longitude), y: 1.82 * Math.sin(a), z: radial * Math.sin(longitude) }
}

export function createFootballTrails(THREE: typeof import('three')) {
  const group = new THREE.Group()
  const materials: InstanceType<typeof THREE.ShaderMaterial>[] = []
  const lights: { orbit: InstanceType<typeof THREE.Group>; curve: InstanceType<typeof THREE.CatmullRomCurve3>; flare: InstanceType<typeof THREE.Sprite>; light: InstanceType<typeof THREE.PointLight>; speed: number; phase: number }[] = []
  const flareCanvas = document.createElement('canvas'); flareCanvas.width = 128; flareCanvas.height = 128
  const ctx = flareCanvas.getContext('2d')!
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  glow.addColorStop(0, '#ffffffff'); glow.addColorStop(.05, '#ffffffff')
  glow.addColorStop(.16, '#ffffffaa'); glow.addColorStop(.4, '#ffffff35'); glow.addColorStop(1, '#ffffff00')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128)
  const flareTexture = new THREE.CanvasTexture(flareCanvas)
  const flareMaterials: InstanceType<typeof THREE.SpriteMaterial>[] = []
  for (const [index, kind] of (['red', 'blue', 'sweep'] as const).entries()) {
    const orbit = new THREE.Group(); group.add(orbit)
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 256 }, (_, i) => {
      const p = trailPoint(i / 256, kind)
      return new THREE.Vector3(p.x, p.y, p.z)
    }), true)
    const color = new THREE.Color(kind === 'red' ? '#ff1245' : '#009dff')
    const speed = kind === 'red' ? .075 : -.06
    const phase = index * .27 + .08
    for (const [radius, opacity, white] of [[.009, 1, .85], [.025, .55, 0], [.06, .12, 0], [.115, .025, 0]]) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uTime: { value: 0 }, uSpeed: { value: speed }, uPhase: { value: phase }, uOpacity: { value: opacity * (kind === 'sweep' ? .65 : 1) }, uWhite: { value: white } },
        vertexShader: `varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uTime, uSpeed, uPhase, uOpacity, uWhite; varying vec2 vUv;
          void main() {
            float distanceBehind = fract(uTime * uSpeed + uPhase - vUv.x);
            float comet = exp(-distanceBehind * 9.0);
            float brightness = 0.55 + comet * 0.45;
            vec3 color = mix(uColor, vec3(1.0), uWhite * (0.6 + comet * 0.4));
            gl_FragColor = vec4(color, uOpacity * brightness);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false,
      })
      materials.push(material)
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 256, radius, 8, true), material)
      orbit.add(tube)
    }
    if (kind !== 'sweep') {
      const flareMaterial = new THREE.SpriteMaterial({ map: flareTexture, color: kind === 'red' ? '#ffb0bd' : '#a4deff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false })
      flareMaterials.push(flareMaterial)
      const flare = new THREE.Sprite(flareMaterial); flare.scale.setScalar(.45); orbit.add(flare)
      const light = new THREE.PointLight(color, .65, 1.6, 2); orbit.add(light)
      lights.push({ orbit, curve, flare, light, speed, phase })
    }
  }
  return {
    group,
    update(time: number) {
      materials.forEach(material => { material.uniforms.uTime.value = time })
      // Slow precession complements the ball's continuous axial spin.
      group.rotation.y = Math.sin(time * .18) * .18
      lights.forEach(({ curve, flare, light, speed, phase }) => {
        const t = ((time * speed + phase) % 1 + 1) % 1
        const p = curve.getPointAt(t); flare.position.copy(p); light.position.copy(p)
      })
    },
    dispose() {
      materials.forEach(material => material.dispose())
      flareMaterials.forEach(material => material.dispose())
      flareTexture.dispose()
    },
  }
}
