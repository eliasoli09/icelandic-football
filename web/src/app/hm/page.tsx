import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { wcMatches, wcPredictions } from '@/lib/queries'
import { ROUND_NAMES, flag } from '@/lib/worldcup'
import { ProbBar } from '@/components/ProbBar'

export const revalidate = 300

export const metadata = { title: 'HM 2026 — Besta spáin' }

const fmt = (d: string) =>
  new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export default async function HmPage() {
  let matches: Awaited<ReturnType<typeof wcMatches>> = []
  let preds: Awaited<ReturnType<typeof wcPredictions>> = new Map()
  try {
    ;[matches, preds] = await Promise.all([wcMatches(), wcPredictions()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!matches.length) return <p className="muted">HM-leikir hlaðast inn fljótlega.</p>

  const rounds = new Map<number, typeof matches>()
  for (const m of matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m])
  // knockout first (current), then group stage below
  const order = [...rounds.keys()].sort((a, b) => (b >= 4 ? b : b - 100) - (a >= 4 ? a : a - 100))

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="display text-2xl font-black" style={{ color: 'var(--accent)' }}>
          HM 2026
        </h1>
        <Link
          href="/vaktin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <Ticket size={15} aria-hidden />
          Miðavaktin — fylgstu með veðmálinu þínu
        </Link>
      </div>
      <p className="text-sm muted mb-6">
        Allir 104 leikirnir · líkur Boltavaktarinnar reiknaðar með Elo-styrk landsliðanna (eloratings.net) og Poisson-vél síðunnar
      </p>

      <div className="grid gap-8">
        {order.map((r) => (
          <section key={r}>
            <h2 className="text-[11px] font-bold muted uppercase tracking-[0.18em] mb-2">{ROUND_NAMES[r] ?? `Umferð ${r}`}</h2>
            <div className="grid gap-1.5">
              {rounds.get(r)!.map((m) => {
                const p = preds.get(m.id)
                const played = m.home_score !== null
                return (
                  <div key={m.id} className="card px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="muted text-xs w-24 shrink-0 num">{fmt(m.date)}</span>
                      <span className="flex-1 text-right inline-flex items-center justify-end gap-2 min-w-0">
                        <span className="truncate">{m.home}</span>
                        <span aria-hidden>{flag(m.home)}</span>
                      </span>
                      <span className="stat w-16 text-center shrink-0">
                        {played ? `${m.home_score} – ${m.away_score}` : '–'}
                      </span>
                      <span className="flex-1 inline-flex items-center gap-2 min-w-0">
                        <span aria-hidden>{flag(m.away)}</span>
                        <span className="truncate">{m.away}</span>
                      </span>
                      {m.grp && <span className="text-[10px] muted uppercase hidden sm:block w-14 text-right">{m.grp.replace('Group', 'Riðill')}</span>}
                    </div>
                    {!played && p && (
                      <div className="mt-2 max-w-md mx-auto">
                        <ProbBar pHome={p.p_home} pDraw={p.p_draw} pAway={p.p_away} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="text-[11px] muted mt-6">
        Úrslit uppfærast sjálfkrafa. Líkurnar eru 90 mínútna líkur (1X2) á hlutlausum velli nema hjá gestgjöfunum.
      </p>
    </div>
  )
}
