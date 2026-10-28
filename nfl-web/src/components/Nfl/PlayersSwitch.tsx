'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

type Tab = 'tolfraedi' | 'verdlaun' | 'stjornulid' | 'meidsli' | 'markadur'

/**
 * Tölfræði | Verðlaun | Stjörnulið | Meiðsli | Markaðurinn under the "Leikmenn" tab.
 * On a phone the bar scrolls sideways, the last label is shortened and the active tab is scrolled into view.
 */
export function PlayersSwitch({ active }: { active: Tab }) {
  const tabs: [Tab, string, string, string?][] = [['tolfraedi', '/leikmenn', 'Tölfræði'], ['verdlaun', '/verdlaun', 'Verðlaun'], ['stjornulid', '/leikmenn/stjornulid', 'Stjörnulið'], ['meidsli', '/leikmenn/meidsli', 'Meiðsli'], ['markadur', '/leikmenn/markadur', 'Markaðurinn', 'Markaður']]
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = nav.current, on = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
  }, [active])
  return (
    <nav ref={nav} aria-label="Leikmenn" className="inline-flex w-fit max-w-full overflow-x-auto rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {tabs.map(([key, href, label, short]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}
          className="rounded-full px-3 sm:px-4 min-h-[36px] inline-flex items-center font-semibold whitespace-nowrap shrink-0"
          style={{ background: active === key ? 'var(--accent)' : 'transparent', color: active === key ? 'var(--accent-ink)' : 'var(--text-2)' }}>
          {short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></> : label}
        </Link>
      ))}
    </nav>
  )
}
