import { JoinLeague } from '@/components/Nfl/Pickem/JoinLeague'

export const metadata = { title: 'Boð í deild - Spáleikur NFL', robots: { index: false } }

type Props = { params: Promise<{ kodi: string }> }

export default async function NflLeagueInvitePage({ params }: Props) {
  const { kodi } = await params
  return <JoinLeague code={kodi} />
}
