import { SludurView } from '@/components/Nfl/SludurView'
import { nflRumours, nflTeams, nflTrades } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = {
  title: 'Slúður og skipti',
  description: 'Orðrómar um skipti í NFL, staðfest skipti og niðurtalning að skiptafrestinum 10. nóvember, á íslensku.',
}

export default async function RumourPage() {
  try {
    const [rumours, trades, teams] = await Promise.all([nflRumours(), nflTrades(), nflTeams()])
    return <SludurView rumours={rumours} trades={trades} teams={teams.filter((t) => t.franchise === t.abbr)} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
