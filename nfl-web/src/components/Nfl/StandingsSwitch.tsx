import Link from 'next/link'

/** Staðan | Styrkleiki under the "Staðan" tab: the pick'em took the strength list's place in the menu. */
export function StandingsSwitch({ active }: { active: 'stada' | 'styrkleiki' }) {
  const tabs = [['stada', '/stada', 'Staðan'], ['styrkleiki', '/styrkleiki', 'Styrkleiki']] as const
  return (
    <nav aria-label="Staðan" className="inline-flex w-fit rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
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
