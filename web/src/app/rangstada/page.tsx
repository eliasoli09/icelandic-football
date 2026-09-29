import type { Metadata } from 'next'
import { OffsideTool } from '@/components/offside/OffsideTool'

export const metadata: Metadata = {
  title: 'Rangstöðugreining — Besta spáin',
  description: 'Sjálfvirk rangstöðugreining úr myndbandi: gervigreind finnur sparkið og leikmennina, kerfið reiknar völlinn í metrum.',
}

export default function RangstadaPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Rangstöðugreining <span className="text-xs font-semibold align-middle px-2 py-0.5 rounded-full ml-1" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>Prufuútgáfa</span></h1>
        <p className="text-sm muted mt-1 max-w-2xl">
          Hladdu inn myndbroti úr leik. Gervigreindin finnur hvenær boltanum er spyrnt og hvar leikmenn standa; út frá stöðluðum
          vallarmerkingum reiknar kerfið völlinn í metrum og dregur rangstöðulínuna.
        </p>
      </div>
      <OffsideTool />
    </div>
  )
}
