import { uefaClubs, uefaMatches, uefaSim } from '@/lib/queries'
import { CompetitionPage } from '@/components/Uefa/CompetitionPage'
import { getUefaCompetition } from '@/lib/uefaCompetitions'

export const revalidate = 300

export const metadata = { title: 'Evrópukeppnirnar — Besta spáin' }

export default async function UefaPage({
  searchParams,
}: { searchParams: Promise<{ deild?: string }> }) {
  const { deild } = await searchParams
  let clubs: Awaited<ReturnType<typeof uefaClubs>> = []
  let matches: Awaited<ReturnType<typeof uefaMatches>> = []
  let sim: Awaited<ReturnType<typeof uefaSim>> = []
  try {
    ;[clubs, matches, sim] = await Promise.all([uefaClubs(), uefaMatches(), uefaSim()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!clubs.length) return <p className="muted">Evrópugögn hlaðast inn fljótlega.</p>

  const comp = getUefaCompetition(deild)
  const byClub = new Map(clubs.filter((c) => c.comp === comp.key).map((c) => [c.club, c]))
  const rows = sim.filter((s) => s.comp === comp.key)
  const fixtures = matches.filter((m) => m.comp === comp.key)
  const upcoming = fixtures.filter((m) => m.home_goals === null)
  const played = fixtures.filter((m) => m.home_goals !== null)

  // the strength of each association's league, taken from its clubs
  const leagues = new Map<string, { name: string; strength: number }>()
  for (const c of clubs) {
    if (c.league_name && c.league_strength !== null && !leagues.has(c.league_name)) {
      leagues.set(c.league_name, { name: c.league_name, strength: c.league_strength })
    }
  }
  const ladder = [...leagues.values()].sort((a, b) => b.strength - a.strength).slice(0, 12)

  return <CompetitionPage competition={comp} clubs={[...byClub.values()]} rows={rows} ladder={ladder} upcoming={upcoming} played={played} />
}
