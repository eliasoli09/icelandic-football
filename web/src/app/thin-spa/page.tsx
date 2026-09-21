import type { Metadata } from 'next'
import { whatIfData } from '@/lib/whatif/data'
import { WhatIfView } from '@/components/WhatIf/WhatIfView'

export const metadata: Metadata = {
  title: 'Þín spá | Besta spáin',
  description: 'Veldu úrslit í leikjunum sem eftir eru í Bestu deildinni og sjáðu hvernig titill, Evrópusæti og fall breytast. Líkanið hermir það sem þú sleppir.',
}

export const revalidate = 300

export default async function ThinSpaPage() {
  const data = await whatIfData('besta')
  return <WhatIfView data={data} />
}
