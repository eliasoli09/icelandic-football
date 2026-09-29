import type { Metadata } from 'next'
import { Hausabolti } from '@/components/Hausabolti/Hausabolti'

export const metadata: Metadata = {
  title: 'Hausabolti | Besta spáin',
  description: 'Stórir hausar, eitt lyklaborð. Tveir á móti hvor öðrum eða einn á móti tölvunni, fyrstur í fimm mörk eða 90 sekúndur.',
}

export default function HausaboltiPage() {
  return <Hausabolti />
}
