import { ImageResponse } from 'next/og'
import { C, Card, OG_SIZE, ogFonts } from '@/lib/og'

export const alt = 'Spáleikur: veldu sigurvegara í hverjum NFL-leik og kepptu við vinina og líkanið'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <Card kicker="SPÁLEIKUR">
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Getur þú gert betur en líkanið?</div>
        <div style={{ display: 'flex', fontSize: 36, color: C.muted, marginTop: 24, maxWidth: 1000 }}>
          Veldu sigurvegara í hverjum leik vikunnar, stofnaðu deild með vinunum og klifraðu upp töfluna.
        </div>
      </Card>
    ),
    { ...size, fonts: ogFonts() },
  )
}
