import type { CSSProperties, ReactNode } from 'react'
import { GlyphMark } from './Glyphs'
import { T, type ClubTheme, type Effect } from './themes'

/** When the crossing logo passes x% of the bar, in ms from the start. */
export const crossAt = (x: number) => Math.round(T.cross + ((T.crossEnd - T.cross) * (x + 20)) / 128)

/** A small seeded generator, so a club's banner looks the same every time. */
function rng(seed: string) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

type V = CSSProperties & Record<`--${string}`, string | number>
const ms = (n: number) => `${Math.round(n)}ms`
const pct = (n: number) => `${n}%`
const px = (n: number) => `${n}px`

/** One placed piece: a glyph or any node, with its animation class and variables. */
function P({ cls, v, children }: { cls: string; v: V; children?: ReactNode }) {
  return <span className={`cel-p ${cls}`} style={v}>{children}</span>
}

export interface FxOut {
  /** Pieces over the bar (clipped to it or not). */
  over?: ReactNode
  clip?: ReactNode
  /** Pieces under the word. */
  under?: ReactNode
  /** Extra animations for the whole bar: shakes and beats. */
  stage?: string[]
}

const shake = (d: number) => `cel-shake 380ms ease-out ${d}ms both`
const beat = (d: number) => `cel-beat 260ms ease-out ${d}ms both`

/** Bits thrown from where the logo passes: feathers, gold, sparks. */
function trail(r: () => number, n: number, from: number, to: number, node: (i: number) => ReactNode, o: { color: string | ((i: number) => string); size?: [number, number]; dy?: [number, number]; dx?: [number, number]; spin?: number; t?: [number, number]; cls?: string; y?: [number, number] }) {
  return Array.from({ length: n }, (_, i) => {
    const x = from + (to - from) * (i / Math.max(1, n - 1)) + (r() - 0.5) * 6
    const [s0, s1] = o.size ?? [10, 18], [dy0, dy1] = o.dy ?? [-60, 60], [dx0, dx1] = o.dx ?? [-30, 30], [t0, t1] = o.t ?? [1100, 1900], [y0, y1] = o.y ?? [25, 70]
    return (
      <P key={i} cls={o.cls ?? 'fly'} v={{ '--x': pct(x), '--y': pct(y0 + r() * (y1 - y0)), '--s': px(s0 + r() * (s1 - s0)), '--dx': px(dx0 + r() * (dx1 - dx0)), '--dy': px(dy0 + r() * (dy1 - dy0)), '--r': `${(r() - 0.5) * (o.spin ?? 360)}deg`, '--d': ms(crossAt(x) + r() * 120), '--t': ms(t0 + r() * (t1 - t0)), '--pc': typeof o.color === 'function' ? o.color(i) : o.color }}>
        {node(i)}
      </P>
    )
  })
}

const sparkle = <svg viewBox="0 0 24 24"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="currentColor" /></svg>
const dot = <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor" /></svg>
const flake = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" /></svg>

/** Claw marks: deep gashes behind the word, or thin cuts through its letters. */
function claws(th: ClubTheme, x0: number, cut = false, n = 3, gap = 5.5): ReactNode {
  return (
    <svg className="draw" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + i * gap
        const d = `M${x + 6} -10 L${x - 6} 110`
        return (
          <g key={i} style={{ '--d': ms(crossAt(x) + 40 + i * 50), '--t': '170ms' } as V}>
            {cut
              ? <path d={d} pathLength={1} fill="none" stroke={th.c1} strokeLinecap="round" style={{ strokeWidth: 'calc(var(--h) * .02)' }} />
              : <>
                <path d={d} pathLength={1} fill="none" stroke={th.ink} strokeLinecap="round" style={{ strokeWidth: 'calc(var(--h) * .13)' }} opacity={0.85} />
                <path d={d} pathLength={1} fill="none" stroke={th.c2} strokeLinecap="round" transform="translate(.9 0)" style={{ strokeWidth: 'calc(var(--h) * .025)' }} />
              </>}
          </g>
        )
      })}
    </svg>
  )
}

/** The effect each club's logo leaves behind it. */
export function effect(kind: Effect, th: ClubTheme, abbr: string): FxOut {
  const r = rng(abbr + kind)
  switch (kind) {
    case 'claws': return {
      under: claws(th, 64),
      clip: claws(th, 53, true, 3, 3.2),
      over: trail(r, 10, 40, 98, () => sparkle, { color: th.c2, size: [6, 12], dy: [-50, -20], dx: [-10, 30], t: [700, 1100] }),
      stage: [shake(crossAt(55))],
    }
    case 'eyes': return {
      under: claws(th, 80),
      clip: claws(th, 58, true),
      over: [44, 50].map((x, i) => (
        <P key={i} cls="blink" v={{ '--x': pct(88 + i * 5), '--y': pct(32), '--s': 'calc(var(--h) * .28)', '--d': ms(1500 + i * 30), '--t': '800ms', '--pc': '#7fe3ff', filter: 'drop-shadow(0 0 6px #7fe3ff)' }}><GlyphMark glyph="eye" size="100%" /></P>
      )),
    }
    case 'stripes': return {
      under: Array.from({ length: 7 }, (_, i) => {
        const x = 40 + i * 9
        return <span key={i} className="grow" style={{ position: 'absolute', left: pct(x), top: '-10%', width: 'calc(var(--h) * .22)', height: '120%', background: th.ink, clipPath: 'polygon(40% 0, 100% 0, 70% 30%, 95% 55%, 55% 100%, 20% 100%, 50% 60%, 10% 35%)', opacity: 0.85, '--d': ms(crossAt(x)), '--t': '260ms', transform: `skewX(${-12 + r() * 10}deg)` } as V} />
      }),
      over: trail(r, 6, 40, 96, () => dot, { color: th.ink, size: [4, 8], t: [500, 800] }),
    }
    case 'wind': return {
      clip: Array.from({ length: 12 }, (_, i) => <span key={i} className="cel-p streak" style={{ '--x': pct(-10 + r() * 30), '--y': pct(12 + r() * 76), '--w': pct(20 + r() * 30), '--d': ms(500 + i * 110 + r() * 80), '--t': ms(520 + r() * 240), '--dx': '480%', '--pc': i % 3 === 0 ? th.c2 : 'rgb(255 255 255 / .8)' } as V} />),
    }
    case 'roar': return {
      over: [0, 1, 2, 3].map((i) => <span key={i} className="cel-p ring" style={{ '--x': '30%', '--y': '50%', '--s': 'var(--h)', '--d': ms(1250 + i * 170), '--t': '1000ms', '--pc': i % 2 ? th.c2 : '#fff' } as V} />),
      stage: [shake(1260), shake(1600)],
    }
    case 'snow': return {
      over: Array.from({ length: 26 }, (_, i) => <P key={i} cls="fall" v={{ '--x': pct(r() * 100), '--y': px(-50 - r() * 30), '--s': px(7 + r() * 9), '--dx': px((r() - 0.5) * 40), '--dy': px(150 + r() * 40), '--r': `${(r() - 0.5) * 300}deg`, '--d': ms(600 + r() * 2200), '--t': ms(2000 + r() * 900), '--pc': i % 4 ? '#ffffff' : th.c2 }}>{flake}</P>),
    }
    case 'skol': return {
      over: [0, 1, 2].map((i) => <span key={i} className="say" style={{ left: pct(46 + i * 18), top: 'calc(var(--h) * -.62)', fontSize: 'calc(var(--h) * .42)', '--d': ms(1350 + i * 620), '--pc': th.c2 } as V}>SKOL</span>),
      clip: [0, 1, 2].map((i) => <span key={i} className="flash" style={{ '--d': ms(1350 + i * 620), '--pc': th.c2, '--o': '.45' } as V} />),
      stage: [beat(1350), beat(1970), beat(2590)],
    }
    case 'bolt': return {
      over: [[66, 1150, 1.25], [86, 1700, 0.85]].map(([x, d, k], i) => (
        <svg key={i} className="draw" viewBox="0 0 40 100" style={{ position: 'absolute', left: pct(x), top: 'calc(var(--h) * -1.1)', width: `calc(var(--h) * ${0.5 * k})`, height: `calc(var(--h) * ${2.1 * k})`, overflow: 'visible', filter: `drop-shadow(0 0 8px ${th.c2})`, '--d': ms(d), '--t': '140ms' } as V}>
          <polyline pathLength={1} points="24,0 8,46 22,46 6,100" fill="none" stroke={th.c2} strokeWidth={6} strokeLinejoin="round" />
          <polyline pathLength={1} points="24,0 8,46 22,46 6,100" fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
        </svg>
      )),
      clip: <><span className="flash" style={{ '--d': '1180ms', '--pc': '#fff', '--o': '.7' } as V} /><span className="flash" style={{ '--d': '1720ms', '--pc': th.c2, '--o': '.4' } as V} /></>,
      stage: [shake(1180)],
    }
    case 'starburst': return {
      under: <span className="cel-p spin" style={{ '--x': 'calc(30% - var(--h))', '--y': 'calc(50% - var(--h))', '--s': 'calc(var(--h) * 2)', '--d': '1100ms', '--t': '6000ms', background: `repeating-conic-gradient(from 0deg, rgb(255 255 255 / .22) 0 8deg, transparent 8deg 22deg)`, borderRadius: '50%', maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)' } as V} />,
      over: trail(r, 14, 30, 98, () => sparkle, { color: (i) => (i % 3 ? '#fff' : th.c2), size: [8, 16], cls: 'pop', dy: [0, 0], dx: [0, 0], y: [5, 80], t: [1600, 2600] }),
    }
    case 'arrow': return {
      clip: [0, 1, 2].map((i) => (
        <span key={i} className="cel-p streak" style={{ '--x': '-20%', '--y': pct(25 + i * 25), '--w': '40%', '--d': ms(1250 + i * 90), '--t': '420ms', '--dx': '400%', '--pc': th.c2, height: 'calc(var(--h) * .08)' } as V} />
      )),
      over: [0, 1, 2].map((i) => <P key={i} cls="fly" v={{ '--x': '30%', '--y': pct(18 + i * 26), '--s': 'calc(var(--h) * .3)', '--dx': 'calc(var(--bw) * .75)', '--dy': '0px', '--r': '0deg', '--d': ms(1250 + i * 90), '--t': '520ms', '--pc': th.c2, transform: 'rotate(90deg)' }}><svg viewBox="0 0 24 24" style={{ transform: 'rotate(90deg)' }}><path d="M12 1l8 21-8-5-8 5z" fill="currentColor" /></svg></P>),
      stage: [beat(1700), beat(1950)],
    }
    case 'cannon': return {
      over: [[2, 1200], [96, 1650], [50, 2100]].flatMap(([x, d], k) => Array.from({ length: 9 }, (_, i) => (
        <P key={`${k}${i}`} cls="fly" v={{ '--x': pct(x), '--y': pct(40 + r() * 20), '--s': px(16 + r() * 22), '--dx': px((r() - 0.5) * 120), '--dy': px(-30 - r() * 70), '--r': '0deg', '--d': ms(d + r() * 90), '--t': ms(1100 + r() * 700), '--pc': i < 2 ? '#FF7900' : 'rgb(220 220 220 / .75)', filter: 'blur(1.5px)' }}>{dot}</P>
      ))),
      clip: [1200, 1650, 2100].map((d) => <span key={d} className="flash" style={{ '--d': ms(d), '--pc': '#FF7900', '--o': '.5' } as V} />),
      stage: [shake(1200), shake(1650), shake(2100)],
    }
    case 'towel': return {
      over: <>
        <P cls="sway" v={{ '--x': '86%', '--y': 'calc(var(--h) * -1.1)', '--s': 'calc(var(--h) * .8)', '--dx': '10px', '--dy': '0px', '--r': '25deg', '--d': '1200ms', '--t': '3000ms' }}>
          <svg viewBox="0 0 24 24"><path d="M3 4c4-2 8 2 12 0s5-1 6 0v14c-1-1-2-2-6 0s-8-2-12 0z" fill="#FFB612" /><text x="12" y="13" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#101820">TERRIBLE</text></svg>
        </P>
        {trail(r, 16, 34, 98, () => dot, { color: (i) => ['#FFB612', '#C8102E', '#00539B', '#fff'][i % 4], size: [5, 9], dy: [-70, -20], t: [900, 1500] })}
      </>,
    }
    case 'gold': return {
      over: <>{trail(r, 18, 36, 98, () => <GlyphMark glyph="nugget" size="100%" />, { color: th.c2, size: [8, 15], dy: [-80, -30], dx: [-30, 30], t: [1100, 1700] })}
        {trail(r, 12, 36, 98, () => sparkle, { color: '#fff3c4', size: [8, 14], cls: 'pop', dy: [0, 0], dx: [0, 0], y: [0, 90], t: [1500, 2400] })}</>,
    }
    case 'wave': return {
      clip: <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ position: 'absolute', left: '-100%', bottom: 0, width: '200%', height: '70%', animation: 'cel-streak 1500ms ease-out 900ms both', '--dx': '100%' } as V}>
        <path d="M0 18 Q12 6 25 18 T50 18 T75 18 T100 18 T125 18 T150 18 T175 18 T200 18 V40 H0z" fill="rgb(255 255 255 / .22)" />
        <path d="M0 24 Q12 14 25 24 T50 24 T75 24 T100 24 T125 24 T150 24 T175 24 T200 24 V40 H0z" fill={th.c2} opacity={0.55} />
      </svg>,
      over: trail(r, 12, 40, 98, () => dot, { color: '#e8fbff', size: [4, 8], dy: [-40, -10], t: [700, 1200], y: [55, 80] }),
      under: <span className="cel-p spin" style={{ '--x': 'calc(30% - var(--h) * .9)', '--y': 'calc(50% - var(--h) * .9)', '--s': 'calc(var(--h) * 1.8)', '--d': '1100ms', '--t': '9000ms', background: `repeating-conic-gradient(${th.c2}55 0 10deg, transparent 10deg 30deg)`, borderRadius: '50%', maskImage: 'radial-gradient(circle, #000 25%, transparent 70%)' } as V} />,
    }
    case 'jet': return {
      clip: <span className="cel-p" style={{ '--x': '0%', '--y': '22%', height: '3px', width: '100%', background: 'linear-gradient(90deg, transparent, rgb(255 255 255 / .9))', transformOrigin: 'left', animation: 'cel-grow-x 900ms ease-in 1150ms both' } as V} />,
      over: <P cls="fly" v={{ '--x': '-6%', '--y': 'calc(22% - var(--h) * .16)', '--s': 'calc(var(--h) * .34)', '--dx': 'calc(var(--bw) * 1.08)', '--dy': '-6px', '--r': '0deg', '--d': '1150ms', '--t': '900ms', '--pc': '#fff' }}><GlyphMark glyph="jet" size="100%" /></P>,
    }
    case 'wings': return {
      under: [1, -1].map((s) => <span key={s} className="cel-p" style={{ '--x': `calc(30% - var(--h) * ${s > 0 ? 0 : 1.4})`, '--y': 'calc(50% - var(--h) * .7)', '--s': 'calc(var(--h) * 1.4)', color: th.c2, opacity: 0.55, '--sx': s, transform: `scaleX(${s})`, transformOrigin: s > 0 ? 'left center' : 'right center', animation: `cel-wing 700ms cubic-bezier(.2,1.3,.4,1) 1120ms both` } as V}><GlyphMark glyph="wing" size="100%" /></span>),
      over: trail(r, 10, 38, 98, () => <GlyphMark glyph="feather" size="100%" />, { color: '#d9dee0', size: [10, 16], cls: 'fall', dy: [70, 110], dx: [-20, 20], t: [1500, 2200], y: [-10, 30] }),
    }
    case 'dive': return {
      over: <P cls="fly" v={{ '--x': '92%', '--y': 'calc(var(--h) * -1.4)', '--s': 'calc(var(--h) * .7)', '--dx': 'calc(var(--bw) * -.4)', '--dy': 'calc(var(--h) * 1.8)', '--r': '-30deg', '--d': '1100ms', '--t': '700ms', '--pc': '#000' }}><GlyphMark glyph="wing" size="100%" /></P>,
      clip: <>{Array.from({ length: 6 }, (_, i) => <span key={i} className="cel-p streak" style={{ '--x': pct(30 + i * 11), '--y': '100%', '--w': '4px', height: '140%', '--d': ms(1700 + i * 60), '--t': '520ms', '--dx': '0', background: 'linear-gradient(0deg, transparent, rgb(255 255 255 / .7))', animationName: 'cel-rise' } as V} />)}</>,
    }
    case 'twelve': return {
      under: <><span style={{ position: 'absolute', right: '4%', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, fontStyle: 'italic', fontSize: 'calc(var(--h) * 1.3)', color: 'transparent', WebkitTextStroke: `2px ${th.c2}`, opacity: 0.35, animation: 'cel-pop 500ms ease-out 1200ms both' }}>12</span>{Array.from({ length: 22 }, (_, i) => <span key={i} style={{ position: 'absolute', left: pct(38 + i * 2.8), bottom: 0, width: '1.2%', height: '70%', background: th.c2, opacity: 0.35, transformOrigin: 'bottom', animation: `cel-eq ${ms(260 + r() * 260)} ease-in-out ${ms(crossAt(38 + i * 2.8))} 8 alternate both` } as V} />)}</>,
    }
    case 'swords': return {
      clip: <svg className="draw" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {[['M44 -5 L96 105', 1150], ['M96 -5 L44 105', 1330]].map(([d, t]) => <g key={t} style={{ '--d': ms(t as number), '--t': '180ms' } as V}><path d={d as string} pathLength={1} stroke="#000" strokeWidth={6} vectorEffect="non-scaling-stroke" fill="none" /><path d={d as string} pathLength={1} stroke="#e9eef0" strokeWidth={2} vectorEffect="non-scaling-stroke" fill="none" /></g>)}
      </svg>,
      over: trail(r, 8, 60, 80, () => sparkle, { color: '#fff', size: [6, 12], t: [500, 900], dy: [-40, 40] }),
      stage: [shake(1160), shake(1340)],
    }
    case 'peaks': return {
      clip: <svg className="draw" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '75%', '--d': '900ms', '--t': '700ms' } as V}>
        <polyline pathLength={1} points="0,40 10,24 18,32 30,8 40,26 50,14 62,30 72,6 82,22 92,12 100,22" fill="none" stroke={th.c2} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <path pathLength={1} d="M26 15L30 8 34 15M68 13L72 6 76 13" fill="none" stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>,
      over: trail(r, 10, 40, 98, () => <GlyphMark glyph="flame" size="100%" />, { color: (i) => (i % 2 ? '#ffd27a' : '#ff7b2e'), size: [8, 14], dy: [-60, -30], dx: [-8, 8], spin: 30, t: [800, 1200], y: [60, 85] }),
    }
    case 'horseshoe': return {
      over: <>
        <P cls="fly" v={{ '--x': '60%', '--y': 'calc(var(--h) * -1.1)', '--s': 'calc(var(--h) * .7)', '--dx': '0px', '--dy': 'calc(var(--h) * 1.2)', '--r': '720deg', '--d': '1150ms', '--t': '900ms', '--pc': '#fff' }}><GlyphMark glyph="horseshoe" size="100%" /></P>
        {trail(r, 12, 38, 98, () => sparkle, { color: '#fff', size: [7, 13], cls: 'pop', dy: [0, 0], dx: [0, 0], y: [0, 85], t: [1400, 2200] })}
      </>,
    }
    case 'stampede': return {
      over: trail(r, 22, 0, 100, () => dot, { color: (i) => (i % 3 ? 'rgb(160 140 110 / .7)' : 'rgb(110 90 70 / .7)'), size: [14, 30], dy: [-40, -10], dx: [-50, -10], t: [900, 1500], y: [70, 95] }),
      clip: <span className="cel-p streak" style={{ '--x': '-20%', '--y': '82%', '--w': '60%', height: 'calc(var(--h) * .1)', '--d': '700ms', '--t': '700ms', '--dx': '260%', '--pc': th.c2 } as V} />,
      stage: [shake(700), shake(1000), shake(1300)],
    }
    case 'spiral': return {
      under: <svg className="draw" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', '--d': '1000ms', '--t': '900ms' } as V}>
        <path pathLength={1} d="M40 36 C50 0 70 0 72 18 S60 30 58 20 S66 10 68 16" fill="none" stroke={th.c2} strokeWidth={3} vectorEffect="non-scaling-stroke" opacity={0.6} />
        <path pathLength={1} d="M100 36 C90 0 80 4 82 18 S92 28 94 20 S88 12 86 16" fill="none" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.45} />
      </svg>,
      over: trail(r, 8, 40, 98, () => sparkle, { color: th.c2, size: [6, 12], cls: 'pop', dx: [0, 0], dy: [0, 0], t: [1400, 2000], y: [0, 90] }),
    }
    case 'flag': return {
      under: <span style={{ position: 'absolute', left: '38%', right: 0, top: 0, bottom: 0, background: `repeating-linear-gradient(180deg, ${th.c2} 0 12.5%, #fff 12.5% 25%)`, opacity: 0.22, transformOrigin: 'left', animation: 'cel-flag 1200ms ease-in-out 900ms both, cel-wave-y 900ms ease-in-out 2100ms 3 alternate' }} />,
      over: trail(r, 12, 40, 98, () => <GlyphMark glyph="star" size="100%" />, { color: (i) => (i % 2 ? '#fff' : th.c2), size: [7, 12], cls: 'pop', dx: [0, 0], dy: [0, 0], t: [1500, 2300], y: [0, 90] }),
    }
    case 'march': return {
      clip: [0, 1, 2, 3].map((i) => <span key={i} className="flash" style={{ '--d': ms(1300 + i * 260), '--pc': th.c2, '--o': '.28', '--t': '220ms' } as V} />),
      over: [0, 1, 2, 3].map((i) => <span key={i} className="say" style={{ left: pct(48 + i * 14), top: 'calc(var(--h) * -.55)', fontSize: 'calc(var(--h) * .3)', '--d': ms(1300 + i * 260), '--pc': th.c2 } as V}>{['HAIL', 'TO', 'THE', 'COMMANDERS'][i]}</span>),
      stage: [0, 1, 2, 3].map((i) => beat(1300 + i * 260)),
    }
    case 'skyline': return {
      under: Array.from({ length: 16 }, (_, i) => {
        const x = 38 + i * 4, h = 25 + r() * 55 + (i === 9 ? 25 : 0)
        return <span key={i} className="grow" style={{ position: 'absolute', left: pct(x), bottom: 0, width: '3.4%', height: pct(h), background: `linear-gradient(${th.ink}, ${th.ink}) , repeating-linear-gradient(0deg, transparent 0 6px, rgb(255 210 120 / .5) 6px 8px)`, backgroundBlendMode: 'normal', opacity: 0.75, '--d': ms(crossAt(x) + 80), '--t': '320ms' } as V}>
          <span style={{ position: 'absolute', inset: '15% 30%', background: 'repeating-linear-gradient(0deg, transparent 0 5px, rgb(255 214 120 / .65) 5px 7px)' }} />
        </span>
      }),
    }
    case 'texas': return {
      under: <span className="cel-p spin" style={{ '--x': 'calc(30% - var(--h) * .95)', '--y': 'calc(50% - var(--h) * .95)', '--s': 'calc(var(--h) * 1.9)', '--d': '1100ms', '--t': '7000ms', color: th.c2, opacity: 0.5 } as V}><GlyphMark glyph="star" size="100%" /></span>,
      clip: [0, 1].map((i) => <span key={i} className="cel-p streak" style={{ '--x': '-20%', '--y': pct(30 + i * 40), '--w': '45%', height: 'calc(var(--h) * .07)', '--d': ms(1200 + i * 120), '--t': '500ms', '--dx': '330%', '--pc': th.c2 } as V} />),
      over: trail(r, 10, 40, 98, () => <GlyphMark glyph="star" size="100%" />, { color: (i) => (i % 2 ? '#fff' : th.c2), size: [7, 12], cls: 'pop', dx: [0, 0], dy: [0, 0], t: [1500, 2300], y: [0, 90] }),
      stage: [shake(1220)],
    }
    case 'flame': return {
      under: Array.from({ length: 14 }, (_, i) => {
        const x = 36 + i * 4.6
        return <span key={i} style={{ position: 'absolute', left: pct(x), bottom: '-8%', width: 'calc(var(--h) * .34)', height: `calc(var(--h) * ${0.5 + r() * 0.35})`, color: i % 3 === 0 ? '#C8102E' : th.c2, opacity: 0.8, transformOrigin: 'bottom', animation: `cel-grow 300ms ease-out ${ms(crossAt(x))} both, cel-flicker ${ms(180 + r() * 160)} ease-in-out ${ms(crossAt(x) + 300)} 10 alternate` }}><GlyphMark glyph="flame" size="100%" /></span>
      }),
      over: trail(r, 10, 40, 98, () => dot, { color: '#ffd27a', size: [3, 6], dy: [-70, -40], dx: [-10, 10], t: [800, 1300], y: [50, 80] }),
    }
    case 'feathers': return {
      over: trail(r, 16, 30, 100, () => <GlyphMark glyph="feather" size="100%" />, { color: (i) => (i % 3 === 0 ? th.c2 : i % 3 === 1 ? '#ffffff' : '#c7254e'), size: [12, 20], cls: 'sway', dx: [10, 26], dy: [90, 140], spin: 70, t: [2000, 2800], y: [-60, 0] }),
    }
    case 'ravens': return {
      over: <>{trail(r, 18, 30, 100, () => <GlyphMark glyph="feather" size="100%" />, { color: (i) => (i % 4 === 0 ? th.c2 : i % 2 ? '#000' : '#5b3fa8'), size: [12, 20], dy: [-90, 60], dx: [-50, 50], t: [1200, 1800] })}</>,
      stage: [shake(1280)],
    }
    case 'paws': return {
      over: Array.from({ length: 8 }, (_, i) => {
        const x = 38 + i * 8
        return <P key={i} cls="pop" v={{ '--x': pct(x), '--y': i % 2 ? '58%' : '14%', '--s': 'calc(var(--h) * .26)', '--r': '90deg', '--d': ms(crossAt(x) + 60), '--t': ms(2600 - i * 80), '--pc': th.c2, opacity: 0.8 }}><GlyphMark glyph="paw" size="100%" /></P>
      }),
      stage: [beat(1400)],
    }
  }
}
