/**
 * National teams: fixtures, results and pre-match ratings from eloratings.net
 * (open TSV feeds, no key, no robots.txt), probabilities from our own
 * Elo -> Poisson model calibrated on national-team matches. Display layer,
 * completely separate from the club model and its Elo pools.
 *
 * Calibration (2026-09-29): 10,641 matches between the 54 UEFA nations since
 * 1990, fitted on 1990-2019 and tested on 2020-2026 (2,116 matches).
 * Divisor 1400 -> test log loss 0.864 vs 1.034 for base rates, and calibrated
 * within a few points in every decile (says 75% -> 71%, 25% -> 27%).
 * The club divisor (1250) is tuned for a different rating scale.
 */
import { createClient } from '@supabase/supabase-js'

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const SECRET = () => process.env.CRON_SECRET!

const BASE = 'https://www.eloratings.net'
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; islensk-fotbolti.vercel.app)' }

export const NATIONS_DIVISOR = 1400
/** Goals per game for the team playing at home / the visitors (1990-2019). */
export const NATIONS_GOALS = { home: 1.569, away: 1.109 }
const MAX_GOALS = 10

function poisson(l: number, k: number): number {
  let f = 1
  for (let i = 2; i <= k; i++) f *= i
  return (Math.exp(-l) * l ** k) / f
}

export function nationsLambdas(eloHome: number, eloAway: number, neutral: boolean) {
  const edge = (eloHome - eloAway) / NATIONS_DIVISOR
  const g = neutral
    ? { home: (NATIONS_GOALS.home + NATIONS_GOALS.away) / 2, away: (NATIONS_GOALS.home + NATIONS_GOALS.away) / 2 }
    : NATIONS_GOALS
  const clamp = (x: number) => Math.min(Math.max(x, 0.15), 6)
  return { home: clamp(g.home * 10 ** edge), away: clamp(g.away * 10 ** -edge) }
}

/** 1X2 probabilities, exactly the model that was measured above. */
export function nationsPredict(eloHome: number, eloAway: number, neutral: boolean) {
  const l = nationsLambdas(eloHome, eloAway, neutral)
  let pHome = 0, pDraw = 0, pAway = 0
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(l.home, i) * poisson(l.away, j)
      if (i > j) pHome += p
      else if (i === j) pDraw += p
      else pAway += p
    }
  }
  const s = pHome + pDraw + pAway
  return { pHome: pHome / s, pDraw: pDraw / s, pAway: pAway / s, lambdaHome: l.home, lambdaAway: l.away }
}

// ---------------------------------------------------------------- names

/** eloratings.net code -> Icelandic name (UEFA plus a few frequent others). */
export const IS_NAMES: Record<string, string> = {
  AD: 'Andorra', AL: 'Albanía', AM: 'Armenía', AT: 'Austurríki', AZ: 'Aserbaídsjan',
  BA: 'Bosnía', BE: 'Belgía', BG: 'Búlgaría', BY: 'Hvíta-Rússland', CH: 'Sviss',
  CY: 'Kýpur', CZ: 'Tékkland', DE: 'Þýskaland', DK: 'Danmörk', EE: 'Eistland',
  EI: 'Norður-Írland', EN: 'England', ES: 'Spánn', FI: 'Finnland', FO: 'Færeyjar',
  FR: 'Frakkland', GE: 'Georgía', GI: 'Gíbraltar', GR: 'Grikkland', HR: 'Króatía',
  HU: 'Ungverjaland', IE: 'Írland', IL: 'Ísrael', IS: 'Ísland', IT: 'Ítalía',
  KO: 'Kósóvó', KZ: 'Kasakstan', LI: 'Liechtenstein', LT: 'Litháen', LU: 'Lúxemborg',
  LV: 'Lettland', MD: 'Moldóva', ME: 'Svartfjallaland', MT: 'Malta', NL: 'Holland',
  NM: 'Norður-Makedónía', NO: 'Noregur', PL: 'Pólland', PT: 'Portúgal', RO: 'Rúmenía',
  RS: 'Serbía', RU: 'Rússland', SE: 'Svíþjóð', SI: 'Slóvenía', SK: 'Slóvakía',
  SM: 'San Marínó', SQ: 'Skotland', TR: 'Tyrkland', UA: 'Úkraína', WA: 'Wales',
  AR: 'Argentína', BR: 'Brasilía', US: 'Bandaríkin', MX: 'Mexíkó', JP: 'Japan',
  CA: 'Kanada', UY: 'Úrúgvæ', MA: 'Marokkó', KR: 'Suður-Kórea', AU: 'Ástralía',
}

/** eloratings code -> flagcdn.com code where they differ. */
const FLAG_CODES: Record<string, string> = {
  EN: 'gb-eng', SQ: 'gb-sct', WA: 'gb-wls', EI: 'gb-nir', KO: 'xk', NM: 'mk',
}

export function nationName(code: string, fallback: string): string {
  return IS_NAMES[code] ?? fallback
}

export function flagUrl(code: string): string | null {
  const c = FLAG_CODES[code] ?? (IS_NAMES[code] ? code.toLowerCase() : null)
  return c ? `https://flagcdn.com/w40/${c}.png` : null
}

const TOURNAMENT_IS: Record<string, string> = {
  ENA: 'Þjóðadeildin A', ENB: 'Þjóðadeildin B', ENC: 'Þjóðadeildin C', END: 'Þjóðadeildin D',
  F: 'Vináttuleikur', EQ: 'Undankeppni EM', EC: 'EM', WQ: 'Undankeppni HM', WC: 'HM',
}
export function tournamentName(code: string, fallback?: string | null): string {
  return TOURNAMENT_IS[code] ?? fallback ?? code
}

// ---------------------------------------------------------------- parsing

export interface NationRow {
  key: string
  date: string
  home_code: string
  away_code: string
  home: string
  away: string
  tournament_code: string
  tournament: string | null
  venue_code: string | null
  neutral: boolean
  home_goals: number | null
  away_goals: number | null
  elo_home: number | null
  elo_away: number | null
  p_home: number | null
  p_draw: number | null
  p_away: number | null
}

const num = (s: string | undefined) => Number((s ?? '').replace('−', '-').replace('+', ''))
const pad = (s: string) => s.padStart(2, '0')

export function parseCodeMap(tsv: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const line of tsv.split('\n')) {
    const [code, name] = line.split('\t')
    if (code && name) m.set(code.trim(), name.trim())
  }
  return m
}

/** Venue column: blank means the home team's country. */
function venueOf(home: string, venue: string | undefined) {
  const v = (venue ?? '').trim()
  return { venue_code: v && v !== home ? v : null, neutral: !!v && v !== home }
}

/**
 * fixtures.tsv: Y M D home away tournament venue rankH rankA eloH eloA ...
 * Ratings are current, i.e. pre-match. Day '00' = not yet scheduled; skipped.
 */
export function parseFixtures(tsv: string, teams: Map<string, string>, tourn: Map<string, string>): NationRow[] {
  const out: NationRow[] = []
  for (const line of tsv.split('\n')) {
    const c = line.split('\t')
    if (c.length < 11 || c[2] === '00') continue
    const eh = num(c[9]), ea = num(c[10])
    if (!(eh > 0 && ea > 0)) continue
    const date = `${c[0]}-${pad(c[1])}-${pad(c[2])}`
    const v = venueOf(c[3], c[6])
    const p = nationsPredict(eh, ea, v.neutral)
    out.push({
      key: `${date}:${c[3]}:${c[4]}`, date, home_code: c[3], away_code: c[4],
      home: teams.get(c[3]) ?? c[3], away: teams.get(c[4]) ?? c[4],
      tournament_code: c[5], tournament: tourn.get(c[5]) ?? null, ...v,
      home_goals: null, away_goals: null, elo_home: eh, elo_away: ea,
      p_home: p.pHome, p_draw: p.pDraw, p_away: p.pAway,
    })
  }
  return out
}

/**
 * latest.tsv and <Country>.tsv: Y M D home away hg ag tournament venue change
 * eloH eloA ... Ratings are AFTER the match; the home side gained `change`
 * and the away side lost it, so pre-match = after -/+ change.
 */
export function parseResults(tsv: string, teams: Map<string, string>, tourn: Map<string, string>): NationRow[] {
  const out: NationRow[] = []
  for (const line of tsv.split('\n')) {
    const c = line.split('\t')
    if (c.length < 12) continue
    const hg = num(c[5]), ag = num(c[6]), ch = num(c[9]), eh = num(c[10]), ea = num(c[11])
    if (![hg, ag, ch, eh, ea].every(Number.isFinite) || c[2] === '00') continue
    const date = `${c[0]}-${pad(c[1])}-${pad(c[2])}`
    const v = venueOf(c[3], c[8])
    const preH = eh - ch, preA = ea + ch
    const p = nationsPredict(preH, preA, v.neutral)
    out.push({
      key: `${date}:${c[3]}:${c[4]}`, date, home_code: c[3], away_code: c[4],
      home: teams.get(c[3]) ?? c[3], away: teams.get(c[4]) ?? c[4],
      tournament_code: c[7], tournament: tourn.get(c[7]) ?? null, ...v,
      home_goals: hg, away_goals: ag, elo_home: preH, elo_away: preA,
      p_home: p.pHome, p_draw: p.pDraw, p_away: p.pAway,
    })
  }
  return out
}

async function tsv(path: string): Promise<string> {
  const r = await fetch(`${BASE}/${path}`, { headers: UA, cache: 'no-store' })
  if (!r.ok) throw new Error(`eloratings ${path}: HTTP ${r.status}`)
  return r.text()
}

export async function codeMaps() {
  const [t, n] = await Promise.all([tsv('en.teams.tsv'), tsv('en.tournaments.tsv')])
  return { teams: parseCodeMap(t), tourn: parseCodeMap(n) }
}

/** Batched upsert without pruning (history backfill). */
export async function upsertNations(rows: NationRow[]): Promise<number> {
  let total = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { data, error } = await db().rpc('rpc_upsert_nations', {
      p_secret: SECRET(), p_rows: chunk, p_prune: false,
    })
    if (error) throw error
    total += (data as number) ?? 0
  }
  return total
}

/** Daily refresh: recent results + all scheduled fixtures (two small files). */
export async function refreshNations(): Promise<{ results: number; fixtures: number }> {
  const { teams, tourn } = await codeMaps()
  const [latest, fixtures] = await Promise.all([tsv('latest.tsv'), tsv('fixtures.tsv')])
  const results = parseResults(latest, teams, tourn)
  const upcoming = parseFixtures(fixtures, teams, tourn)
  // results first so a match that is in both is stored as played
  const played = new Set(results.map((r) => r.key))
  const rows = [...results, ...upcoming.filter((u) => !played.has(u.key))]
  // prune needs every key in one payload, so send it in one call
  const { error } = await db().rpc('rpc_upsert_nations', { p_secret: SECRET(), p_rows: rows, p_prune: true })
  if (error) throw error
  return { results: results.length, fixtures: upcoming.length }
}
