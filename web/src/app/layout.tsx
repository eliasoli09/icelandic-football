import type { Metadata } from 'next'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Database } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { LeagueProvider } from '@/components/LeagueContext'
import { lastIngest } from '@/lib/queries'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800', '900'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://islensk-fotbolti.vercel.app'),
  title: 'Besta spáin — íslensk knattspyrnugreining',
  description:
    'Elo-stig, leikjaspár og líkindahermun fyrir Bestu deild karla. Uppfærist sjálfkrafa eftir hvern leik.',
}

export const revalidate = 300

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let updatedAt: string | null = null
  try {
    updatedAt = (await lastIngest())?.run_at ?? null
  } catch {
    // db unreachable — nav renders without the timestamp
  }
  return (
    <html lang="is" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <LeagueProvider>
            <Nav updatedAt={updatedAt} />
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
            <footer className="border-t mt-16" style={{ borderColor: 'var(--border)' }}>
              <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs muted inline-flex items-center gap-1.5">
                  <Database size={12} aria-hidden />
                  Gögn: KSÍ (ksi.is) + tölfræðiinnslög
                </p>
                <p className="text-xs muted">Greiningar byggðar á gögnum og líkanaspám — engin ábyrgð tekin á úrslitum.</p>
                {updatedAt && (
                  <span className="text-[11px] num px-3 py-1 rounded-full border inline-flex items-center gap-2"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                    <span className="live-dot" aria-hidden />
                    Síðast uppfært: {new Date(updatedAt).toLocaleString('is-IS', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                  </span>
                )}
              </div>
            </footer>
          </LeagueProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
