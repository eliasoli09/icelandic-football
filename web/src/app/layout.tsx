import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Besta spáin — íslensk knattspyrnugreining',
  description:
    'Elo-stig, leikjaspár og líkindahermun fyrir Bestu deild karla. Uppfærist sjálfkrafa eftir hvern leik.',
}

const NAV = [
  { href: '/', label: 'Yfirlit' },
  { href: '/elo', label: 'Elo' },
  { href: '/tafla', label: 'Tafla' },
  { href: '/leikir', label: 'Leikir' },
  { href: '/leikmenn', label: 'Leikmenn' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="is" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <header
            className="sticky top-0 z-10 border-b backdrop-blur"
            style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
          >
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
              <Link href="/" className="font-bold tracking-tight text-lg whitespace-nowrap">
                ⚽ Besta spáin
              </Link>
              <nav className="flex gap-1 text-sm font-medium overflow-x-auto">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-lg opacity-80 hover:opacity-100">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <ThemeToggle />
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
          <footer className="max-w-5xl mx-auto px-4 py-10 text-xs muted">
            Gögn: KSÍ (ksi.is) + SofaScore-innslög. Spár eru tölfræðilegar — engin ábyrgð tekin á úrslitum.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
