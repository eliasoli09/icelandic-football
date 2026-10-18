import type { Glyph } from './themes'

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/** The club's mark, standing in for the A of "MARK" like the O of a Premier League "GOAL". */
export function GlyphMark({ glyph, size = '1em' }: { glyph: Glyph; size?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ display: 'inline-block', verticalAlign: '-0.12em', overflow: 'visible' }}>
      {shape(glyph)}
    </svg>
  )
}

function shape(g: Glyph) {
  switch (g) {
    case 'claw': return <g fill="currentColor">{[3, 10, 17].map((x) => <path key={x} d={`M${x + 4} 1l2.4.6L${x - 1.2} 23 ${x - 2.6} 22.4z`} />)}</g>
    case 'eye': return <g><path d="M1 12c5-7 17-7 22 0-5 7-17 7-22 0z" fill="currentColor" /><ellipse cx="12" cy="12" rx="1.6" ry="4.6" fill="#101820" /></g>
    case 'stripe': return <g fill="currentColor"><path d="M3 3c7 1 11 5 10 11-1 4-4 6-8 7 3-3 4-6 3-9-1-4-3-6-5-9z" /><path d="M14 2c5 2 8 6 7 12-1 3-2 5-4 6 1-4 1-7-1-11z" /></g>
    case 'c': return <path d="M19 6.5A8.5 8.5 0 1 0 19 17.5" {...S} strokeWidth={4.2} strokeLinecap="butt" />
    case 'rings': return <g {...S} strokeWidth={2}><circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="10" opacity=".6" /></g>
    case 'cheese': return <g><path d="M2 19L22 7v12z" fill="currentColor" /><circle cx="15" cy="15" r="1.7" fill="#203731" /><circle cx="9" cy="17" r="1.1" fill="#203731" /><circle cx="19" cy="11.5" r="1" fill="#203731" /></g>
    case 'horn': return <path d="M2 6c7-1 15 3 20 13l-3.5 1.5C15 13 9 10 2 10.5z" fill="currentColor" />
    case 'bolt': return <path d="M14 1L3.5 14h7L8 23 20.5 9.5h-7.5z" fill="currentColor" />
    case 'star': return <path d="M12 1.5l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.3l-6.6 3.9 1.8-7.3L1.5 9l7.5-.6z" fill="currentColor" />
    case 'arrowhead': return <path d="M12 1l8 21-8-5-8 5z" fill="currentColor" />
    case 'cannonball': return <g><circle cx="11" cy="14" r="8" fill="currentColor" /><path d="M16 7c1-3 3-4 6-4" {...S} strokeWidth={2} /><circle cx="22" cy="3" r="1.4" fill="#FF7900" /></g>
    case 'steelmark': return <g><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth={2} />{[[12, 6.5, '#FFB612'], [7.5, 15, '#C8102E'], [16.5, 15, '#00539B']].map(([x, y, c]) => <path key={`${x}${y}`} d={`M${x} ${(y as number) - 3.6}c.6 2.2 1.4 3 3.6 3.6-2.2.6-3 1.4-3.6 3.6-.6-2.2-1.4-3-3.6-3.6 2.2-.6 3-1.4 3.6-3.6z`} fill={c as string} />)}</g>
    case 'nugget': return <path d="M5 9l5-5 8 2 4 7-4 7-8 1-6-5z" fill="currentColor" />
    case 'fleur': return <g fill="currentColor"><path d="M12 1c3.5 4 3.5 9 0 13-3.5-4-3.5-9 0-13z" /><path d="M11 14c-2-5-8-5-9-1 0 3 3 4 5 2-2 0-2-2 0-2 1 0 3 1 4 1z" /><path d="M13 14c2-5 8-5 9-1 0 3-3 4-5 2 2 0 2-2 0-2-1 0-3 1-4 1z" /><rect x="7" y="15" width="10" height="2.2" rx="1" /><path d="M10.5 17.2h3L12 23z" /></g>
    case 'sun': return <g><circle cx="12" cy="12" r="5.5" fill="currentColor" /><g {...S} strokeWidth={2}>{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={12 + Math.cos(a) * 8} y1={12 + Math.sin(a) * 8} x2={12 + Math.cos(a) * 11} y2={12 + Math.sin(a) * 11} /> })}</g></g>
    case 'jet': return <path d="M1 13.5l8-1.8L13.5 4h2.2l-2.2 7.2 5.8-1 2.2-3h1.7l-1 4.8 1 4.8h-1.7l-2.2-3-5.8-1 2.2 7.2h-2.2L9 13.3z" fill="currentColor" />
    case 'wing': return <path d="M1 17C7 6 15 3 23 3c-4 2-6 4-7 6 3-1 5-1 7 0-4 1-6 3-7 5 2 0 3 .3 4 1-6 2-12 2-19 2z" fill="currentColor" />
    case 'twelve': return <text x="12" y="19" textAnchor="middle" fontSize="18" fontWeight="900" fontStyle="italic" fill="currentColor" fontFamily="inherit">12</text>
    case 'sword': return <g {...S} strokeWidth={2.4}><path d="M4 20L18 6l3.5-3.5-.8 3.8L6.5 20.5" fill="currentColor" /><path d="M5 13l6 6" /><path d="M2 22l3-3" /></g>
    case 'peak': return <path d="M1 21l8-14 4.5 7 3.5-5 6 12z" fill="currentColor" />
    case 'horseshoe': return <g><path d="M5 3v9a7 7 0 0 0 14 0V3" {...S} strokeWidth={4.4} strokeLinecap="butt" /><g fill="#002C5F">{[[5, 6], [5, 11], [19, 6], [19, 11]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".9" />)}</g></g>
    case 'bison': return <path d="M2 7c0 6 5 9 10 9s10-3 10-9c-2 3-5 4.5-10 4.5S4 10 2 7zM8 16l4 6 4-6z" fill="currentColor" />
    case 'ram': return <path d="M12 12a3 3 0 1 1 3-3c0 5-3.5 8.5-8 8.5A8 8 0 0 1 0 9.5" {...S} strokeWidth={3.2} />
    case 'w': return <text x="12" y="19.5" textAnchor="middle" fontSize="20" fontWeight="900" fill="currentColor" fontFamily="Georgia, serif">W</text>
    case 'ny': return <text x="12" y="18.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="currentColor" fontFamily="inherit" letterSpacing="-1">ny</text>
    case 'flame': return <path d="M12 1c2 4.5 7 6.5 7 12.5a7 7 0 0 1-14 0c0-3.5 2-5.5 3.5-7.5 0 2.5 1 3.5 2.5 3.5 0-3.5-.5-5.5 1-8.5z" fill="currentColor" />
    case 'feather': return <g><path d="M21 2C11 3 5 9 4 20c4-1 9-4 12-9-2 .5-3.5.5-5 0 3-1.5 6-3.5 7.5-6-1.5.3-3 .2-4-.3C17.5 4 19.5 3 21 2z" fill="currentColor" /><path d="M3 22L14 8" {...S} strokeWidth={1.4} /></g>
    case 'shield': return <path d="M12 1.5l8.5 3.2v6.5c0 5.5-3.4 9.5-8.5 11.5-5.1-2-8.5-6-8.5-11.5V4.7z" fill="currentColor" />
    case 'paw': return <g fill="currentColor"><ellipse cx="12" cy="16" rx="5.5" ry="4.5" /><ellipse cx="5" cy="10" rx="2" ry="2.6" /><ellipse cx="9.3" cy="5.5" rx="2" ry="2.7" /><ellipse cx="14.7" cy="5.5" rx="2" ry="2.7" /><ellipse cx="19" cy="10" rx="2" ry="2.6" /></g>
  }
}
