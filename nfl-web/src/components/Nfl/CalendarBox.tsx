'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, Download } from 'lucide-react'
import type { NflTeam } from '@/lib/nfl/types'

const LAST = 'nfl:dagatal'

/**
 * Subscribe to a club's games (or all of them) in the phone's calendar: on
 * Icelandic time, with the channel, prices and the model's pick, and kept up to
 * date by the calendar itself.
 */
export function CalendarBox({ teams, team }: { teams: NflTeam[]; team?: string }) {
  const clubs = teams.filter((t) => t.franchise === t.abbr).sort((a, b) => a.name.localeCompare(b.name, 'is'))
  const [pick, setPick] = useState(team ?? 'allt')
  const [host, setHost] = useState('www.snertimark.net')
  useEffect(() => {
    setHost(window.location.host)
    if (team) return
    // ?lid=CHI from "Liðið mitt", else the club picked last time
    const asked = new URLSearchParams(window.location.search).get('lid')?.toUpperCase()
    if (asked && clubs.some((t) => t.abbr === asked)) { setPick(asked); return }
    try { const v = localStorage.getItem(LAST); if (v) setPick(v) } catch { /* the default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, after mount
  }, [team])
  const choose = (v: string) => { setPick(v); try { localStorage.setItem(LAST, v) } catch { /* not remembered */ } }
  const path = `/dagatal/${pick}.ics`
  const webcal = `webcal://${host}${path}`
  const btn = 'rounded-full border px-3 min-h-[38px] text-sm inline-flex items-center gap-1.5'
  return (
    <section className="card p-4 grid gap-3" aria-label="Dagatal">
      <h2 className="display text-lg font-extrabold inline-flex items-center gap-2"><CalendarPlus size={18} aria-hidden /> Leikirnir í dagatalið</h2>
      <p className="text-sm muted">Allir leikir á íslenskum tíma, með rás, stuðlum og spá líkansins. Dagatalið uppfærist sjálft þegar tímar eða rásir breytast.</p>
      <div className="flex flex-wrap gap-2 items-center">
        {!team && (
          <select value={pick} onChange={(e) => choose(e.target.value)} aria-label="Lið" className="rounded-lg border px-2 min-h-[38px] text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-solid, var(--surface))', color: 'var(--text)' }}>
            <option value="allt">Allir leikir</option>
            {clubs.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
          </select>
        )}
        <a href={webcal} className={`${btn} font-semibold`} style={{ background: 'var(--pill)', color: '#fff', borderColor: 'transparent' }}><CalendarPlus size={15} aria-hidden /> iPhone og Mac</a>
        <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" className={btn} style={{ borderColor: 'var(--border)' }}>Google Dagatal</a>
        <a href={path} download className={btn} style={{ borderColor: 'var(--border)' }}><Download size={15} aria-hidden /> .ics</a>
      </div>
    </section>
  )
}
