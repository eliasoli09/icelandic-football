import type { Metadata } from 'next'
import { LeaderboardView } from '@/components/Leaderboard/LeaderboardView'

export const metadata: Metadata = {
  title: 'Stigatafla | Besta spáin',
  description: 'Sigrar og sigurhlutfall í þrautum Besta spáin: Tenaball, Hver er maðurinn?, Byrjunarliðið og Bikarmeistari.',
}

export default function StigataflaPage() {
  return <LeaderboardView />
}
