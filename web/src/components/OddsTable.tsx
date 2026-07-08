import { ExternalLink, Shield } from 'lucide-react'
import { BOOKMAKER_URLS } from '@/lib/odds'
import type { MatchOddsRow } from '@/lib/queries'

/**
 * Bookmaker 1X2 odds under a match, sorted best→worst on the outcome the
 * model considers most likely. Best price per column is highlighted.
 * The model's own margin-free odds sit pinned on top as "Boltavaktinn".
 */
export function OddsTable({
  odds,
  fair,
  favored,
  homeName,
  awayName,
}: {
  odds: MatchOddsRow[]
  fair?: { home: number; draw: number; away: number } | null
  favored: 'home' | 'draw' | 'away'
  homeName: string
  awayName: string
}) {
  if (!odds.length) return null
  const rows = [...odds].sort((a, b) => b[favored] - a[favored])
  const best = {
    home: Math.max(...odds.map((o) => o.home)),
    draw: Math.max(...odds.map((o) => o.draw)),
    away: Math.max(...odds.map((o) => o.away)),
  }
  const favLabel = favored === 'home' ? homeName : favored === 'away' ? awayName : 'jafntefli'
  const updated = new Date(Math.max(...odds.map((o) => +new Date(o.fetched_at))))
  const cell = (v: number, isBest: boolean) => (
    <td
      className="text-right num py-1"
      style={isBest ? { color: 'var(--accent)', fontWeight: 800 } : undefined}
    >
      {v.toFixed(2)}
    </td>
  )
  return (
    <section className="card p-5">
      <h2 className="display font-extrabold mb-1">Stuðlar veðbanka</h2>
      <p className="text-xs muted mb-3">
        Raðað eftir besta stuðlinum á líklegustu úrslitin samkvæmt spánni ({favLabel}) — bestu
        stuðlar í hverjum dálki gylltir.
      </p>
      <div className="table-wrap">
        <table className="min-w-full text-sm [&_td]:px-1.5 [&_th]:px-1.5">
          <thead>
            <tr className="muted text-xs text-left">
              <th className="py-1 font-semibold">Veðbanki</th>
              <th className="text-right font-semibold" title={homeName}>1</th>
              <th className="text-right font-semibold" title="Jafntefli">X</th>
              <th className="text-right font-semibold" title={awayName}>2</th>
            </tr>
          </thead>
          <tbody>
            {fair && (
              <tr className="trow" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}>
                <td className="py-1.5 font-bold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                    <Shield size={13} aria-hidden />
                    Boltavaktinn
                    <span className="text-[9px] font-semibold muted uppercase tracking-wide">spáin okkar</span>
                  </span>
                </td>
                <td className="text-right num py-1.5 font-bold">{fair.home.toFixed(2)}</td>
                <td className="text-right num py-1.5 font-bold">{fair.draw.toFixed(2)}</td>
                <td className="text-right num py-1.5 font-bold">{fair.away.toFixed(2)}</td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o.bookmaker} className="trow">
                <td className="py-1 font-semibold whitespace-nowrap">
                  {BOOKMAKER_URLS[o.bookmaker] ? (
                    <a
                      href={BOOKMAKER_URLS[o.bookmaker]}
                      target="_blank"
                      rel="noopener nofollow"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {o.bookmaker}
                      <ExternalLink size={11} aria-hidden style={{ color: 'var(--text-2)' }} />
                    </a>
                  ) : (
                    o.bookmaker
                  )}
                </td>
                {cell(o.home, o.home === best.home)}
                {cell(o.draw, o.draw === best.draw)}
                {cell(o.away, o.away === best.away)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] muted mt-3">
        Boltavaktar-stuðlarnir eru hreinar líkur spálíkansins (1/líkur, engin álagning) — ekki veðmálstilboð.
        Uppfært {updated.toLocaleDateString('is-IS', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · Stuðlar geta breyst · 18 ára aldurstakmark — spilaðu ábyrgt
      </p>
    </section>
  )
}
