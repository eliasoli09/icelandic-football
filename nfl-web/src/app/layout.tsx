import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { SiteShell } from '@/components/Nfl/SiteShell'
import { FOOTBALL_URL, SITE_NAME, SITE_URL } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800', '900'] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} - spár, staðan og greinar`, template: `%s - ${SITE_NAME}` },
  description: 'Leikir vikunnar, spár, staðan, spáleikur og greinar um NFL, á íslensku og íslenskum tíma.',
}

export const viewport = { themeColor: '#020c1d' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased min-h-screen`}>
        <header className="relative z-10 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="display font-extrabold tracking-tight">{SITE_NAME}</Link>
            <a href={FOOTBALL_URL} className="text-xs muted underline decoration-dotted underline-offset-2">Íslenskur fótbolti</a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <SiteShell>{children}</SiteShell>
        </main>
      </body>
    </html>
  )
}
