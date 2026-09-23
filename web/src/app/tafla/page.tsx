import { TaflaView, type SimRow } from '@/components/TaflaView'
import { dashboardData, allTeamInfo } from '@/lib/dashboard'
import { seasonSim, scorerSim, leagueRegistry } from '@/lib/queries'
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
        scorers: ((await scorerSim('goals', l.key as League)) as { name: string; current: number; p_win: number }[])
          .slice(0, 8).map((r) => ({ name: r.name, current: r.current, pWin: r.p_win })),
      })),
    ])
    const bundles = Object.fromEntries(loaded.map((x) => [x.key, x.bundle]))
    const sims = Object.fromEntries(loaded.map((x) => [x.key, x.sim]))
    const scorers = Object.fromEntries(loaded.map((x) => [x.key, x.scorers]))
    return <TaflaView bundles={bundles} sims={sims} scorers={scorers} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
