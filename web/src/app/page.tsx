import { Dashboard } from '@/components/Dashboard'
import { dashboardData, allTeamInfo } from '@/lib/dashboard'
import { leagueRegistry } from '@/lib/queries'
import type { League } from '@/lib/types'
import { Suspense } from 'react'
import { HomeEntrance } from '@/components/Entrance/HomeEntrance'

export const revalidate = 300

export default function Home() {
  return (
    <HomeEntrance>
      <Suspense fallback={<div className="card p-8 muted" role="status">Hleð stöðu og næstu leikjum…</div>}>
        <HomeContent />
      </Suspense>
    </HomeEntrance>
  )
}

async function HomeContent() {
  try {
    // every registered competition, each on its own season — a league in the
    // switcher that answers "not loaded yet" is worse than not offering it
    const registry = await leagueRegistry()
    const [teams, ...loaded] = await Promise.all([
      allTeamInfo(),
      ...registry.map(async (l) => ({
        key: l.key as League,
        bundle: await dashboardData(l.key as League, l.current_season ?? undefined),
      })),
    ])
    const bundles = Object.fromEntries(loaded.map((x) => [x.key, x.bundle]))
    return <Dashboard bundles={bundles} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn — keyrðu fyrst innhleðslu.</p>
  }
}
