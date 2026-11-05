import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Tenaball'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Tenaball"
      tagline="Tíu rétt svör, þrjár tilraunir."
      squares={[SQ.green, SQ.green, SQ.green, SQ.green, SQ.green, SQ.green, SQ.green, SQ.black, SQ.black, SQ.black]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
