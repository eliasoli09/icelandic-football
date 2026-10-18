'use client'

import { useEffect, useState } from 'react'
import type { ScoreKind } from '@/lib/nfl/celebrations'
import { Celebration } from './Celebration'
import { T } from './themes'

interface Club { abbr: string; name: string; logo: string }

/** All 32 banners: pick a club and a score, or let them run one after another. */
export function Gallery({ teams }: { teams: Club[] }) {
  const [kind, setKind] = useState<ScoreKind>('TD')
  const [now, setNow] = useState<{ abbr: string; n: number } | null>(null)
  const [all, setAll] = useState(false)
  const [sheet, setSheet] = useState(0)
  const play = (abbr: string) => setNow((p) => ({ abbr, n: (p?.n ?? 0) + 1 }))

  useEffect(() => {
    if (!all || !now) return
    const t = setTimeout(() => {
      const i = teams.findIndex((x) => x.abbr === now.abbr)
      if (i + 1 < teams.length) play(teams[i + 1].abbr); else setAll(false)
    }, T.end + 300)
    return () => clearTimeout(t)
  }, [all, now, teams])

  const club = teams.find((t) => t.abbr === now?.abbr)
  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="display text-3xl font-extrabold">Fagnaðir</h1>
        <p className="muted text-sm">Borðinn sem birtist á Stjórnborðinu þegar lið skorar. Veldu lið til að sjá hann.</p>
      </header>
      <div className="flex flex-wrap gap-2 items-center">
        {(['TD', 'FG'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className="rounded-full px-4 min-h-[36px] text-sm font-semibold border" style={kind === k ? { background: 'var(--pill)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--border)' }}>{k === 'TD' ? 'Snertimark' : 'Vallarmark'}</button>
        ))}
        <button onClick={() => { setAll(true); play(teams[0].abbr) }} className="rounded-full px-4 min-h-[36px] text-sm border ml-auto" style={{ borderColor: 'var(--border)' }}>Spila öll í röð</button>
        <button onClick={() => setSheet((n) => n + 1)} className="rounded-full px-4 min-h-[36px] text-sm border" style={{ borderColor: 'var(--border)' }}>Öll í einu</button>
      </div>
      <div className="relative rounded-2xl border grid place-items-center overflow-hidden" style={{ borderColor: 'var(--border)', minHeight: 260, background: 'radial-gradient(ellipse at 50% 30%, rgb(47 107 255 / .16), transparent 70%), var(--surface)' }}>
        {club && now ? <Celebration key={`${now.abbr}${now.n}${kind}`} kind={kind} team={club.abbr} logo={club.logo} score={`${club.abbr} 21-17 ANDST · 3. lh 4:12`} play="Leikmaður 12 jarda grip frá leikstjórnanda" /> : <p className="muted text-sm">Veldu lið hér fyrir neðan.</p>}
      </div>
      {sheet > 0 && (
        <div className="grid gap-6 justify-items-center py-4" style={{ overflowX: "clip" }} data-sheet>
          {teams.map((t) => <Celebration key={`${t.abbr}${sheet}${kind}`} kind={kind} team={t.abbr} logo={t.logo} score={`${t.abbr} 21-17 ANDST · 3. lh 4:12`} />)}
        </div>
      )}
      <ul className="grid gap-2 grid-cols-4 sm:grid-cols-8">
        {teams.map((t) => (
          <li key={t.abbr}>
            <button onClick={() => { setAll(false); play(t.abbr) }} aria-pressed={now?.abbr === t.abbr} title={t.name} className="w-full rounded-xl border p-2 grid justify-items-center gap-1 text-xs font-bold" style={{ borderColor: now?.abbr === t.abbr ? 'var(--accent)' : 'var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static local PNG */}
              <img src={t.logo} alt="" width={32} height={32} style={{ width: 32, height: 32, objectFit: 'contain' }} />
              {t.abbr}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
