import { TaflaView, type SimRow } from '@/components/TaflaView'
import { dashboardData, allTeamInfo } from '@/lib/dashboard'
import { seasonSim } from '@/lib/queries'

export const revalidate = 300

export const metadata = {
  openGraph: { images: ['/api/og/tafla'] },
  twitter: { card: 'summary_large_image', images: ['/api/og/tafla'] },
}

export default async function TaflaPage() {
  try {
    const [besta, lengjudeild, simBesta, simLengju, teams] = await Promise.all([
      dashboardData('besta'),
      dashboardData('lengjudeild'),
      seasonSim('besta'),
      seasonSim('lengjudeild'),
      allTeamInfo(),
    ])
    return (
      <TaflaView
        bundles={{ besta, lengjudeild }}
        sims={{ besta: simBesta as SimRow[], lengjudeild: simLengju as SimRow[] }}
        teams={teams}
      />
    )
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
