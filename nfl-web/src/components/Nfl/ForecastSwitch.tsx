import Link from 'next/link'

/** Spáð lokastaða | Styrkleiki under the "Spár" tab. */
export function ForecastSwitch({ active }: { active: 'spar' | 'styrkleiki' }) {
  const tabs = [['spar', '/spar', 'Spáð lokastaða'], ['styrkleiki', '/styrkleiki', 'Styrkleiki']] as const
  return (
    <nav aria-label="Spár" className="inline-flex w-fit rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
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
