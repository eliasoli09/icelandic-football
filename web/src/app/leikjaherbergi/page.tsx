import type { Metadata } from 'next'
import { GameRoom } from '@/components/Room/GameRoom'

export const metadata: Metadata = {
  title: 'Leikjaherbergið | Besta spáin',
  description: 'Allar fótboltaþrautir Besta spáin á einum stað: Tenaball, Hver er maðurinn?, Byrjunarliðið og Bikarmeistari - ný þraut á hverjum degi.',
}

export default function LeikjaherbergiPage() {
  return <GameRoom />
}
