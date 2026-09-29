import { SludurView } from '@/components/SludurView'
import { transferNews } from '@/lib/queries'
import { allTeamInfo } from '@/lib/dashboard'

export const revalidate = 300

export const metadata = {
  title: 'Slúður & félagaskipti',
  description: 'Staðfest félagaskipti og heitustu orðrómarnir úr íslenska boltanum.',
}

export default async function SludurPage() {
  try {
    const [items, teams] = await Promise.all([transferNews(), allTeamInfo()])
    return <SludurView items={items} teams={teams} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
