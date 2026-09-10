import { TaflaView, type SimRow } from '@/components/TaflaView'
import { dashboardData, allTeamInfo } from '@/lib/dashboard'
import { seasonSim, leagueRegistry } from '@/lib/queries'
import type { League } from '@/lib/types'

export const revalidate = 300

export const metadata = {
  openGraph: { images: ['/api/og/tafla'] },
  twitter: { card: 'summary_large_image', images: ['/api/og/tafla'] },
}

export default async function TaflaPage() {
  try {
    const registry = await leagueRegistry()
    const [teams, ...loaded] = await Promise.all([
      allTeamInfo(),
      ...registry.map(async (l) => ({
        key: l.key as League,
        bundle: await dashboardData(l.key as League, l.current_season ?? undefined),
        sim: (await seasonSim(l.key as League)) as SimRow[],
      })),
    ])
    const bundles = Object.fromEntries(loaded.map((x) => [x.key, x.bundle]))
    const sims = Object.fromEntries(loaded.map((x) => [x.key, x.sim]))
    return <TaflaView bundles={bundles} sims={sims} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
