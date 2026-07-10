import { wcMatches } from '@/lib/queries'
import { flag } from '@/lib/worldcup'
import { SlipBuilder } from '@/components/SlipBuilder'

export const revalidate = 300

export const metadata = { title: 'Miðavaktin — Besta spáin' }

export default async function VaktinPage() {
  let matches: Awaited<ReturnType<typeof wcMatches>> = []
  try {
    matches = await wcMatches()
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const upcoming = matches
    .filter((m) => m.home_score === null && !/to be announced/i.test(m.home + m.away))
    .map((m) => ({ id: m.id, home: m.home, away: m.away, date: m.date, flagHome: flag(m.home), flagAway: flag(m.away) }))

  return (
    <div className="fade-up max-w-2xl mx-auto">
      <h1 className="display text-2xl font-black mb-1" style={{ color: 'var(--accent)' }}>Miðavaktin</h1>
      <p className="text-sm muted mb-6">
        Settu leggina af miðanum þínum inn og fáðu hlekk sem tikkar sjálfkrafa í hólfin þegar leikirnir rúlla. Ekkert innskráningarvesen — hlekkurinn er miðinn.
      </p>
      {upcoming.length ? (
        <SlipBuilder matches={upcoming} />
      ) : (
        <p className="muted text-sm">Engir óspilaðir HM-leikir í boði núna.</p>
      )}
      <p className="text-[11px] muted mt-6">18 ára aldurstakmark — spilaðu ábyrgt. Miðavaktin er vöktunartól, ekki veðmálaþjónusta.</p>
    </div>
  )
}
