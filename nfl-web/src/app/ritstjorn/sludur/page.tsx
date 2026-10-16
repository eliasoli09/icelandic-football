import { DeskRumours } from '@/components/Ritstjorn/DeskRumours'
import { nflTeams } from '@/lib/nfl/queries'

export const metadata = { title: 'Ritstjórn: slúður', robots: { index: false } }

export default async function RitstjornRumoursPage() {
  const teams = (await nflTeams().catch(() => [])).filter((t) => t.franchise === t.abbr).sort((a, b) => a.name.localeCompare(b.name, 'is'))
  return <DeskRumours teams={teams.map((t) => ({ abbr: t.abbr, name: t.name }))} />
}
