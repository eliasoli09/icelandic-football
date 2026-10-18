/**
 * Each club's score banner: its colours, what happens as the logo crosses the
 * bar (the effect), the mark that stands in for the A of "MARK" (the glyph) and
 * how the word lands (the type). Effects and glyphs are shared building blocks.
 */
export type Effect =
  | 'claws' | 'eyes' | 'stripes' | 'wind' | 'roar' | 'snow' | 'skol' | 'bolt' | 'starburst' | 'arrow' | 'cannon'
  | 'towel' | 'gold' | 'wave' | 'jet' | 'wings' | 'dive' | 'twelve' | 'swords' | 'peaks' | 'horseshoe' | 'stampede'
  | 'spiral' | 'flag' | 'march' | 'skyline' | 'texas' | 'flame' | 'feathers' | 'ravens' | 'paws'

export type Glyph =
  | 'claw' | 'eye' | 'stripe' | 'c' | 'rings' | 'cheese' | 'horn' | 'bolt' | 'star' | 'arrowhead' | 'cannonball'
  | 'steelmark' | 'nugget' | 'fleur' | 'sun' | 'jet' | 'wing' | 'twelve' | 'sword' | 'peak' | 'horseshoe' | 'bison'
  | 'ram' | 'w' | 'ny' | 'flame' | 'feather' | 'shield' | 'paw'

/** How the word lands: wiped on behind the logo, then its own finish. */
export type WordStyle = 'scratch' | 'block' | 'italic' | 'stamp' | 'shimmer' | 'glow'

export interface ClubTheme {
  /** The bar. */
  c1: string
  /** The slash behind the logo, and the glyph. */
  c2: string
  /** Lines and shadows on the bar. */
  ink: string
  /** The word's colour. */
  word: string
  effect: Effect
  glyph: Glyph
  type: WordStyle
}

export const THEMES: Record<string, ClubTheme> = {
  ARI: { c1: '#97233F', c2: '#FFB612', ink: '#000000', word: '#ffffff', effect: 'feathers', glyph: 'feather', type: 'italic' },
  ATL: { c1: '#A71930', c2: '#000000', ink: '#000000', word: '#ffffff', effect: 'dive', glyph: 'wing', type: 'italic' },
  BAL: { c1: '#241773', c2: '#9E7C0C', ink: '#000000', word: '#ffffff', effect: 'ravens', glyph: 'shield', type: 'stamp' },
  BUF: { c1: '#00338D', c2: '#C60C30', ink: '#001a4a', word: '#ffffff', effect: 'stampede', glyph: 'bison', type: 'stamp' },
  CAR: { c1: '#0085CA', c2: '#101820', ink: '#101820', word: '#ffffff', effect: 'eyes', glyph: 'eye', type: 'scratch' },
  CHI: { c1: '#0B162A', c2: '#C83803', ink: '#000000', word: '#ffffff', effect: 'wind', glyph: 'c', type: 'italic' },
  CIN: { c1: '#FB4F14', c2: '#000000', ink: '#000000', word: '#000000', effect: 'stripes', glyph: 'stripe', type: 'scratch' },
  CLE: { c1: '#311D00', c2: '#FF3C00', ink: '#1a0f00', word: '#FF3C00', effect: 'paws', glyph: 'paw', type: 'stamp' },
  DAL: { c1: '#003594', c2: '#869397', ink: '#041E42', word: '#ffffff', effect: 'starburst', glyph: 'star', type: 'shimmer' },
  DEN: { c1: '#FB4F14', c2: '#002244', ink: '#002244', word: '#ffffff', effect: 'peaks', glyph: 'peak', type: 'glow' },
  DET: { c1: '#0076B6', c2: '#B0B7BC', ink: '#00365a', word: '#ffffff', effect: 'roar', glyph: 'rings', type: 'stamp' },
  GB: { c1: '#203731', c2: '#FFB612', ink: '#0f1c18', word: '#FFB612', effect: 'snow', glyph: 'cheese', type: 'block' },
  HOU: { c1: '#03202F', c2: '#A71930', ink: '#000000', word: '#ffffff', effect: 'texas', glyph: 'star', type: 'stamp' },
  IND: { c1: '#002C5F', c2: '#A2AAAD', ink: '#001530', word: '#ffffff', effect: 'horseshoe', glyph: 'horseshoe', type: 'block' },
  JAX: { c1: '#006778', c2: '#D7A22A', ink: '#101820', word: '#ffffff', effect: 'claws', glyph: 'claw', type: 'scratch' },
  KC: { c1: '#E31837', c2: '#FFB81C', ink: '#7a0016', word: '#ffffff', effect: 'arrow', glyph: 'arrowhead', type: 'italic' },
  LV: { c1: '#000000', c2: '#A5ACAF', ink: '#000000', word: '#A5ACAF', effect: 'swords', glyph: 'sword', type: 'stamp' },
  LAC: { c1: '#0080C6', c2: '#FFC20E', ink: '#002a5c', word: '#ffffff', effect: 'bolt', glyph: 'bolt', type: 'italic' },
  LA: { c1: '#003594', c2: '#FFA300', ink: '#001a4a', word: '#FFD100', effect: 'spiral', glyph: 'ram', type: 'block' },
  MIA: { c1: '#008E97', c2: '#FC4C02', ink: '#005057', word: '#ffffff', effect: 'wave', glyph: 'sun', type: 'italic' },
  MIN: { c1: '#4F2683', c2: '#FFC62F', ink: '#2a124a', word: '#FFC62F', effect: 'skol', glyph: 'horn', type: 'stamp' },
  NE: { c1: '#002244', c2: '#C60C30', ink: '#000f20', word: '#ffffff', effect: 'flag', glyph: 'star', type: 'block' },
  NO: { c1: '#101820', c2: '#D3BC8D', ink: '#000000', word: '#D3BC8D', effect: 'gold', glyph: 'fleur', type: 'shimmer' },
  NYG: { c1: '#0B2265', c2: '#A71930', ink: '#05112f', word: '#ffffff', effect: 'skyline', glyph: 'ny', type: 'block' },
  NYJ: { c1: '#125740', c2: '#ffffff', ink: '#0a3326', word: '#ffffff', effect: 'jet', glyph: 'jet', type: 'italic' },
  PHI: { c1: '#004C54', c2: '#A5ACAF', ink: '#002a2f', word: '#ffffff', effect: 'wings', glyph: 'wing', type: 'italic' },
  PIT: { c1: '#101820', c2: '#FFB612', ink: '#000000', word: '#FFB612', effect: 'towel', glyph: 'steelmark', type: 'stamp' },
  SF: { c1: '#AA0000', c2: '#B3995D', ink: '#5c0000', word: '#ffffff', effect: 'gold', glyph: 'nugget', type: 'shimmer' },
  SEA: { c1: '#002244', c2: '#69BE28', ink: '#000f20', word: '#ffffff', effect: 'twelve', glyph: 'twelve', type: 'block' },
  TB: { c1: '#D50A0A', c2: '#34302B', ink: '#5c0000', word: '#ffffff', effect: 'cannon', glyph: 'cannonball', type: 'stamp' },
  TEN: { c1: '#0C2340', c2: '#4B92DB', ink: '#000f20', word: '#ffffff', effect: 'flame', glyph: 'flame', type: 'glow' },
  WAS: { c1: '#5A1414', c2: '#FFB612', ink: '#2e0808', word: '#FFB612', effect: 'march', glyph: 'w', type: 'stamp' },
}

/** Relocated clubs share their franchise's banner. */
const ALIAS: Record<string, string> = { OAK: 'LV', SD: 'LAC', STL: 'LA', LAR: 'LA' }

export const themeFor = (abbr: string): ClubTheme => THEMES[ALIAS[abbr] ?? abbr] ?? { c1: '#2f6bff', c2: '#ffffff', ink: '#0a1430', word: '#ffffff', effect: 'starburst', glyph: 'star', type: 'block' }

/** The banner's clock, in ms: the bar opens, the logo crosses, the word holds, the bar closes. */
export const T = { open: 0, cross: 380, crossEnd: 1180, settle: 1150, hold: 4300, end: 4800 }
