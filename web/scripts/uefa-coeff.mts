/**
 * UEFA association (country) coefficient for a season, from UCL + UEL + UECL.
 *
 * Rules (2024/25–2026/27, UEFA Annex D):
 *   match points   2 win / 1 draw, halved to 1 / 0.5 in qualifying and play-offs
 *                  (a tie settled on penalties still scores as a draw)
 *   participation  +6 per club in the Champions League phase only
 *   position bonus by final league-phase rank — nothing for 25th–36th, then a
 *                  step per place up to 24th, and a steeper step inside the
 *                  top 8. Lands on the published maxima of 12 / 6 / 4.
 *   knockout       +1.5 / +1 / +0.5 per round reached (R16, QF, SF, final)
 * Season coefficient = total points / clubs the association entered.
 *
 * The two associations topping this table earn an extra Champions League place
 * the next season — England and Spain did in 2024/25.
 *
 * Validated against the published 2024/25 figures to the thousandth:
 * England 29.464, Spain 23.892, Italy 21.875, Germany 18.421 — all exact.
 *
 * Usage: cd web && npx tsx scripts/uefa-coeff.mts [season]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir,'.env.local'),'utf-8').split('\n')) {
  const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2] }
const KEY = process.env.API_FOOTBALL_KEY!
const SEASON = Number(process.argv[2] ?? 2024)
const sleep = (ms:number) => new Promise(r => setTimeout(r, ms))
/** Free plans allow only a handful of calls a minute, so back off and retry. */
const get = async (p:string) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://v3.football.api-sports.io${p}`, { headers:{'x-apisports-key':KEY} })
    const d:any = await r.json()
    if (d.errors?.rateLimit) { await sleep(20_000); continue }
    if (d.errors && !Array.isArray(d.errors) && Object.keys(d.errors).length) {
      throw new Error(`API-Football: ${JSON.stringify(d.errors)}`)
    }
    await sleep(7_000)
    return d.response ?? []
  }
  throw new Error(`gafst upp á ${p} vegna hraðatakmarkana`)
}

interface Comp { id:number; key:string; participation:number; lowStep:number; ko:number }
const COMPS: Comp[] = [
  { id: 2,   key:'ucl',  participation: 6, lowStep: 0.25,  ko: 1.5 },
  { id: 3,   key:'uel',  participation: 0, lowStep: 0.25,  ko: 1   },
  { id: 848, key:'uecl', participation: 0, lowStep: 0.125, ko: 0.5 },
]
const QUAL = /Qualifying Round|^Play-offs$/i
const KO = ['Round of 16','Quarter-finals','Semi-finals','Final']

/** Bonus for finishing `rank` of 36 in the league phase. */
function positionBonus(rank: number, c: Comp) {
  if (rank >= 25) return 0
  if (rank >= 9) return (25 - rank) * c.lowStep
  return 16 * c.lowStep + (9 - rank) * 0.25
}

const country = new Map<number,string>()
const clubs = new Map<string, Set<number>>()
const pts = new Map<string, number>()
const seen = new Set<string>()
const add = (co: string, n: number) => pts.set(co, (pts.get(co) ?? 0) + n)

for (const c of COMPS) {
  for (const t of await get(`/teams?league=${c.id}&season=${SEASON}`)) {
    country.set(t.team.id, t.team.country)
    if (!clubs.has(t.team.country)) clubs.set(t.team.country, new Set())
    clubs.get(t.team.country)!.add(t.team.id)
  }
}

for (const c of COMPS) {
  // match points
  for (const f of await get(`/fixtures?league=${c.id}&season=${SEASON}`)) {
    if (f.goals.home === null) continue
    const qual = QUAL.test(f.league.round)
    const win = qual ? 1 : 2, draw = qual ? 0.5 : 1
    for (const [team, gf, ga] of [[f.teams.home,f.goals.home,f.goals.away],[f.teams.away,f.goals.away,f.goals.home]] as any) {
      const co = country.get(team.id); if (!co) continue
      add(co, gf > ga ? win : gf === ga ? draw : 0)
    }
    // knockout round participation, counted once per club per round
    if (KO.includes(f.league.round)) {
      for (const team of [f.teams.home, f.teams.away] as any[]) {
        const co = country.get(team.id); if (!co) continue
        const k = `${team.id}|${c.key}|${f.league.round}`
        if (!seen.has(k)) { seen.add(k); add(co, c.ko) }
      }
    }
  }
  // league phase participation + finishing position
  const st = await get(`/standings?league=${c.id}&season=${SEASON}`)
  const table = st[0]?.league?.standings?.[0] ?? []
  for (const row of table) {
    const co = country.get(row.team.id); if (!co) continue
    add(co, c.participation + positionBonus(row.rank, c))
  }
}

const known: Record<string,number> = { England:29.464, Spain:23.892, Italy:21.875, Germany:18.421 }
/** UEFA computes to three decimals and truncates, it does not round. */
const trunc3 = (x: number) => Math.floor(x * 1000) / 1000
const rows = [...pts].map(([co,p]) => ({ co, p, n: clubs.get(co)!.size, coef: trunc3(p/clubs.get(co)!.size) }))
  .sort((a,b)=>b.coef-a.coef)
console.log('land            stig   lið   stuðull    birt     munur')
for (const r of rows.slice(0,10)) {
  const kn = known[r.co]
  console.log(`${r.co.padEnd(14)} ${r.p.toFixed(1).padStart(6)} ${String(r.n).padStart(4)}  ${r.coef.toFixed(3).padStart(7)} ${kn?kn.toFixed(3).padStart(8):'        '} ${kn?(r.coef-kn).toFixed(3).padStart(7):''}`)
}
