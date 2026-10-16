import { Database } from 'lucide-react'
import styles from '@/components/Nfl/NflStadium.module.css'

/** The stadium backdrop, the NFL header and the data note around every page. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-league="nfl" className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />
      {children}
      <p className={styles.source}>
        <Database size={11} aria-hidden /> Gögn: nflverse (nfldata). Tímar eru íslenskir.
      </p>
    </div>
  )
}
