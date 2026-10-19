import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SiteShell } from '@/components/Nfl/SiteShell'
import { NflSubnav } from '@/components/Nfl/NflSubnav'
import { MobileDock } from '@/components/Nfl/MobileDock'
import { JumbotronServer } from '@/components/Nfl/JumbotronServer'
import { FOOTBALL_URL, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800', '900'] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} - ${SITE_TAGLINE}: spár, staðan og greinar`, template: `%s - ${SITE_NAME}` },
  description: 'Leikir vikunnar, spár, staðan, spáleikur og greinar um NFL, á íslensku og íslenskum tíma.',
  openGraph: { siteName: SITE_NAME, locale: 'is_IS', type: 'website' },
  twitter: { card: 'summary_large_image' },
}

export const viewport = { themeColor: '#0a1430', viewportFit: 'cover' as const }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" className="dark">
      <body data-league="nfl" className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased min-h-screen`}>
        <header className="relative z-10 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="max-w-6xl mx-auto px-4 h-12 md:h-14 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label={`${SITE_NAME}, forsíða`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo, no optimisation needed */}
              <img src="/snertimark-logo-96.png" alt="" width={34} height={34} className="w-8 h-8 md:w-[34px] md:h-[34px]" />
              <span className="display font-extrabold tracking-tight text-lg">Snertimark<span style={{ color: 'var(--live)' }}>.net</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-xs">
              <Link href="/um" className="muted">Um síðuna</Link>
              <a href={FOOTBALL_URL} className="muted underline decoration-dotted underline-offset-2">Íslenskur fótbolti</a>
            </nav>
          </div>
        </header>
        <div className="border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-[1376px] mx-auto px-4 py-2.5"><JumbotronServer /></div>
        </div>
        <div className="hidden md:block sticky top-0 z-20 border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, #0a1430 92%, transparent)' }}>
          <div className="max-w-6xl mx-auto px-4"><NflSubnav /></div>
        </div>
        <main className="max-w-6xl mx-auto px-4 py-5 md:py-8">
          <SiteShell>{children}</SiteShell>
        </main>
        <MobileDock />
        <Analytics />
      </body>
    </html>
  )
}
