import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Vallarleit'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Vallarleit"
      tagline="Finndu heimavöll dagsins á hnettinum. Liturinn segir hve heitt þú ert."
      squares={[SQ.white, SQ.yellow, SQ.orange, SQ.red, SQ.red, SQ.green]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
