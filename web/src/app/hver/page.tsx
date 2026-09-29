import type { Metadata } from 'next'
import { HverGame } from '@/components/Hver/HverGame'

export const metadata: Metadata = {
  title: 'Hver er maðurinn? | Besta spáin',
  description: 'Ferill leikmanns, félag fyrir félag. Giskaðu á manninn á bak við ferilinn, ný þraut á hverjum degi.',
}

export default function HverPage() {
  return <HverGame />
}
