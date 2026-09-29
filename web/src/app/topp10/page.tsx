import type { Metadata } from 'next'
import { Topp10Game } from '@/components/Topp10/Topp10Game'

export const metadata: Metadata = {
  title: 'Tenaball | Besta spáin',
  description: 'Ný fótboltaþraut á hverjum degi: tíu rétt svör, þrjár tilraunir. Íslenski boltinn, enska úrvalsdeildin og Evrópa.',
}

export default function Topp10Page() {
  return <Topp10Game />
}
