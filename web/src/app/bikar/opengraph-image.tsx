import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Reyndu að verða bikarmeistari'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Reyndu að verða bikarmeistari"
      tagline="Draftaðu ellefu menn úr bestu liðum sögunnar og vinndu bikarinn."
      squares={[SQ.green, SQ.green, SQ.green, SQ.red]}
      footer="Ókeypis, beint í vafranum"
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
