import Link from 'next/link'

/** Leikirnir | Í sjónvarpinu under the "Leikir" tab. */
export function GamesSwitch({ active }: { active: 'leikir' | 'sjonvarp' }) {
  const tabs = [['leikir', '/leikir', 'Leikirnir'], ['sjonvarp', '/leikir/sjonvarp', 'Í sjónvarpinu']] as const
  return (
    <nav aria-label="Leikir" className="inline-flex w-fit rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {tabs.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}
          className="rounded-full px-4 min-h-[36px] inline-flex items-center font-semibold whitespace-nowrap"
          style={{ background: active === key ? 'var(--accent)' : 'transparent', color: active === key ? 'var(--accent-ink)' : 'var(--text-2)' }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
