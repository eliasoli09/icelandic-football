import { Dashboard } from '@/components/Dashboard'
import { dashboardData, allTeamInfo } from '@/lib/dashboard'

export const revalidate = 300

export default async function Home() {
  try {
    const [besta, lengjudeild, teams] = await Promise.all([
      dashboardData('besta'),
      dashboardData('lengjudeild'),
      allTeamInfo(),
    ])
    return <Dashboard bundles={{ besta, lengjudeild }} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn — keyrðu fyrst innhleðslu.</p>
  }
}
