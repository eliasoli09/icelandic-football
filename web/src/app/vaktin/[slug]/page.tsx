import { betSlip, wcMatches } from '@/lib/queries'
import { evaluateSlip, type SlipLeg } from '@/lib/vaktin'
import { SlipView } from '@/components/SlipView'

export const dynamic = 'force-dynamic'

export default async function SlipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let slip: Awaited<ReturnType<typeof betSlip>> = null
  let matches: Awaited<ReturnType<typeof wcMatches>> = []
  try {
    ;[slip, matches] = await Promise.all([betSlip(slug), wcMatches()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!slip) return <p className="muted">Þessi miði fannst ekki.</p>
  const legs = slip.legs as SlipLeg[]
  const status = evaluateSlip(legs, new Map(matches.map((m) => [m.id, m])))
  return (
    <div className="max-w-2xl mx-auto">
      <SlipView slug={slug} initial={{ title: slip.title, ...status }} />
    </div>
  )
}
