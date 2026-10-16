import { FrettirView } from '@/components/Nfl/FrettirView'
import { nflNews, nflTeams } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = { title: 'NFL-fréttir' }

export default async function NflNewsPage() {
  try {
    const [items, teams] = await Promise.all([nflNews({ limit: 200, sinceDays: 30 }), nflTeams()])
    return <FrettirView items={items} teams={teams.filter((t) => t.franchise === t.abbr)} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
