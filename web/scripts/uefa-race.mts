/**
 * Simulate the rest of a European season and estimate each association's
 * chance of finishing top two in UEFA's seasonal coefficient — the two places
 * that earn an extra Champions League berth the following year.
 *
 * Club strength comes from an Elo run over the season's own European matches,
 * seeded by competition tier (a Conference League side does not start level
 * with a Champions League one). Remaining matches are then sampled from that.
 *
 * The knockout stage is rebuilt from the league-phase table using UEFA's
 * seeding: 1-8 go straight to the round of 16, 9-24 meet in the play-off
 * (9 v 24, 10 v 23, ...), 25-36 are out.
 *
 * Validated on 2024/25, where England and Spain took the two places. From a
 * 1 Feb cutoff (knockout stage to come) it gives England 99.9% and calls the
 * real race — Spain 49.7% against Italy 44.0%. From 1 Nov, mid league phase,
 * it still has England at 84.7% but puts Spain at 2.5%: club strength is
 * derived only from that season's own European results, so a slow start is
 * over-weighted. Seeding clubs from their UEFA club coefficient instead of a
 * flat per-competition value is the obvious fix.
 *
 * Usage: cd web && npx tsx scripts/uefa-race.mts [season] [cutoff ISO date]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir,'.env.local'),'utf-8').split('\n')) {
  const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2] }
const { predictMatch } = await import(join(webDir,'src/lib/predict.ts'))
const { samplePoisson } = await import(join(webDir,'src/lib/predict.ts'))
const { mulberry32 } = await import(join(webDir,'src/lib/simulate.ts'))

const SEASON = Number(process.argv[2] ?? 2024)
const CUTOFF = process.argv[3] ?? `${SEASON + 1}-02-01`
const KEY = process.env.API_FOOTBALL_KEY!
const CACHE = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/uefa-cache'
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })

const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms))
async function get(path: string) {
  const f = join(CACHE, path.replace(/[^a-z0-9]/gi,'_') + '.json')
  if (existsSync(f)) return JSON.parse(readFileSync(f,'utf8'))
  for (let i=0;i<6;i++) {
    const r = await fetch(`https://v3.football.api-sports.io${path}`, { headers:{'x-apisports-key':KEY} })
    const d:any = await r.json()
    if (d.errors?.rateLimit) { await sleep(20_000); continue }
    if (d.errors && !Array.isArray(d.errors) && Object.keys(d.errors).length) throw new Error(JSON.stringify(d.errors))
    writeFileSync(f, JSON.stringify(d.response ?? []))
    await sleep(7_000)
    return d.response ?? []
  }
  throw new Error(`hraðatakmörk á ${path}`)
}

interface Comp { id:number; key:string; participation:number; lowStep:number; ko:number; seed:number }
const COMPS: Comp[] = [
  { id: 2,   key:'ucl',  participation: 6, lowStep: 0.25,  ko: 1.5, seed: 1700 },
  { id: 3,   key:'uel',  participation: 0, lowStep: 0.25,  ko: 1,   seed: 1550 },
  { id: 848, key:'uecl', participation: 0, lowStep: 0.125, ko: 0.5, seed: 1400 },
]
const QUAL = /Qualifying Round|^Play-offs$/i
const KO_ROUNDS = ['Round of 16','Quarter-finals','Semi-finals','Final']
const positionBonus = (rank:number, c:Comp) =>
  rank >= 25 ? 0 : rank >= 9 ? (25-rank)*c.lowStep : 16*c.lowStep + (9-rank)*0.25

const country = new Map<number,string>()
const clubs = new Map<string, Set<number>>()
const elo = new Map<number, number>()
interface Fx { comp:Comp; round:string; date:string; home:number; away:number; hg:number|null; ag:number|null }
const fixtures: Fx[] = []

for (const c of COMPS) {
  for (const t of await get(`/teams?league=${c.id}&season=${SEASON}`)) {
    country.set(t.team.id, t.team.country)
    if (!clubs.has(t.team.country)) clubs.set(t.team.country, new Set())
    clubs.get(t.team.country)!.add(t.team.id)
    if (!elo.has(t.team.id)) elo.set(t.team.id, c.seed)
  }
}
for (const c of COMPS) {
  for (const f of await get(`/fixtures?league=${c.id}&season=${SEASON}`)) {
    fixtures.push({ comp:c, round:f.league.round, date:f.fixture.date,
      home:f.teams.home.id, away:f.teams.away.id, hg:f.goals.home, ag:f.goals.away })
  }
}
fixtures.sort((a,b)=>a.date.localeCompare(b.date))

// --- Elo from matches actually played before the cutoff -------------------
const K = 24, HFA = 60
const played = fixtures.filter(f => f.date < CUTOFF && f.hg !== null)
for (const f of played) {
  const eh = elo.get(f.home)!, ea = elo.get(f.away)!
  const exp = 1 / (1 + 10 ** ((ea - (eh + HFA)) / 400))
  const s = f.hg! > f.ag! ? 1 : f.hg! === f.ag! ? 0.5 : 0
  elo.set(f.home, eh + K * (s - exp))
  elo.set(f.away, ea - K * (s - exp))
}

const known = fixtures.filter(f => f.date < CUTOFF && f.hg !== null)
const future = fixtures.filter(f => !(f.date < CUTOFF && f.hg !== null))
console.log(`tímabil ${SEASON}/${String(SEASON+1).slice(2)} — skorið ${CUTOFF}`)
console.log(`spilaðir leikir: ${known.length}   eftir að herma: ${future.length}`)

// --- Monte Carlo ----------------------------------------------------------
const RUNS = 4000
const rand = mulberry32(20260909)
const top2 = new Map<string, number>()
const coefSum = new Map<string, number>()

const simGoals = (eh:number, ea:number) => {
  const p = predictMatch({ eloHome: eh, eloAway: ea, home: null, away: null })
  return [samplePoisson(p.lambdaHome, rand), samplePoisson(p.lambdaAway, rand)] as const
}

for (let run = 0; run < RUNS; run++) {
  const pts = new Map<string, number>()
  const add = (id:number, n:number) => {
    const co = country.get(id); if (!co) return
    pts.set(co, (pts.get(co) ?? 0) + n)
  }
  // league-phase table per competition, carrying the results already played
  const table = new Map<string, Map<number,{p:number;gd:number;gf:number}>>()
  for (const c of COMPS) table.set(c.key, new Map())
  const row = (c:Comp, id:number) => {
    const t = table.get(c.key)!
    if (!t.has(id)) t.set(id, {p:0,gd:0,gf:0})
    return t.get(id)!
  }
  const scoreMatch = (f:Fx, hg:number, ag:number) => {
    const qual = QUAL.test(f.round)
    const win = qual ? 1 : 2, draw = qual ? 0.5 : 1
    add(f.home, hg>ag?win:hg===ag?draw:0)
    add(f.away, ag>hg?win:hg===ag?draw:0)
    if (/League Stage/i.test(f.round)) {
      const h = row(f.comp,f.home), a = row(f.comp,f.away)
      h.p += hg>ag?3:hg===ag?1:0; a.p += ag>hg?3:hg===ag?1:0
      h.gd += hg-ag; a.gd += ag-hg; h.gf += hg; a.gf += ag
    }
  }
  for (const f of known) scoreMatch(f, f.hg!, f.ag!)
  const futureLeague = future.filter(f => /League Stage/i.test(f.round) || QUAL.test(f.round))
  for (const f of futureLeague) {
    const [hg,ag] = simGoals(elo.get(f.home)!, elo.get(f.away)!)
    scoreMatch(f, hg, ag)
  }

  // participation + finishing-position bonuses, and the knockout field
  for (const c of COMPS) {
    const ranked = [...table.get(c.key)!.entries()]
      .sort((x,y)=> y[1].p-x[1].p || y[1].gd-x[1].gd || y[1].gf-x[1].gf)
      .map(([id])=>id)
    ranked.forEach((id, i) => add(id, c.participation + positionBonus(i+1, c)))

    // knockout: 1-8 seeded into R16, 9-24 play off, 25-36 eliminated
    let alive: number[] = []
    const playoff = ranked.slice(8, 24)
    for (let i = 0; i < playoff.length / 2; i++) {
      const a = playoff[i], b = playoff[playoff.length - 1 - i]
      let ag1 = 0, bg1 = 0
      for (const [h, w] of [[a,b],[b,a]] as const) {
        const [hg, agl] = simGoals(elo.get(h)!, elo.get(w)!)
        add(h, hg>agl?2:hg===agl?1:0); add(w, agl>hg?2:hg===agl?1:0)
        if (h===a) { ag1+=hg; bg1+=agl } else { bg1+=hg; ag1+=agl }
      }
      alive.push(ag1===bg1 ? (rand()<0.5?a:b) : ag1>bg1 ? a : b)
    }
    alive = [...ranked.slice(0,8), ...alive]

    for (const roundName of KO_ROUNDS) {
      for (const id of alive) add(id, c.ko)          // reaching the round
      if (roundName === 'Final') {
        const [a,b] = alive
        if (a == null || b == null) break
        const [hg,ag] = simGoals(elo.get(a)!, elo.get(b)!)
        add(a, hg>ag?2:hg===ag?1:0); add(b, ag>hg?2:hg===ag?1:0)
        break
      }
      const next: number[] = []
      for (let i = 0; i < alive.length / 2; i++) {
        const a = alive[i], b = alive[alive.length - 1 - i]
        if (a == null || b == null) continue
        let ga = 0, gb = 0
        for (const [h,w] of [[a,b],[b,a]] as const) {
          const [hg,agl] = simGoals(elo.get(h)!, elo.get(w)!)
          add(h, hg>agl?2:hg===agl?1:0); add(w, agl>hg?2:hg===agl?1:0)
          if (h===a) { ga+=hg; gb+=agl } else { gb+=hg; ga+=agl }
        }
        next.push(ga===gb ? (rand()<0.5?a:b) : ga>gb ? a : b)
      }
      alive = next
    }
  }

  const coefs = [...pts].map(([co,p]) => ({ co, coef: p / clubs.get(co)!.size }))
    .sort((a,b)=>b.coef-a.coef)
  for (const c of coefs) coefSum.set(c.co, (coefSum.get(c.co) ?? 0) + c.coef)
  for (const c of coefs.slice(0,2)) top2.set(c.co, (top2.get(c.co) ?? 0) + 1)
}

const rows = [...coefSum].map(([co,s]) => ({ co, coef: s/RUNS, p: (top2.get(co) ?? 0)/RUNS }))
  .sort((a,b)=>b.p-a.p || b.coef-a.coef)
console.log('\nland            meðalstuðull   líkur á aukasæti')
for (const r of rows.slice(0,8)) {
  console.log(`${r.co.padEnd(14)} ${r.coef.toFixed(3).padStart(9)}      ${(100*r.p).toFixed(1).padStart(6)}%`)
}
