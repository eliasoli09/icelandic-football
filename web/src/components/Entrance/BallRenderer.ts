import { createFootballMesh, FOOTBALL_CREST, FOOTBALL_VERTEX_STRIDE, type FootballMesh } from './footballMesh'

export interface BallInstance {
  x: number
  y: number
  radius: number
  rotationX: number
  rotationY: number
  rotationZ: number
  alpha: number
  logo?: boolean
}

const MAX_FOLLOWERS = 240
const INSTANCE_STRIDE = 9

const vertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aPanel;
layout(location = 3) in vec3 aCenterRadius;
layout(location = 4) in vec4 aRotation;
layout(location = 5) in vec2 aAppearance;
uniform vec2 uViewport;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vPanel;
flat out vec4 vRotation;
flat out vec2 vAppearance;

vec3 rotate(vec3 point, vec4 q) {
  return point + 2.0 * cross(q.xyz, cross(q.xyz, point) + q.w * point);
}

void main() {
  vec3 position = rotate(aPosition, aRotation);
  vec2 screen = aCenterRadius.xy + vec2(position.x, -position.y) * aCenterRadius.z;
  gl_Position = vec4(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0, -position.z * 0.5, 1.0);
  vPosition = aPosition;
  vNormal = aNormal;
  vPanel = aPanel;
  vRotation = aRotation;
  vAppearance = aAppearance;
}
`

const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D uLogo;
uniform vec2 uLogoTexel;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vPanel;
flat in vec4 vRotation;
flat in vec2 vAppearance;
out vec4 outColor;

vec3 rotate(vec3 point, vec4 q) {
  return point + 2.0 * cross(q.xyz, cross(q.xyz, point) + q.w * point);
}

float crest(vec2 uv) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uLogo, uv).a;
}

float softbox(vec3 reflection, vec3 direction, vec2 size) {
  vec3 axis = normalize(direction);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), axis));
  vec3 up = cross(axis, right);
  float facing = dot(reflection, axis);
  vec2 plane = abs(vec2(dot(reflection, right), dot(reflection, up))) / (max(0.05, facing) * size);
  vec2 square = plane * plane;
  return exp(-dot(square, square)) * smoothstep(0.05, 0.25, facing);
}

vec3 environment(vec3 reflection) {
  float sky = smoothstep(-0.7, 0.8, reflection.y);
  vec3 light = mix(vec3(0.028, 0.022, 0.011), vec3(0.28, 0.26, 0.19), sky);
  light += vec3(2.4, 2.15, 1.65) * softbox(reflection, vec3(-0.8, 0.8, 1.3), vec2(0.28, 0.65));
  light += vec3(1.8, 1.7, 1.32) * softbox(reflection, vec3(1.0, 0.12, 0.55), vec2(0.075, 0.8));
  light += vec3(0.6, 0.43, 0.16) * softbox(reflection, vec3(-0.25, -0.9, 0.9), vec2(0.7, 0.10));
  light += vec3(0.45, 0.44, 0.35) * softbox(reflection, vec3(0.1, 1.1, -0.5), vec2(1.0, 0.18));
  return light;
}

vec3 filmic(vec3 color) {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 localNormal = normalize(vNormal);
  float stamp = 0.0;
  if (vAppearance.y > 0.5 && vPosition.z > 0.35) {
    // Only the supplied alpha channel shapes the metal. No logo RGB is used.
    vec2 uv = (vPosition.xy - vec2(0.0, ${FOOTBALL_CREST.centerY})) / ${FOOTBALL_CREST.scale} + 0.5;
    vec2 texel = uLogoTexel * 1.6;
    float front = smoothstep(0.35, 0.65, vPosition.z);
    stamp = crest(uv) * front;
    vec2 slope = vec2(crest(uv + vec2(texel.x, 0.0)) - crest(uv - vec2(texel.x, 0.0)),
                      crest(uv + vec2(0.0, texel.y)) - crest(uv - vec2(0.0, texel.y)));
    localNormal = normalize(localNormal - vec3(slope * 0.56 * front, 0.0));
  }

  vec3 normal = normalize(rotate(localNormal, vRotation));
  vec3 view = vec3(0.0, 0.0, 1.0);
  float facing = max(dot(normal, view), 0.0);
  vec3 reflection = reflect(-view, normal);
  vec3 gold = vec3(1.0, 0.59, 0.14);
  vec3 fresnel = mix(gold, vec3(1.0), pow(1.0 - facing, 5.0));
  float lambert = max(dot(normal, normalize(vec3(-0.65, 0.9, 1.1))), 0.0);
  vec3 color = fresnel * environment(reflection);
  color += vec3(0.12, 0.055, 0.007) * (0.18 + lambert);
  color *= mix(0.94, 1.0, step(5.5, vPanel.y));
  float aa = max(fwidth(vPanel.x) * 0.6, 0.0003);
  // Subpixel seams disappear on followers; widen their recessed shading so
  // the small objects remain recognizable footballs while they dissolve.
  float seamWidth = vAppearance.y > 0.5 ? 0.009 : 0.034;
  float groove = 1.0 - smoothstep(0.002 - aa, seamWidth + aa, vPanel.x);
  color *= 1.0 - groove * 0.73;
  color = pow(filmic(color), vec3(1.0 / 2.2));
  // Burnishing darkens the same gold hue while the raised outline still catches
  // the studio lights through its perturbed surface normal.
  color *= 1.0 - stamp * 0.28;
  float alpha = clamp(vAppearance.x, 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}
`

interface DrawMesh {
  vao: WebGLVertexArrayObject
  count: number
}

/** Two bounded draws: a shared instanced mesh for followers, then the hero. */
export class BallRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly buffers: WebGLBuffer[] = []
  private readonly vaos: WebGLVertexArrayObject[] = []
  private readonly shaders: WebGLShader[] = []
  private readonly followerData = new Float32Array(MAX_FOLLOWERS * INSTANCE_STRIDE)
  private readonly heroData = new Float32Array(INSTANCE_STRIDE)
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private instanceBuffer: WebGLBuffer | null = null
  private viewportUniform: WebGLUniformLocation | null = null
  private hero: DrawMesh | null = null
  private followers: DrawMesh | null = null
  private width = 1
  private height = 1
  private disposed = false

  constructor(canvas: HTMLCanvasElement, logo: HTMLImageElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('WebGL2 is unavailable')
    this.gl = gl
    this.canvas = canvas
    try {
      const program = gl.createProgram()
      if (!program) throw new Error('Could not allocate the football shader program')
      this.program = program
      const vertex = this.compile(gl.VERTEX_SHADER, vertexShader)
      const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentShader)
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Football shader link failed: ${gl.getProgramInfoLog(program)}`)
      for (const shader of this.shaders) { gl.detachShader(program, shader); gl.deleteShader(shader) }
      this.shaders.length = 0
      gl.useProgram(program)
      this.viewportUniform = gl.getUniformLocation(program, 'uViewport')
      this.instanceBuffer = this.buffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.followerData.byteLength, gl.DYNAMIC_DRAW)
      this.hero = this.upload(createFootballMesh('hero'))
      this.followers = this.upload(createFootballMesh('follower'))

      this.texture = gl.createTexture()
      if (!this.texture) throw new Error('Could not allocate the football crest texture')
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logo)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(gl.getUniformLocation(program, 'uLogo'), 0)
      gl.uniform2f(gl.getUniformLocation(program, 'uLogoTexel'), 1 / Math.max(1, logo.naturalWidth || logo.width), 1 / Math.max(1, logo.naturalHeight || logo.height))
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.BACK)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.clearColor(0, 0, 0, 0)
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Could not allocate a football shader')
    this.shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Football shader compile failed: ${gl.getShaderInfoLog(shader)}`)
    return shader
  }

  private buffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Could not allocate football geometry')
    this.buffers.push(buffer)
    return buffer
  }

  private upload(mesh: FootballMesh): DrawMesh {
    const gl = this.gl
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Could not allocate football vertex state')
    this.vaos.push(vao)
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer())
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    const stride = FOOTBALL_VERTEX_STRIDE * Float32Array.BYTES_PER_ELEMENT
    for (const [location, size, offset] of [[0, 3, 0], [1, 3, 3], [2, 2, 6]]) {
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4)
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer())
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    for (const [location, size, offset] of [[3, 3, 0], [4, 4, 3], [5, 2, 7]]) {
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, INSTANCE_STRIDE * 4, offset * 4)
      gl.vertexAttribDivisor(location, 1)
    }
    gl.bindVertexArray(null)
    return { vao, count: mesh.indices.length }
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return
    this.width = Number.isFinite(width) ? Math.max(1, width) : 1
    this.height = Number.isFinite(height) ? Math.max(1, height) : 1
    const requested = Number.isFinite(dpr) ? Math.max(0.5, dpr) : 1
    const scale = Math.min(requested, 2, 4096 / this.width, 4096 / this.height, Math.sqrt(5_000_000 / (this.width * this.height)))
    const pixelWidth = Math.max(1, Math.round(this.width * scale))
    const pixelHeight = Math.max(1, Math.round(this.height * scale))
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight
    this.gl.viewport(0, 0, pixelWidth, pixelHeight)
  }

  private writeInstance(target: Float32Array, offset: number, ball: BallInstance): void {
    const sx = Math.sin(ball.rotationX / 2), cx = Math.cos(ball.rotationX / 2)
    const sy = Math.sin(ball.rotationY / 2), cy = Math.cos(ball.rotationY / 2)
    const sz = Math.sin(ball.rotationZ / 2), cz = Math.cos(ball.rotationZ / 2)
    target[offset] = ball.x
    target[offset + 1] = ball.y
    target[offset + 2] = ball.radius
    target[offset + 3] = sx * cy * cz + cx * sy * sz
    target[offset + 4] = cx * sy * cz - sx * cy * sz
    target[offset + 5] = cx * cy * sz + sx * sy * cz
    target[offset + 6] = cx * cy * cz - sx * sy * sz
    target[offset + 7] = Math.min(1, Math.max(0, ball.alpha))
    target[offset + 8] = ball.logo ? 1 : 0
  }

  render(balls: readonly BallInstance[]): void {
    if (this.disposed || this.gl.isContextLost()) return
    const gl = this.gl
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.uniform2f(this.viewportUniform, this.width, this.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    let followerCount = 0
    let hero: BallInstance | undefined
    for (let i = 0; i < Math.min(balls.length, MAX_FOLLOWERS + 1); i++) {
      const ball = balls[i]
      if (!(ball.radius > 0 && ball.alpha > 0) || !Number.isFinite(ball.x + ball.y + ball.radius + ball.rotationX + ball.rotationY + ball.rotationZ + ball.alpha)) continue
      if (ball.x + ball.radius < 0 || ball.x - ball.radius > this.width || ball.y + ball.radius < 0 || ball.y - ball.radius > this.height) continue
      if (ball.logo && !hero) hero = ball
      else if (followerCount < MAX_FOLLOWERS) this.writeInstance(this.followerData, followerCount++ * INSTANCE_STRIDE, ball)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    if (followerCount > 0 && this.followers) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.followerData, 0, followerCount * INSTANCE_STRIDE)
      gl.bindVertexArray(this.followers.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, this.followers.count, gl.UNSIGNED_SHORT, 0, followerCount)
    }
    if (hero && this.hero) {
      this.writeInstance(this.heroData, 0, hero)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.heroData)
      gl.clear(gl.DEPTH_BUFFER_BIT)
      gl.bindVertexArray(this.hero.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, this.hero.count, gl.UNSIGNED_SHORT, 0, 1)
    }
    gl.bindVertexArray(null)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    for (const vao of this.vaos) gl.deleteVertexArray(vao)
    for (const buffer of this.buffers) gl.deleteBuffer(buffer)
    for (const shader of this.shaders) gl.deleteShader(shader)
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.program) gl.deleteProgram(this.program)
    this.vaos.length = 0
    this.buffers.length = 0
    this.shaders.length = 0
    this.program = null
    this.texture = null
    this.instanceBuffer = null
    this.hero = null
    this.followers = null
  }
}
