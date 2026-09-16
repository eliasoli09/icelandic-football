import type { Metadata } from 'next'
import { XiGame } from '@/components/Xi/XiGame'

export const metadata: Metadata = {
  title: 'Byrjunarliðið | Besta spáin',
  description: 'Frægir leikir úr sögunni: giskaðu á úrslitin og finndu alla ellefu í byrjunarliðinu, einn leikmann í einu.',
}

export default function ByrjunarlidPage() {
  return <XiGame />
}
