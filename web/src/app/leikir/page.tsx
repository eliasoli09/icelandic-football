import Link from 'next/link'
import { teams, seasonMatches } from '@/lib/queries'

export const revalidate = 300

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'Óráðið'

export default async function LeikirPage() {
  let names = new Map<number, string>()
  let matches: Awaited<ReturnType<typeof seasonMatches>> = []
  try {
    ;[names, matches] = await Promise.all([teams(), seasonMatches()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const besta = matches.filter((m) => m.league === 'besta')
  const byMonth = new Map<string, typeof besta>()
  for (const m of besta) {
    const key = m.date ? m.date.slice(0, 7) : 'óráðið'
    byMonth.set(key, [...(byMonth.get(key) ?? []), m])
  }
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Leikir — Besta deildin 2026</h1>
      <div className="grid gap-6">
        {[...byMonth].map(([month, ms]) => (
          <section key={month}>
            <h2 className="text-sm font-bold muted uppercase tracking-wide mb-2">
              {month === 'óráðið' ? 'Dagsetning óráðin' : new Date(month + '-01').toLocaleString('is-IS', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
            <div className="grid gap-1.5">
              {ms.map((m) => (
                <Link key={m.id} href={`/leikir/${m.id}`} className="card px-4 py-2 flex items-center gap-3 text-sm hover:opacity-90">
                  <span className="muted text-xs w-24 shrink-0">{fmtDate(m.date)}</span>
                  <span className="flex-1 text-right">{nm(m.home_team)}</span>
                  <span className="font-bold num w-14 text-center">
                    {m.status === 'played' ? `${m.home_goals} – ${m.away_goals}` : '–'}
                  </span>
                  <span className="flex-1">{nm(m.away_team)}</span>
                  {m.phase !== 'main' && (
                    <span className="text-[10px] muted uppercase">{m.phase === 'efri' ? 'Efri' : 'Neðri'}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
