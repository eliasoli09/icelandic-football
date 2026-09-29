import { db } from '@/lib/db'
import { ProbBar } from '@/components/ProbBar'
import { OddsTable } from '@/components/OddsTable'
import type { MatchOddsRow } from '@/lib/queries'
import { flagUrl, nationName, nationsLambdas, tournamentName, type NationRow } from '@/lib/nations'

export const revalidate = 300

export const metadata = {
  title: 'Landsliðið - Besta spáin',
  description: 'Leikir íslenska landsliðsins, riðillinn í Þjóðadeildinni og líkur á hverjum leik.',
}

const ICELAND = 'IS'
const COLS =
  'key, date, home_code, away_code, home, away, tournament_code, tournament, venue_code, neutral, home_goals, away_goals, elo_home, elo_away, p_home, p_draw, p_away'

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('is-IS', { weekday: 'short', day: 'numeric', month: 'long' })

function Flag({ code }: { code: string }) {
  const url = flagUrl(code)
  if (!url) return <span className="inline-block w-5" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={20} height={14} className="inline-block rounded-[2px] align-[-2px]" />
}

function Team({ code, name, bold }: { code: string; name: string; bold?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${bold ? 'font-bold' : ''}`}>
      <Flag code={code} />
      {nationName(code, name)}
    </span>
  )
}

interface Standing { code: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }

function table(teams: Map<string, string>, played: NationRow[]): Standing[] {
  const s = new Map<string, Standing>()
  for (const [code, name] of teams) s.set(code, { code, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })
  for (const m of played) {
    const h = s.get(m.home_code)!, a = s.get(m.away_code)!
    const hg = m.home_goals!, ag = m.away_goals!
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
    if (hg > ag) { h.w++; a.l++; h.pts += 3 } else if (hg < ag) { a.w++; h.l++; a.pts += 3 } else { h.d++; a.d++; h.pts++; a.pts++ }
  }
  return [...s.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf)
}

function poissonDraw(l: number, rnd: () => number) {
  const L = Math.exp(-l)
  let k = 0, p = 1
  do { k++; p *= rnd() } while (p > L)
  return k - 1
}

/** Monte Carlo of the rest of the group; tiebreak simplified to points, GD, GF. */
function simulateGroup(teams: Map<string, string>, played: NationRow[], upcoming: NationRow[], runs = 10000) {
  let seed = 20260929
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const pos = new Map([...teams.keys()].map((c) => [c, new Array(teams.size).fill(0)]))
  const lambdas = upcoming.map((m) => nationsLambdas(m.elo_home ?? 1500, m.elo_away ?? 1500, m.neutral))
  for (let r = 0; r < runs; r++) {
    const sim = upcoming.map((m, i) => ({ ...m, home_goals: poissonDraw(lambdas[i].home, rnd), away_goals: poissonDraw(lambdas[i].away, rnd) }))
    table(teams, [...played, ...sim]).forEach((row, i) => pos.get(row.code)![i]++)
  }
  return new Map([...pos].map(([c, arr]) => [c, arr.map((n) => n / runs)]))
}

function MatchLine({ m }: { m: NationRow }) {
  const played = m.home_goals !== null
  return (
    <li className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <div className="muted text-xs mb-1">{fmtDate(m.date)}</div>
      <div className="grid grid-cols-[1fr_3.5rem_1fr] items-center gap-2 text-sm">
        <span className="flex justify-end text-right min-w-0"><Team code={m.home_code} name={m.home} bold={m.home_code === ICELAND} /></span>
        <span className="num font-bold text-center">{played ? `${m.home_goals}-${m.away_goals}` : '-'}</span>
        <span className="min-w-0"><Team code={m.away_code} name={m.away} bold={m.away_code === ICELAND} /></span>
      </div>
      {!played && m.p_home !== null && (
        <div className="mt-1.5"><ProbBar pHome={m.p_home} pDraw={m.p_draw!} pAway={m.p_away!} compact /></div>
      )}
    </li>
  )
}

export default async function LandslidPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [iceRes, windowRes] = await Promise.all([
    db().from('nations_matches').select(COLS)
      .or(`home_code.eq.${ICELAND},away_code.eq.${ICELAND}`)
      .order('date', { ascending: false }).limit(60),
    db().from('nations_matches').select(COLS)
      .gte('date', '2026-09-01').lte('date', '2027-04-01').like('tournament_code', 'EN_')
      .order('date').range(0, 999),
  ])
  const ice = (iceRes.data ?? []) as NationRow[]
  if (!ice.length) return <p className="muted">Landsleikjagögn hlaðast inn fljótlega.</p>
  const nl = (windowRes.data ?? []) as NationRow[]

  const upcomingIce = ice.filter((m) => m.home_goals === null).sort((a, b) => a.date.localeCompare(b.date))
  const recent = ice.filter((m) => m.home_goals !== null).slice(0, 10)
  const next = upcomingIce[0]

  let odds: MatchOddsRow[] = []
  if (next) {
    const { data } = await db().from('nations_odds').select('bookmaker, home, draw, away, fetched_at').eq('match_key', next.key)
    odds = (data ?? []) as MatchOddsRow[]
  }

  // Iceland's Nations League group = the teams linked to Iceland by this season's fixtures
  const groupTeams = new Map<string, string>([[ICELAND, 'Iceland']])
  let grew = true
  while (grew) {
    grew = false
    for (const m of nl) {
      const hin = groupTeams.has(m.home_code), ain = groupTeams.has(m.away_code)
      if (hin !== ain) { groupTeams.set(m.home_code, m.home); groupTeams.set(m.away_code, m.away); grew = true }
    }
  }
  const group = nl.filter((m) => groupTeams.has(m.home_code))
  const groupPlayed = group.filter((m) => m.home_goals !== null)
  const groupUpcoming = group.filter((m) => m.home_goals === null)
  const standings = table(groupTeams, groupPlayed)
  const sim = simulateGroup(groupTeams, groupPlayed, groupUpcoming)
  const groupLabel = group[0] ? tournamentName(group[0].tournament_code, group[0].tournament) : 'Þjóðadeildin'

  const soon = nl.filter((m) => m.home_goals === null && m.date >= today && !groupTeams.has(m.home_code)).slice(0, 30)
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-3xl font-extrabold">Landsliðið</h1>
        <p className="muted text-sm mt-1">
          Leikir Íslands og Þjóðadeildarinnar. Elo-einkunnir frá eloratings.net, líkurnar úr eigin líkani sem er
          kvarðað á 10.641 landsleik Evrópuþjóða frá 1990.
        </p>
      </header>

      {next && (
        <section className="card p-5">
          <p className="text-xs muted mb-2">Næsti leikur - {tournamentName(next.tournament_code, next.tournament)} - {fmtDate(next.date)}</p>
          <div className="flex items-center justify-between text-lg mb-1">
            <Team code={next.home_code} name={next.home} bold />
            <span className="muted text-sm">gegn</span>
            <Team code={next.away_code} name={next.away} bold />
          </div>
          <div className="flex justify-between text-xs muted mb-3 num">
            <span>Elo {next.elo_home}</span>
            <span>{next.neutral ? 'hlutlaus völlur' : `heimavöllur ${nationName(next.home_code, next.home)}`}</span>
            <span>Elo {next.elo_away}</span>
          </div>
          {next.p_home !== null && <ProbBar pHome={next.p_home} pDraw={next.p_draw!} pAway={next.p_away!} />}
        </section>
      )}

      {next && odds.length > 0 && next.p_home !== null && (
        <OddsTable
          odds={odds}
          fair={{ home: 1 / next.p_home, draw: 1 / next.p_draw!, away: 1 / next.p_away! }}
          favored={next.p_home >= next.p_away! ? (next.p_home >= next.p_draw! ? 'home' : 'draw') : next.p_away! >= next.p_draw! ? 'away' : 'draw'}
          homeName={nationName(next.home_code, next.home)}
          awayName={nationName(next.away_code, next.away)}
        />
      )}

      {group.length > 0 && (
        <section className="card p-5">
          <h2 className="display font-extrabold mb-1">Riðillinn - {groupLabel}</h2>
          <p className="text-xs muted mb-3">Líkur á hverju sæti úr 10.000 hermunum á leikjunum sem eftir eru (jöfn stig: markatala, svo skoruð mörk).</p>
          <div className="table-wrap">
            <table className="min-w-full text-sm [&_td]:px-1.5 [&_th]:px-1.5">
              <thead>
                <tr className="muted text-xs text-left">
                  <th className="py-1">Lið</th><th className="text-right">L</th><th className="text-right">Mörk</th><th className="text-right">Stig</th>
                  {standings.map((_, i) => <th key={i} className="text-right">{i + 1}. sæti</th>)}
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr key={s.code} className="trow">
                    <td className="py-1.5"><Team code={s.code} name={s.name} bold={s.code === ICELAND} /></td>
                    <td className="text-right num">{s.p}</td>
                    <td className="text-right num">{s.gf}:{s.ga}</td>
                    <td className="text-right num font-bold">{s.pts}</td>
                    {sim.get(s.code)!.map((p, i) => <td key={i} className="text-right num muted">{pct(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4">{group.map((m) => <MatchLine key={m.key} m={m} />)}</ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="display font-extrabold mb-2">Síðustu leikir Íslands</h2>
        <ul>{recent.map((m) => <MatchLine key={m.key} m={m} />)}</ul>
      </section>

      {soon.length > 0 && (
        <section className="card p-5">
          <h2 className="display font-extrabold mb-2">Aðrir leikir í Þjóðadeildinni</h2>
          <ul>{soon.map((m) => <MatchLine key={m.key} m={m} />)}</ul>
        </section>
      )}
    </div>
  )
}
