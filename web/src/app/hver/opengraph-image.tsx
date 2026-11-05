import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Hver er maðurinn?'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Hver er maðurinn?"
      tagline="Ferill leikmanns, félag fyrir félag. Hver er hann?"
      squares={[SQ.red, SQ.red, SQ.red, SQ.green]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
