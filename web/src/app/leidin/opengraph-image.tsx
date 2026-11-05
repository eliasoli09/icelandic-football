import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Leiðin á Laugardalsvöll'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Leiðin á Laugardalsvöll"
      tagline="Sjö spurningar á dag. Sjaldgæf svör hlaupa lengst."
      squares={[SQ.green, SQ.blue, SQ.purple, SQ.white, SQ.yellow, SQ.green, SQ.blue]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
