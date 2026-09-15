import type { Metadata } from 'next'
import { Topp10Game } from '@/components/Topp10/Topp10Game'

export const metadata: Metadata = {
  title: 'Topp 10 | Besta spáin',
  description: 'Nefndu alla tíu á listanum: markakónga, lokastöður og Evrópumeistara. Nýr listi á hverjum degi.',
}

export default function Topp10Page() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="display text-2xl font-black mb-1">Topp 10</h1>
      <p className="text-sm muted mb-5">
        Nefndu öll svörin á listanum. Þú hefur þrjú líf, röng ágiskun kostar eitt og vísbending kostar eitt.
        Nýr listi á hverjum degi fyrir Ísland, ensku deildina og Evrópu.
      </p>
      <Topp10Game />
    </div>
  )
}
