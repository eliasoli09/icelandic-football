// Copies MediaPipe's WASM runtime into public/ so the offside detector loads it
// from our own origin instead of a third-party CDN. Runs on `npm install`.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = join(root, 'public/mediapipe')

if (!existsSync(src)) {
  console.warn('[copy-mediapipe] @mediapipe/tasks-vision not installed — skipping')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  cpSync(join(src, f), join(dest, f))
}
console.log('[copy-mediapipe] copied WASM runtime to public/mediapipe')
