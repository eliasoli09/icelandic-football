import Link from 'next/link'
import { ProbBar } from '@/components/ProbBar'
import { TeamBadge } from '@/components/TeamBadge'
import { Reveal } from '@/components/motion'
import { ScorerRace } from '@/components/ScorerRace'
import {
  teams, upcomingWithPredictions, recentResults, scorerSim, lastIngest, teamInfo,
} from '@/lib/queries'
import { displayColor, tint } from '@/lib/teamColors'

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
      teams(), teamInfo(), upcomingWithPredictions(9), recentResults(6), scorerSim('goals'), lastIngest(),
    ])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn — keyrðu fyrst innhleðslu.</p>
  }
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const featured = upcoming[0]
  const rest = upcoming.slice(1)

  return (
    <div className="grid gap-10">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Reveal>
        <section className="pitch card overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="p-6 sm:p-10 grid gap-8 relative">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] muted mb-2">
                Íslensk knattspyrnugreining · Besta deildin & Lengjudeildin
              </p>
              <h1 className="display text-3xl sm:text-5xl font-black tracking-tight mb-2">
                Besta spáin
              </h1>
              <p className="muted text-sm max-w-lg">
                Elo-stig, leikjaspár og 10.000 hermanir af restinni af tímabilinu — uppfærist
                sjálfkrafa eftir hvern einasta leik.
              </p>
              {ingest && (
                <p className="text-[11px] muted mt-3 num">
                  Síðast uppfært {new Date(ingest.run_at).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                </p>
              )}
            </div>

            {featured && (
              <Link
                href={`/leikir/${featured.id}`}
                className="card card-hover relative block p-5 sm:p-7"
                style={{
                  background: `linear-gradient(120deg, ${tint(infos.get(featured.home_team), 0.2)} 0%, transparent 40%, transparent 60%, ${tint(infos.get(featured.away_team), 0.2)} 100%)`,
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] muted mb-4 text-center">
                  Næsti leikur · {fmtDate(featured.date)}{featured.venue ? ` · ${featured.venue}` : ''}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 mb-5">
                  <span className="flex items-center justify-end gap-3 min-w-0">
                    <span className="display text-lg sm:text-3xl font-extrabold truncate" style={{ color: displayColor(infos.get(featured.home_team)) }}>
                      {nm(featured.home_team)}
                    </span>
                    <TeamBadge info={infos.get(featured.home_team)} size={44} />
                  </span>
                  <span className="stat text-xl sm:text-2xl muted">–</span>
                  <span className="flex items-center gap-3 min-w-0">
                    <TeamBadge info={infos.get(featured.away_team)} size={44} />
                    <span className="display text-lg sm:text-3xl font-extrabold truncate" style={{ color: displayColor(infos.get(featured.away_team)) }}>
                      {nm(featured.away_team)}
                    </span>
                  </span>
                </div>
                {featured.prediction && (
                  <ProbBar pHome={featured.prediction.p_home} pDraw={featured.prediction.p_draw} pAway={featured.prediction.p_away} />
                )}
              </Link>
            )}
          </div>
        </section>
      </Reveal>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="display text-lg font-extrabold mb-4">Næstu leikir</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {rest.map((m, i) => (
              <Reveal key={m.id} delay={Math.min(i * 0.05, 0.3)}>
                <Link href={`/leikir/${m.id}`} className="card card-hover block p-4 h-full">
                  <div className="flex justify-between text-[11px] muted mb-3 font-medium">
                    <span className="num">{fmtDate(m.date)}</span>
                    <span>{m.league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'}</span>
                  </div>
                  <div className="grid gap-2 mb-3 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <TeamBadge info={infos.get(m.home_team)} size={20} /> {nm(m.home_team)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <TeamBadge info={infos.get(m.away_team)} size={20} /> {nm(m.away_team)}
                    </span>
                  </div>
                  {m.prediction ? (
                    <ProbBar pHome={m.prediction.p_home} pDraw={m.prediction.p_draw} pAway={m.prediction.p_away} compact />
                  ) : (
                    <p className="text-xs muted">Spá reiknast eftir næstu innhleðslu.</p>
                  )}
                  {m.venue && <p className="text-[11px] muted mt-2">{m.venue}</p>}
                </Link>
              </Reveal>
            ))}
            {!rest.length && !featured && <p className="muted text-sm">Engir ókomnir leikir í grunninum.</p>}
          </div>

          <h2 className="display text-lg font-extrabold mt-10 mb-4">Nýjustu úrslit</h2>
          <div className="grid gap-2">
            {results.map((m, i) => (
              <Reveal key={m.id} delay={Math.min(i * 0.04, 0.25)}>
                <Link
                  href={`/leikir/${m.id}`}
                  className="card card-hover group px-4 py-2.5 flex items-center justify-between text-sm gap-2"
                >
                  <span className="w-[38%] inline-flex items-center gap-2 min-w-0">
                    <TeamBadge info={infos.get(m.home_team)} />
                    <span className="truncate font-medium">{nm(m.home_team)}</span>
                  </span>
                  <span className="stat text-base px-2 py-0.5 rounded-md" style={{ background: 'var(--surface-2)' }}>
                    {m.home_goals}–{m.away_goals}
                  </span>
                  <span className="w-[38%] justify-end inline-flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium text-right">{nm(m.away_team)}</span>
                    <TeamBadge info={infos.get(m.away_team)} />
                  </span>
                  <span className="hidden sm:block text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" style={{ color: 'var(--accent)' }}>
                    sjá leik →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <aside>
          <Reveal delay={0.1}>
            <h2 className="display text-lg font-extrabold mb-4">Markakóngskapphlaupið</h2>
            <div className="card strip p-5">
              <ScorerRace
                rows={scorers.slice(0, 8).map((s) => ({ name: s.name, current: s.current, pWin: s.p_win }))}
              />
              <p className="text-[11px] muted mt-4">% = líkur á að enda markakóngur tímabilsins</p>
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  )
}
