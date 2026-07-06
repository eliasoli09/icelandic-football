import Link from 'next/link'
import { ProbBar } from '@/components/ProbBar'
import {
  teams, upcomingWithPredictions, recentResults, scorerSim, lastIngest, teamInfo,
} from '@/lib/queries'
import { TeamBadge } from '@/components/TeamBadge'

export const revalidate = 300

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''

export default async function Home() {
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let upcoming: Awaited<ReturnType<typeof upcomingWithPredictions>> = []
  let results: Awaited<ReturnType<typeof recentResults>> = []
  let scorers: Awaited<ReturnType<typeof scorerSim>> = []
  let ingest: Awaited<ReturnType<typeof lastIngest>> = null
  try {
    ;[names, infos, upcoming, results, scorers, ingest] = await Promise.all([
      teams(), teamInfo(), upcomingWithPredictions(8), recentResults(6), scorerSim('goals'), lastIngest(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn — keyrðu fyrst innhleðslu.</p>
  }
  const nm = (id: number) => names.get(id) ?? `#${id}`
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="text-xl font-bold mb-4">Næstu leikir</h1>
        <div className="grid gap-3">
          {upcoming.map((m) => (
            <Link key={m.id} href={`/leikir/${m.id}`} className="card p-4 hover:opacity-90">
              <div className="flex justify-between text-xs muted mb-2">
                <span>{fmtDate(m.date)} · {m.venue ?? ''}</span>
                <span>{m.league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'}</span>
              </div>
              <div className="flex items-center justify-between font-semibold mb-3">
                <span className="inline-flex items-center gap-2"><TeamBadge info={infos.get(m.home_team)} size={22} /> {nm(m.home_team)}</span>
                <span className="muted text-sm">gegn</span>
                <span className="inline-flex items-center gap-2">{nm(m.away_team)} <TeamBadge info={infos.get(m.away_team)} size={22} /></span>
              </div>
              {m.prediction ? (
                <ProbBar pHome={m.prediction.p_home} pDraw={m.prediction.p_draw} pAway={m.prediction.p_away} compact />
              ) : (
                <p className="text-xs muted">Spá reiknast eftir næstu innhleðslu.</p>
              )}
            </Link>
          ))}
          {!upcoming.length && <p className="muted text-sm">Engir ókomnir leikir í grunninum.</p>}
        </div>
        <h2 className="text-lg font-bold mt-8 mb-3">Nýjustu úrslit</h2>
        <div className="grid gap-2">
          {results.map((m) => (
            <Link key={m.id} href={`/leikir/${m.id}`} className="card px-4 py-2.5 flex items-center justify-between text-sm hover:opacity-90">
              <span className="w-2/5 inline-flex items-center gap-2"><TeamBadge info={infos.get(m.home_team)} /> {nm(m.home_team)}</span>
              <span className="font-bold num">{m.home_goals} – {m.away_goals}</span>
              <span className="w-2/5 justify-end inline-flex items-center gap-2">{nm(m.away_team)} <TeamBadge info={infos.get(m.away_team)} /></span>
            </Link>
          ))}
        </div>
      </section>
      <aside>
        <h2 className="text-lg font-bold mb-3">Markakóngskapphlaupið</h2>
        <div className="card p-4">
          {scorers.slice(0, 8).map((s, i) => (
            <div key={s.name} className="flex items-center justify-between py-1.5 text-sm" style={i ? { borderTop: '1px solid var(--border)' } : {}}>
              <span className="truncate pr-2">{s.name}</span>
              <span className="num muted">{s.current}</span>
              <span className="num font-semibold w-12 text-right" style={{ color: 'var(--accent)' }}>
                {Math.round(s.p_win * 100)}%
              </span>
            </div>
          ))}
          {!scorers.length && <p className="muted text-sm">Reiknast eftir innhleðslu.</p>}
          <p className="text-[11px] muted mt-2">% = líkur á að enda markakóngur</p>
        </div>
        {ingest && (
          <p className="text-[11px] muted mt-4">
            Síðast uppfært: {new Date(ingest.run_at).toLocaleString('is-IS', { timeZone: 'UTC' })}
          </p>
        )}
      </aside>
    </div>
  )
}
