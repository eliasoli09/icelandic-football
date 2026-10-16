import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SiteShell } from '@/components/Nfl/SiteShell'
import { NflSubnav } from '@/components/Nfl/NflSubnav'
import { FOOTBALL_URL, SITE_NAME, SITE_URL } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800', '900'] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} - spár, staðan og greinar`, template: `%s - ${SITE_NAME}` },
  description: 'Leikir vikunnar, spár, staðan, spáleikur og greinar um NFL, á íslensku og íslenskum tíma.',
  openGraph: { siteName: SITE_NAME, locale: 'is_IS', type: 'website' },
  twitter: { card: 'summary_large_image' },
}

export const viewport = { themeColor: '#020c1d' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" className="dark">
      <body data-league="nfl" className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased min-h-screen`}>
        <header className="relative z-10 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="display font-extrabold tracking-tight">{SITE_NAME}</Link>
            <nav className="flex items-center gap-4 text-xs">
              <Link href="/um" className="muted">Um síðuna</Link>
              <a href={FOOTBALL_URL} className="muted underline decoration-dotted underline-offset-2">Íslenskur fótbolti</a>
            </nav>
          </div>
        </header>
        <div className="sticky top-0 z-20 border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
          <div className="max-w-6xl mx-auto px-4"><NflSubnav /></div>
        </div>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <SiteShell>{children}</SiteShell>
        </main>
        <Analytics />
      </body>
    </html>
  )
}
