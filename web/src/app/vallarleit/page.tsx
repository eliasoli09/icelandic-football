import type { Metadata } from 'next'
import { VallarleitGame } from '@/components/Vallarleit/VallarleitGame'

export const metadata: Metadata = {
  title: 'Vallarleit | Besta spáin',
  description: 'Finndu heimavöll dagsins. Giskaðu á lið og fáni rís á vellinum þess - liturinn segir hve heitt þú ert. Létt, miðlungs, erfitt og ómögulegt.',
}

export default function VallarleitPage() {
  return <VallarleitGame />
}
