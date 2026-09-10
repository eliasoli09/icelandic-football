/**
 * Predict every remaining fixture of a season, and project the final table.
 *
 * Ratings are seeded from the database — which for English clubs spans the
 * Premier League and the Championship in one pool, so a promoted side carries
 * the rating it earned rather than starting from nothing — then updated with
 * the results already played this season before anything is predicted.
 *
 * Fixture file: one match per line, `matchday|home|away|homeGoals|awayGoals`,
 * goals blank for a fixture not yet played.
 *
 * Usage: cd web && npx tsx scripts/predict-season.mts <file> [league]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const file = process.argv[2]
const leagueKey = process.argv[3] ?? 'premier'
if (!file) throw new Error('vantar leikjaskrá')

const { db } = await import(join(webDir, 'src/lib/db.ts'))
const { predictMatch } = await import(join(webDir, 'src/lib/predict.ts'))
const { LEAGUES } = await import(join(webDir, 'src/lib/leagues.ts'))
const { mulberry32 } = await import(join(webDir, 'src/lib/simulate.ts'))
const { samplePoisson } = await import(join(webDir, 'src/lib/predict.ts'))

const cfg = (LEAGUES as any)[leagueKey]
const goals = cfg?.goals
const K = 24, HFA = 60

/** the fixture list writes short names; the database uses football-data.co.uk's */
const ALIAS: Record<string, string> = {
  'Man Utd': 'Man United',
  'Nottm Forest': "Nott'm Forest",
  Spurs: 'Tottenham',
  Palace: 'Crystal Palace',
  'Ipswich Town': 'Ipswich',
}
const dbName = (n: string) => ALIAS[n] ?? n

interface Fx { md: number; home: string; away: string; gh: number | null; ga: number | null }
const fixtures: Fx[] = []
for (const line of readFileSync(file, 'utf-8').split('\n')) {
  if (!line.trim()) continue
  const [md, home, away, gh, ga] = line.split('|')
  fixtures.push({
    md: Number(md), home: home.trim(), away: away.trim(),
    gh: gh?.trim() ? Number(gh) : null, ga: ga?.trim() ? Number(ga) : null,
  })
}
const clubs = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))]

// --- seed ratings from the database ------------------------------------
const { data: rows } = await db()
  .from('team_elo_current')
  .select('team_id, elo_after, teams(name)')
const elo = new Map<string, number>()
for (const r of (rows ?? []) as any[]) {
  const name = r.teams?.name
  if (name) elo.set(name, r.elo_after)
}
const missing = clubs.filter((c) => !elo.has(dbName(c)))
if (missing.length) throw new Error(`engin Elo-stig fyrir: ${missing.join(', ')}`)
const rate = (c: string) => elo.get(dbName(c))!
const seeded = new Map(clubs.map((c) => [c, rate(c)]))

// --- apply what has already been played --------------------------------
const table = new Map(clubs.map((c) => [c, { p: 0, gf: 0, ga: 0, pl: 0 }]))
const bump = (c: string, v: number) => elo.set(dbName(c), rate(c) + v)
let playedCount = 0
for (const f of fixtures.filter((x) => x.gh !== null).sort((a, b) => a.md - b.md)) {
  const eh = rate(f.home), ea = rate(f.away)
  const exp = 1 / (1 + 10 ** ((ea - (eh + HFA)) / 400))
  const s = f.gh! > f.ga! ? 1 : f.gh === f.ga ? 0.5 : 0
  const d = K * (s - exp)
  bump(f.home, d); bump(f.away, -d)
  const h = table.get(f.home)!, a = table.get(f.away)!
  h.pl++; a.pl++; h.gf += f.gh!; h.ga += f.ga!; a.gf += f.ga!; a.ga += f.gh!
  if (f.gh! > f.ga!) h.p += 3; else if (f.gh! < f.ga!) a.p += 3; else { h.p++; a.p++ }
  playedCount++
}

// --- predict every remaining fixture -----------------------------------
const remaining = fixtures.filter((f) => f.gh === null)
interface Pred { md: number; home: string; away: string; pH: number; pD: number; pA: number; lh: number; la: number; score: string }
const preds: Pred[] = remaining.map((f) => {
  const p = predictMatch({ eloHome: rate(f.home), eloAway: rate(f.away), home: null, away: null, goals })
  const top = p.topScorelines?.[0]
  return {
    md: f.md, home: f.home, away: f.away,
    pH: p.pHome, pD: p.pDraw, pA: p.pAway,
    lh: p.lambdaHome, la: p.lambdaAway,
    score: top ? `${top.home}-${top.away}` : '',
  }
})

// --- project the final table -------------------------------------------
const RUNS = 20000
const rand = mulberry32(20260912)
const pos = new Map(clubs.map((c) => [c, Array(20).fill(0)]))
const ptsSum = new Map(clubs.map((c) => [c, 0]))
for (let run = 0; run < RUNS; run++) {
  const st = new Map([...table].map(([c, v]) => [c, { p: v.p, gd: v.gf - v.ga, gf: v.gf }]))
  for (const f of remaining) {
    const p = predictMatch({ eloHome: rate(f.home), eloAway: rate(f.away), home: null, away: null, goals })
    const hg = samplePoisson(p.lambdaHome, rand), ag = samplePoisson(p.lambdaAway, rand)
    const h = st.get(f.home)!, a = st.get(f.away)!
    h.gd += hg - ag; a.gd += ag - hg; h.gf += hg; a.gf += ag
    if (hg > ag) h.p += 3; else if (hg < ag) a.p += 3; else { h.p++; a.p++ }
  }
  const ranked = [...st.entries()].sort((x, y) => y[1].p - x[1].p || y[1].gd - x[1].gd || y[1].gf - x[1].gf)
  ranked.forEach(([c], i) => { pos.get(c)![i]++ })
  for (const [c, v] of st) ptsSum.set(c, ptsSum.get(c)! + v.p)
}

// --- output -------------------------------------------------------------
console.log(`# Spá — ${cfg?.name ?? leagueKey}`)
console.log(`# ${playedCount} leikir spilaðir, ${remaining.length} eftir. ${RUNS.toLocaleString('is')} hermanir.\n`)
console.log('## Elo eftir spilaða leiki (byrjunarstig -> núna)')
for (const [c, v] of [...clubs].map((c) => [c, rate(c)] as const).sort((a, b) => b[1] - a[1])) {
  const d = v - seeded.get(c)!
  console.log(`${c.padEnd(14)} ${Math.round(v).toString().padStart(5)}  (${d >= 0 ? '+' : ''}${Math.round(d)})`)
}
console.log('\n## Lokataflan — spá')
console.log('lið             stig   meistari  topp4   topp5   fall')
const proj = clubs.map((c) => {
  const pp = pos.get(c)!.map((x) => x / RUNS)
  return { c, pts: ptsSum.get(c)! / RUNS, title: pp[0], t4: pp.slice(0, 4).reduce((a, b) => a + b, 0),
           t5: pp.slice(0, 5).reduce((a, b) => a + b, 0), rel: pp.slice(17).reduce((a, b) => a + b, 0) }
}).sort((a, b) => b.pts - a.pts)
const pc = (x: number) => x >= 0.995 ? '100%' : x < 0.005 ? '  <1%' : `${(100 * x).toFixed(0).padStart(3)}%`
for (const r of proj) {
  console.log(`${r.c.padEnd(14)} ${r.pts.toFixed(1).padStart(5)}   ${pc(r.title)}   ${pc(r.t4)}  ${pc(r.t5)}  ${pc(r.rel)}`)
}
console.log('\n## Hver einasti leikur sem eftir er')
let md = 0
for (const p of preds) {
  if (p.md !== md) { md = p.md; console.log(`\n### Umferð ${md}`) }
  const fav = p.pH >= p.pD && p.pH >= p.pA ? '1' : p.pA >= p.pD ? '2' : 'X'
  console.log(
    `${p.home.padEnd(14)} - ${p.away.padEnd(14)}  ` +
    `1 ${(100 * p.pH).toFixed(0).padStart(2)}%  X ${(100 * p.pD).toFixed(0).padStart(2)}%  2 ${(100 * p.pA).toFixed(0).padStart(2)}%  ` +
    `[${fav}]  líklegast ${p.score}  vænt ${p.lh.toFixed(1)}-${p.la.toFixed(1)}`,
  )
}
