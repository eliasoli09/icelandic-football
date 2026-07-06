import type { Metadata } from 'next'
import { Geist, Geist_Mono, Archivo } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Nav } from '@/components/Nav'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Nav />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
          <footer
            className="border-t mt-16"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs muted">
                Gögn: KSÍ (ksi.is) + SofaScore-innslög · Spár eru tölfræðilegar — engin ábyrgð tekin á úrslitum.
              </p>
              <p className="text-xs muted display font-bold">⚽ Besta spáin</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
