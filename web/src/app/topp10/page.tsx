import type { Metadata } from 'next'
import { Topp10Game } from '@/components/Topp10/Topp10Game'

export const metadata: Metadata = {
  title: 'Meistaradeildin Tenaball | Besta spáin',
  description: 'Tíu félög. Þrjár tilraunir. Prófaðu fótboltaþekkinguna í Meistaradeildin Tenaball.',
}

export default function Topp10Page() {
  return <Topp10Game />
}
