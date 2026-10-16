import { ImageResponse } from 'next/og'
import { C, Card, OG_SIZE, ogFonts } from '@/lib/og'
import { SITE_NAME } from '@/lib/site'

export const alt = `${SITE_NAME}: spár, staðan, spáleikur og greinar um NFL`
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <Card kicker="NFL Á ÍSLENSKU">
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Hver vinnur í NFL?</div>
        <div style={{ display: 'flex', fontSize: 36, color: C.muted, marginTop: 24, maxWidth: 980 }}>
          Líkur fyrir hvern leik, staðan, úrslitakeppnin, spáleikur og greinar, á íslensku og íslenskum tíma.
        </div>
      </Card>
    ),
    { ...size, fonts: ogFonts() },
  )
}
