import { betSlip } from '@/lib/queries'
import { evaluateLegsLive } from '@/lib/vaktinLive'
import type { SlipLeg } from '@/lib/vaktin'
import { SlipView } from '@/components/SlipView'

export const dynamic = 'force-dynamic'

export default async function SlipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let slip: Awaited<ReturnType<typeof betSlip>> = null
  try {
    slip = await betSlip(slug)
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!slip) return <p className="muted">Þessi seðill fannst ekki.</p>
  const result = await evaluateLegsLive(slip.legs as SlipLeg[])
  return (
    <div className="max-w-2xl mx-auto">
      <SlipView slug={slug} initial={{ title: slip.title, ...result }} />
    </div>
  )
}
