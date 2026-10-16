import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

/** "NFL" on navy with the site's red, in place of the football site's icon. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020c1d', borderRadius: 14, border: '4px solid #ff173e', color: '#f4f7ff', fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>
        NFL
      </div>
    ),
    size,
  )
}
