import Link from 'next/link'
import { ChevronRight, Wand2 } from 'lucide-react'

/** The way into Umspilsvélin from the standings and the playoff pages. */
export function MachineCard() {
  return (
    <Link href="/umspilsvelin" className="card card-hover p-4 flex items-center gap-3">
      <Wand2 size={22} aria-hidden style={{ color: 'var(--accent)' }} className="shrink-0" />
      <span className="min-w-0">
        <span className="block font-semibold">Umspilsvélin: hvað ef?</span>
        <span className="block text-xs muted">Veldu sigurvegara í leikjunum sem eftir eru og sjáðu umspilssætin breytast.</span>
      </span>
      <ChevronRight size={18} aria-hidden className="ml-auto shrink-0 muted" />
    </Link>
  )
}
