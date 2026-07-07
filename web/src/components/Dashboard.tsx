'use client'

import Link from 'next/link'
import {
  Trophy, CalendarDays, MapPin, TrendingUp, TrendingDown, Minus,
  Crown, Target, Activity, ArrowRight, BarChart3,
} from 'lucide-react'
import { useLeague } from './LeagueContext'
import { LeagueSwitcher } from './LeagueSwitcher'
import { ProbBar } from './ProbBar'
import { FormBadges } from './FormBadges'
import { TeamBadge } from './TeamBadge'
import { CountUp } from './motion'
import type { DashboardBundle, DashboardTeam } from '@/lib/dashboard'
import { displayColor, tint } from '@/lib/teamColors'

const fmtKick = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('is-IS', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : 'Óráðið'

function SectionHead({
  icon: Icon,
  title,
  href,
  hrefLabel,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; 'aria-hidden'?: boolean }>
  title: string
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="display text-sm font-extrabold uppercase tracking-[0.12em] inline-flex items-center gap-2">
        <Icon size={15} aria-hidden style={{ color: 'var(--accent)' }} />
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs font-semibold inline-flex items-center gap-1 muted hover:opacity-80">
          {hrefLabel ?? 'Sjá allt'} <ArrowRight size={12} aria-hidden />
        </Link>
      )}
    </div>
  )
}

export function Dashboard({
  bundles,
  teams,
}: {
  bundles: Record<'besta' | 'lengjudeild', DashboardBundle>
  teams: Record<number, DashboardTeam>
}) {
  const { league } = useLeague()
  const d = bundles[league]
  const info = (id: number | null | undefined) => (id != null ? teams[id] : undefined)
  const nm = (id: number) => teams[id]?.name ?? `#${id}`

  const Pct = ({ v, best }: { v: number | null; best: boolean }) => (
    <span
      className={`stat text-[13px] w-11 text-center py-1 rounded-md ${best ? '' : 'muted'}`}
      style={best ? { background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' } : {}}
    >
      {v === null ? '—' : `${Math.round(v * 100)}%`}
    </span>
  )

  return (
    <div key={league} className="fade-up grid gap-6">
        {/* ── Hero band ─────────────────────────────────────────── */}
        <section className="pitch card overflow-hidden">
          <div className="p-6 sm:p-8 grid gap-6 lg:grid-cols-[1.1fr_1fr] items-center relative">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] muted mb-2">
                Íslensk knattspyrnugreining
              </p>
              <h1 className="display text-3xl sm:text-5xl font-black tracking-tight mb-1" style={{ color: 'var(--accent)' }}>
                {d.title}
              </h1>
              <p className="muted text-sm mb-5">{d.tagline}</p>
              <LeagueSwitcher />
            </div>

            {d.featured ? (
              <Link
                href={`/leikir/${d.featured.id}`}
                className="card card-hover block p-5"
                style={{
                  background: `linear-gradient(120deg, ${tint(info(d.featured.home), 0.18)} 0%, transparent 45%, transparent 55%, ${tint(info(d.featured.away), 0.18)} 100%)`,
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] muted mb-4 inline-flex items-center gap-1.5">
                  <CalendarDays size={12} aria-hidden style={{ color: 'var(--accent)' }} />
                  Næsti leikur · {fmtKick(d.featured.date)}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
                  <span className="flex flex-col items-center gap-2 min-w-0">
                    <TeamBadge info={info(d.featured.home)} size={46} />
                    <span className="font-bold text-sm truncate max-w-full" style={{ color: displayColor(info(d.featured.home)) }}>
                      {nm(d.featured.home)}
                    </span>
                  </span>
                  <span className="display text-base font-black muted">gegn</span>
                  <span className="flex flex-col items-center gap-2 min-w-0">
                    <TeamBadge info={info(d.featured.away)} size={46} />
                    <span className="font-bold text-sm truncate max-w-full" style={{ color: displayColor(info(d.featured.away)) }}>
                      {nm(d.featured.away)}
                    </span>
                  </span>
                </div>
                {d.featured.pHome !== null && (
                  <ProbBar pHome={d.featured.pHome} pDraw={d.featured.pDraw!} pAway={d.featured.pAway!} compact />
                )}
                {d.featured.venue && (
                  <p className="text-[11px] muted mt-3 inline-flex items-center gap-1">
                    <MapPin size={11} aria-hidden /> {d.featured.venue}
                  </p>
                )}
              </Link>
            ) : (
              <div className="card p-5 text-sm muted">Engir ókomnir leikir í grunninum.</div>
            )}
          </div>
        </section>

        {/* ── Bento grid ────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Standings */}
          <section className="card p-5 lg:row-span-2">
            <SectionHead icon={Trophy} title="Staðan" href="/tafla" hrefLabel="Sjá alla stöðu" />
            <table className="w-full text-[13px]">
              <thead>
                <tr className="muted text-[10px] uppercase tracking-wide text-left">
                  <th className="py-1 font-semibold w-7">#</th>
                  <th className="font-semibold">Lið</th>
                  <th className="text-right font-semibold">L</th>
                  <th className="text-right font-semibold">Mörk</th>
                  <th className="text-right font-semibold">Stig</th>
                </tr>
              </thead>
              <tbody>
                {d.standings.map((r, i) => (
                  <tr key={r.teamId} className={`trow zone ${r.zone ? `zone-${r.zone}` : ''}`}>
                    <td className="py-1.5 pl-2 num muted">{i + 1}</td>
                    <td className="font-semibold whitespace-nowrap">
                      <TeamBadge info={info(r.teamId)} size={16} /> {nm(r.teamId)}
                    </td>
                    <td className="text-right num muted">{r.played}</td>
                    <td className="text-right num muted whitespace-nowrap">{r.gf}:{r.ga}</td>
                    <td className="text-right stat">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 grid gap-1">
              {d.zoneLegend.map((z) => (
                <p key={z.label} className="text-[10px] muted inline-flex items-center gap-2">
                  <span className={`zone ${z.cls} inline-block w-3 h-3`} style={{ position: 'relative' }} aria-hidden />
                  {z.label}
                </p>
              ))}
            </div>
          </section>

          {/* Fixtures with 1X2 */}
          <section className="card p-5 lg:col-span-2">
            <SectionHead icon={CalendarDays} title="Næstu leikir" href="/leikir" hrefLabel="Sjá alla leiki" />
            <div className="grid gap-1">
              {d.fixtures.map((f) => {
                const best = Math.max(f.pHome ?? -1, f.pDraw ?? -1, f.pAway ?? -1)
                return (
                  <Link key={f.id} href={`/leikir/${f.id}`} className="trow flex items-center gap-2 px-2 py-2 rounded-lg min-h-[44px]">
                    <span className="flex-1 min-w-0 flex items-center gap-1.5 text-sm font-semibold">
                      <TeamBadge info={info(f.home)} size={16} />
                      <span className="truncate">{nm(f.home)}</span>
                      <span className="muted text-xs px-0.5">–</span>
                      <TeamBadge info={info(f.away)} size={16} />
                      <span className="truncate">{nm(f.away)}</span>
                    </span>
                    <span className="hidden sm:block text-[11px] muted num whitespace-nowrap">{fmtKick(f.date)}</span>
                    <span className="flex gap-1">
                      <Pct v={f.pHome} best={f.pHome === best} />
                      <Pct v={f.pDraw} best={f.pDraw === best} />
                      <Pct v={f.pAway} best={f.pAway === best} />
                    </span>
                  </Link>
                )
              })}
              {!d.fixtures.length && <p className="muted text-sm py-2">Engir fleiri leikir á dagskrá.</p>}
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-[10px] muted">1 · X · 2 — líklegasta úrslitið litað</span>
            </div>
          </section>

          {/* Form */}
          <section className="card p-5">
            <SectionHead icon={Activity} title="Lið í formi" />
            <div className="grid gap-2.5">
              {d.form.map((f, i) => (
                <div key={f.teamId} className="flex items-center gap-2 text-sm">
                  <span className="num muted w-5">{i + 1}</span>
                  <TeamBadge info={info(f.teamId)} size={16} />
                  <span className="font-semibold flex-1 truncate">{nm(f.teamId)}</span>
                  <FormBadges form={f.form} />
                  <span className="stat w-7 text-right" style={{ color: 'var(--accent)' }}>{f.points5}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] muted mt-3">Stig í síðustu 5 leikjum</p>
          </section>

          {/* Scorers */}
          <section className="card p-5">
            <SectionHead icon={Target} title="Markahæstu menn" href="/leikmenn" hrefLabel="Sjá alla" />
            <div className="grid gap-2.5">
              {d.scorers.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className={`num w-5 ${i === 0 ? 'rank-top stat' : 'muted'}`}>{i + 1}</span>
                  {i === 0 && <Crown size={13} aria-hidden style={{ color: 'var(--accent)' }} />}
                  <span className="font-semibold flex-1 truncate">{s.name}</span>
                  {s.teamId != null && <TeamBadge info={info(s.teamId)} size={15} />}
                  <span className="stat w-6 text-right">{s.goals}</span>
                  {s.pWin !== null && (
                    <span className="text-[11px] num w-9 text-right" style={{ color: 'var(--accent)' }}>
                      {Math.round(s.pWin * 100)}%
                    </span>
                  )}
                </div>
              ))}
              {!d.scorers.length && <p className="muted text-sm">Engin mörk enn skráð.</p>}
            </div>
            {d.league === 'besta' && <p className="text-[10px] muted mt-3">% = líkur á markakóngstitli</p>}
          </section>

          {/* Elo */}
          <section className="card p-5">
            <SectionHead icon={BarChart3} title="Elo ranking" href="/elo" hrefLabel="Sjá alla" />
            <div className="grid gap-2.5">
              {d.elo.map((e, i) => (
                <div key={e.teamId} className="flex items-center gap-2 text-sm">
                  <span className={`num w-5 ${i < 3 ? 'rank-top stat' : 'muted'}`}>{i + 1}</span>
                  <TeamBadge info={info(e.teamId)} size={16} />
                  <span className="font-semibold flex-1 truncate">{nm(e.teamId)}</span>
                  <span className="stat text-base"><CountUp value={e.elo} /></span>
                  <span className={`pill ${e.change > 1 ? 'pill-win' : e.change < -1 ? 'pill-loss' : 'pill-flat'}`}>
                    {e.change > 1 ? <TrendingUp size={11} aria-hidden /> : e.change < -1 ? <TrendingDown size={11} aria-hidden /> : <Minus size={11} aria-hidden />}
                    {e.change >= 0 ? '+' : ''}{e.change}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Key stats */}
          <section className="card p-5 lg:col-span-3">
            <SectionHead icon={Trophy} title="Lykiltölur deildarinnar" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {d.keyStats.map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
                  <p className="stat text-2xl mb-1" style={{ color: 'var(--accent)' }}>{s.value}</p>
                  <p className="text-xs font-semibold leading-tight">{s.label}</p>
                  <p className="text-[10px] muted">{s.sub}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
    </div>
  )
}
