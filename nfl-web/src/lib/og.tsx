import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_NAME, SITE_URL } from './site'

/** Share images: 1200×630 cards in the stadium colours. */

export const OG_SIZE = { width: 1200, height: 630 }

/** Satori fetches every <img>, so site-relative logos need the full origin. */
export const ogSrc = (src: string) => new URL(src, SITE_URL).href

let fontsCache: { name: string; data: Buffer; weight: 400 | 700 }[] | null = null
export function ogFonts() {
  if (!fontsCache) {
    const dir = join(process.cwd(), 'src', 'assets')
    fontsCache = [
      { name: 'Inter', data: readFileSync(join(dir, 'Inter-Regular.ttf')), weight: 400 as const },
      { name: 'Inter', data: readFileSync(join(dir, 'Inter-Bold.ttf')), weight: 700 as const },
    ]
  }
  return fontsCache
}

export const C = { bg: '#020c1d', panel: '#061930', border: '#16456b', text: '#f4f7ff', muted: '#a9bddf', red: '#ff173e', cyan: '#08b8ff' }

/** Navy card with a red kicker and the site name along the bottom. */
export function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: `linear-gradient(160deg, ${C.panel} 0%, ${C.bg} 70%)`, color: C.text, fontFamily: 'Inter', padding: '56px 64px' }}>
      <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 6, color: C.red }}>{kicker}</div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${C.border}`, paddingTop: 22, fontSize: 26 }}>
        <span style={{ fontWeight: 700 }}>{SITE_NAME}</span>
        <span style={{ color: C.muted }}>{new URL(SITE_URL).host}</span>
      </div>
    </div>
  )
}
