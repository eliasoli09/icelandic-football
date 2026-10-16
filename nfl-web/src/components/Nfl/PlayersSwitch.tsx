import Link from 'next/link'

/** Tölfræði | Verðlaun under the "Leikmenn" tab: a sixth tab does not fit a phone. */
export function PlayersSwitch({ active }: { active: 'tolfraedi' | 'verdlaun' }) {
  const tabs = [['tolfraedi', '/leikmenn', 'Tölfræði'], ['verdlaun', '/verdlaun', 'Verðlaun']] as const
  return (
    <nav aria-label="Leikmenn" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {tabs.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}
          className="rounded-full px-4 min-h-[36px] inline-flex items-center font-semibold"
          style={{ background: active === key ? 'var(--accent)' : 'transparent', color: active === key ? 'var(--accent-ink)' : 'var(--text-2)' }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
