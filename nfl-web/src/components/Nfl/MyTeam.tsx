'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { browserDb, whoAmI, type Me } from '@/lib/leaderboard/store'
import { probLabel } from '@/lib/nfl/format'
import type { TeamCard } from '@/lib/nfl/myteam'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import type { NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'

const KEY = 'nfl:lid'
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (v: string | null) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY) } catch { /* this device forgets */ } }

/**
 * "Liðið mitt": the reader's club first on the front page. Kept on the device;
 * a signed-in reader's choice is also saved to the account, where it counts on /adaendur.
 */
export function MyTeam({ cards, teams }: { cards: TeamCard[]; teams: NflTeam[] }) {
  const [team, setTeam] = useState<string | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const byAbbr = new Map(teams.map((t) => [t.abbr, t]))

  useEffect(() => {
    void (async () => {
      const local = read()
      const who = await whoAmI().catch(() => null)
      setMe(who)
      if (who?.name) {
        const { data } = await browserDb().from('nfl_fan').select('team').eq('user_id', who.id).maybeSingle()
        if (data?.team) { setTeam(data.team); write(data.team) }
        else if (local) { setTeam(local); await browserDb().from('nfl_fan').upsert({ user_id: who.id, team: local, updated_at: new Date().toISOString() }) }
      } else setTeam(local)
      setReady(true)
    })()
  }, [])

  const choose = async (abbr: string | null) => {
    setTeam(abbr); write(abbr)
    if (me?.name) {
      if (abbr) await browserDb().from('nfl_fan').upsert({ user_id: me.id, team: abbr, updated_at: new Date().toISOString() })
      else await browserDb().from('nfl_fan').delete().eq('user_id', me.id)
    }
  }

  if (!ready) return null
  const c = cards.find((x) => x.abbr === team)
  const picker = (
    <select aria-label="Veldu liðið þitt" value={team ?? ''} onChange={(e) => void choose(e.target.value || null)}
      className="rounded-lg border px-3 min-h-[36px] text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
      <option value="">{team ? 'Ekkert lið' : 'Veldu liðið þitt'}</option>
      {cards.map((x) => <option key={x.abbr} value={x.abbr}>{x.name}</option>)}
    </select>
  )

  if (!c) return (
    <section className="card p-4 flex flex-wrap items-center gap-3">
      <Heart size={20} aria-hidden style={{ color: 'var(--accent)' }} />
      <span className="font-semibold">Með hverjum heldur þú?</span>
      <span className="text-sm muted">Veldu lið og forsíðan sýnir það fyrst.</span>
      <span className="ml-auto">{picker}</span>
    </section>
  )

  const t = byAbbr.get(c.abbr)
  return (
    <section className="card p-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <NflLogo team={t} size={36} />
        <span className="min-w-0">
          <span className="block text-[11px] font-bold tracking-widest" style={{ color: 'var(--accent)' }}>LIÐIÐ MITT</span>
          <span className="block font-bold text-lg leading-tight">{c.name} <span className="muted font-normal text-sm num">{c.record}</span></span>
        </span>
        <span className="ml-auto">{picker}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        {c.next && (
          <Link href={`/leikur/${c.next.game_id}`} className="rounded-xl border p-3 trow" style={{ borderColor: 'var(--border)' }}>
            <span className="block text-[11px] muted">Næsti leikur · {dayLabel(c.next.kickoff)} {isSmallHours(c.next.kickoff) ? 'aðfaranótt ' : 'kl. '}{clock(c.next.kickoff)}</span>
            <span className="flex items-center gap-2 font-semibold">{c.next.home ? 'gegn' : 'á útivelli gegn'} <NflLogo team={byAbbr.get(c.next.opp)} size={20} /> {byAbbr.get(c.next.opp)?.name ?? c.next.opp}</span>
            {c.next.p !== null && <span className="block text-xs muted">Líkanið gefur {c.abbr} {probLabel(c.next.p)}</span>}
          </Link>
        )}
        {c.last && (
          <Link href={`/leikur/${c.last.game_id}`} className="rounded-xl border p-3 trow" style={{ borderColor: 'var(--border)' }}>
            <span className="block text-[11px] muted">Síðasti leikur</span>
            <span className="flex items-center gap-2 font-semibold">
              <span style={{ color: c.last.us > c.last.them ? 'var(--win)' : c.last.us < c.last.them ? 'var(--loss)' : 'var(--text-2)' }}>{c.last.us > c.last.them ? 'Sigur' : c.last.us < c.last.them ? 'Tap' : 'Jafntefli'}</span>
              <span className="num">{c.last.us}-{c.last.them}</span> gegn <NflLogo team={byAbbr.get(c.last.opp)} size={20} /> {c.last.opp}
            </span>
          </Link>
        )}
      </div>
      {c.news && <a href={c.news.url} target="_blank" rel="noopener noreferrer" className="text-sm underline decoration-dotted underline-offset-2">{c.news.title_is}</a>}
      <p className="text-[11px] muted">
        {me?.name ? 'Valið vistast á aðganginn þinn og telst með á ' : 'Skráðu þig inn til að teljast með á '}
        <Link href="/adaendur" className="underline">aðdáendatöflunni</Link>.
      </p>
    </section>
  )
}
