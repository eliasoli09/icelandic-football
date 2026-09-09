/**
 * UEFA association (country) coefficient for a season, from UCL + UEL + UECL:
 * match points (2/1, halved in qualifying) plus participation and knockout
 * bonuses, divided by the number of clubs the association entered.
 *
 * The two associations topping this table earn an extra Champions League place
 * the next season — England and Spain did in 2024/25.
 *
 * STATUS: match points and the participation/knockout bonuses are in, and the
 * country ordering already matches reality. Still missing the 2024/25
 * league-phase FINISHING-POSITION bonuses, so totals run 1.7-3.4 short of the
 * published figures. Do not publish these numbers until that table is added.
 *
 * Usage: cd web && npx tsx scripts/uefa-coeff.mts
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(webDir,'.env.local'),'utf-8').split('\n')) {
  const m=line.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2] }
const KEY = process.env.API_FOOTBALL_KEY!
const get = async (p:string) => {
  const r = await fetch(`https://v3.football.api-sports.io${p}`, { headers:{'x-apisports-key':KEY} })
  const d:any = await r.json(); return d.response ?? []
}
// 2024/25 bonus table: league-phase participation, then per knockout round
const COMPS = [
  { id: 2,   key:'ucl',  phase: 4,   r16: 5, later: 1 },
  { id: 3,   key:'uel',  phase: 2,   r16: 1, later: 1 },
  { id: 848, key:'uecl', phase: 0.5, r16: 1, later: 1 },
]
const QUAL = /Qualifying Round|^Play-offs$/i          // 1 / 0.5
const KO_BONUS = ['Round of 16','Quarter-finals','Semi-finals','Final']

const country = new Map<number,string>()
const clubs = new Map<string, Set<number>>()   // country -> club ids
const pts = new Map<string, number>()          // country -> points
const reached = new Map<string, Set<string>>() // `${club}|${comp}` -> rounds

for (const c of COMPS) {
  for (const t of await get(`/teams?league=${c.id}&season=2024`)) {
    country.set(t.team.id, t.team.country)
    if (!clubs.has(t.team.country)) clubs.set(t.team.country, new Set())
    clubs.get(t.team.country)!.add(t.team.id)
  }
}
for (const c of COMPS) {
  for (const f of await get(`/fixtures?league=${c.id}&season=2024`)) {
    if (f.goals.home === null) continue
    const round = f.league.round as string
    const qual = QUAL.test(round)
    const win = qual ? 1 : 2, draw = qual ? 0.5 : 1
    for (const [team, gf, ga] of [[f.teams.home, f.goals.home, f.goals.away],[f.teams.away, f.goals.away, f.goals.home]] as any) {
      const co = country.get(team.id); if (!co) continue
      const add = gf > ga ? win : gf === ga ? draw : 0
      pts.set(co, (pts.get(co) ?? 0) + add)
      if (KO_BONUS.includes(round) || /League Stage/i.test(round)) {
        const k = `${team.id}|${c.key}`
        if (!reached.has(k)) reached.set(k, new Set())
        reached.get(k)!.add(/League Stage/i.test(round) ? 'phase' : round)
      }
    }
  }
}
// knockout-round bonuses, once per club per round reached
for (const [k, rounds] of reached) {
  const [id, comp] = k.split('|')
  const co = country.get(Number(id)); if (!co) continue
  const c = COMPS.find(x=>x.key===comp)!
  let b = 0
  if (rounds.has('phase')) b += c.phase
  if (rounds.has('Round of 16')) b += c.r16
  for (const r of ['Quarter-finals','Semi-finals','Final']) if (rounds.has(r)) b += c.later
  pts.set(co, (pts.get(co) ?? 0) + b)
}

const known: Record<string,number> = { England:29.464, Spain:23.892, Italy:21.875, Germany:18.421 }
const rows = [...pts].map(([co,p]) => ({ co, p, n: clubs.get(co)!.size, coef: p/clubs.get(co)!.size }))
  .sort((a,b)=>b.coef-a.coef)
console.log('land            stig    lið   stuðull   birt      munur')
for (const r of rows.slice(0,8)) {
  const kn = known[r.co]
  console.log(`${r.co.padEnd(14)} ${r.p.toFixed(1).padStart(6)} ${String(r.n).padStart(5)}  ${r.coef.toFixed(3).padStart(7)}  ${kn?kn.toFixed(3).padStart(7):'      -'}  ${kn?(r.coef-kn).toFixed(3).padStart(7):''}`)
}
