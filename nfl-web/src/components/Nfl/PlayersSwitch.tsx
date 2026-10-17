import Link from 'next/link'

/** Tölfræði | Verðlaun | Stjörnulið | Meiðsli under the "Leikmenn" tab. */
export function PlayersSwitch({ active }: { active: 'tolfraedi' | 'verdlaun' | 'stjornulid' | 'meidsli' }) {
  const tabs = [['tolfraedi', '/leikmenn', 'Tölfræði'], ['verdlaun', '/verdlaun', 'Verðlaun'], ['stjornulid', '/leikmenn/stjornulid', 'Stjörnulið'], ['meidsli', '/leikmenn/meidsli', 'Meiðsli']] as const
  return (
    <nav aria-label="Leikmenn" className="inline-flex w-fit max-w-full overflow-x-auto rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {tabs.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}
          className="rounded-full px-3 sm:px-4 min-h-[36px] inline-flex items-center font-semibold whitespace-nowrap"
          style={{ background: active === key ? 'var(--accent)' : 'transparent', color: active === key ? 'var(--accent-ink)' : 'var(--text-2)' }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
