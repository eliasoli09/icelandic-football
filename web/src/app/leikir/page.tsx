import { LeikirView } from '@/components/LeikirView'
import { seasonMatches } from '@/lib/queries'
import { allTeamInfo } from '@/lib/dashboard'

export const revalidate = 300

export default async function LeikirPage() {
  try {
    const [matches, teams] = await Promise.all([seasonMatches(), allTeamInfo()])
    return <LeikirView matches={matches} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
