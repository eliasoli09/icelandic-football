import { Database } from 'lucide-react'
import { NflPageHeader } from '@/components/Nfl/NflPageHeader'
import styles from '@/components/Nfl/NflStadium.module.css'

export const metadata = {
  title: 'NFL - Besta spáin',
  description: 'Leikir vikunnar, úrslit og staðan í NFL, á íslenskum tíma.',
}

export default function NflLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-league="nfl" className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />
      <NflPageHeader />
      {children}
      <p className={styles.source}>
        <Database size={11} aria-hidden /> Gögn: nflverse (nfldata). Tímar eru íslenskir.
      </p>
    </div>
  )
}
