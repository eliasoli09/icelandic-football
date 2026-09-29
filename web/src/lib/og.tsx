import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 }

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

export const C = {
  bg: '#0c1220',
  surface: '#141c2e',
  border: '#253045',
  text: '#e8ecf4',
  muted: '#8b96ab',
  accent: '#4d8dff',
  green: '#22c58b',
  red: '#f0605b',
}

/** Outer card frame shared by all share images. */
export function Frame({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: string
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(135deg, ${C.bg} 0%, #101a30 60%, #0d2140 100%)`,
        color: C.text,
        fontFamily: 'Inter',
        padding: 56,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', fontSize: 34 }}>⚽</div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>Besta spáin</div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>islensk-fotbolti.vercel.app</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        {children}
      </div>
      {footer ? (
        <div style={{ display: 'flex', fontSize: 20, color: C.muted }}>{footer}</div>
      ) : null}
    </div>
  )
}

export function Bar({ pHome, pDraw, pAway }: { pHome: number; pDraw: number; pAway: number }) {
  const pct = (n: number) => Math.round(n * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', width: '100%', height: 54, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${pct(pHome)}%`, background: C.accent, fontSize: 26, fontWeight: 700, color: '#fff', minWidth: 70 }}>
          {pct(pHome)}%
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${pct(pDraw)}%`, background: '#2a3550', fontSize: 26, fontWeight: 700, color: C.muted, minWidth: 70 }}>
          {pct(pDraw)}%
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${pct(pAway)}%`, background: C.green, fontSize: 26, fontWeight: 700, color: '#fff', minWidth: 70 }}>
          {pct(pAway)}%
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: C.muted, marginTop: 10 }}>
        <div style={{ display: 'flex' }}>Heimasigur</div>
        <div style={{ display: 'flex' }}>Jafntefli</div>
        <div style={{ display: 'flex' }}>Útisigur</div>
      </div>
    </div>
  )
}
