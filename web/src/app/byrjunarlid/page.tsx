import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'
import { XiGame } from '@/components/Xi/XiGame'

/** The headings are set in a serif, as the design asks; only this page loads it. */
const serif = Playfair_Display({ variable: '--font-xi-serif', subsets: ['latin', 'latin-ext'], weight: ['700'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Byrjunarliðið | Besta spáin',
  description: 'Frægir leikir úr sögunni: giskaðu á úrslitin og finndu alla ellefu í byrjunarliðinu, einn leikmann í einu.',
}

export default function ByrjunarlidPage() {
  return <div className={serif.variable}><XiGame /></div>
}
