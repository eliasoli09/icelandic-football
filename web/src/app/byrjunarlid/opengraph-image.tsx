import { ImageResponse } from 'next/og'
import { GameCard, OG_SIZE, SQ, ogFonts } from '@/lib/og'

export const alt = 'Byrjunarliðið'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <GameCard
      title="Byrjunarliðið"
      tagline="Frægir leikir úr sögunni. Finndu alla ellefu."
      squares={[SQ.green, SQ.green, SQ.yellow, SQ.green, SQ.black, SQ.green, SQ.yellow, SQ.green, SQ.green, SQ.black, SQ.green]}
    />,
    { ...OG_SIZE, fonts: ogFonts() },
  )
}
