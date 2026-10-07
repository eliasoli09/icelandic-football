import type { Metadata } from 'next'
import { LeidinGame } from '@/components/Leidin/LeidinGame'

export const metadata: Metadata = {
  title: 'Leiðin á Laugardalsvöll | Besta spáin',
  description: 'Sjö fótboltaspurningar á dag, 25 sekúndur hver. Sjaldgæf svör hlaupa lengst - frá battavellinum á skólalóðinni alla leið á Laugardalsvöll.',
}

export default function LeidinPage() {
  return <LeidinGame />
}
