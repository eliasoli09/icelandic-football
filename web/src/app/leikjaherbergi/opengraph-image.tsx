import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Leikjaherbergið'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Leikjaherbergið"
      tagline="Allar fótboltaþrautirnar á einum stað, ný á hverjum degi."
      squares={[SQ.green, SQ.blue, SQ.purple, SQ.yellow, SQ.orange, SQ.red]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
