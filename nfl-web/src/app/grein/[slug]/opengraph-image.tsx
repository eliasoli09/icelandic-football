import { ImageResponse } from 'next/og'
import { ARTICLE_KIND } from '@/components/Nfl/ArticleList'
import { nflArticle } from '@/lib/nfl/articles/queries'
import { C, Card, OG_SIZE, ogFonts } from '@/lib/og'

export const alt = 'Grein um NFL'
export const size = OG_SIZE
export const contentType = 'image/png'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const a = await nflArticle((await params).slug).catch(() => null)
  return new ImageResponse(
    (
      <Card kicker={a ? ARTICLE_KIND[a.kind].toUpperCase() : 'GREIN'}>
        <div style={{ display: 'flex', fontSize: (a?.title.length ?? 0) > 60 ? 64 : 80, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{clip(a?.title ?? 'Grein fannst ekki', 110)}</div>
        {a?.lede && <div style={{ display: 'flex', fontSize: 32, color: C.muted, marginTop: 24, maxWidth: 1040 }}>{clip(a.lede, 170)}</div>}
      </Card>
    ),
    { ...size, fonts: ogFonts() },
  )
}
