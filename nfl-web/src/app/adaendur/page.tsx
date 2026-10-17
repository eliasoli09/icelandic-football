import Link from 'next/link'
import { Heart } from 'lucide-react'
import { db } from '@/lib/db'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { nflTeams } from '@/lib/nfl/queries'

export const revalidate = 600
export const metadata = { title: 'Aðdáendur á Íslandi', description: 'Hvaða NFL-lið eiga flesta stuðningsmenn á Íslandi? Talið út frá liðunum sem notendur síðunnar velja.' }

export default async function FansPage() {
  const [{ data }, teams] = await Promise.all([db().rpc('rpc_nfl_fan_counts'), nflTeams().catch(() => [])])
  const rows = (data ?? []) as { team: string; fans: number }[]
  const byAbbr = new Map(teams.map((t) => [t.abbr, t]))
  const total = rows.reduce((s, r) => s + r.fans, 0)
  const top = rows[0]?.fans ?? 1
  return (
    <div className="grid gap-6 max-w-2xl">
      <header className="grid gap-1">
        <p className="text-[11px] font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><Heart size={12} aria-hidden /> AÐDÁENDUR</p>
        <h2 className="display text-3xl font-extrabold tracking-tight">Með hverjum halda Íslendingar?</h2>
        <p className="muted text-sm">Talið út frá liðunum sem notendur síðunnar velja sér. Hver aðgangur telst einu sinni. Veldu þitt lið á <Link href="/" className="underline">forsíðunni</Link>.</p>
      </header>
      {!rows.length ? <p className="muted">Enginn hefur valið lið enn. Vertu fyrst(ur).</p> : (
        <ol className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r, i) => (
            <li key={r.team} className="grid grid-cols-[1.5rem_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
              <span className="muted num text-sm">{i + 1}</span>
              <NflLogo team={byAbbr.get(r.team)} size={26} />
              <span className="min-w-0 grid gap-1">
                <span className="font-semibold truncate">{byAbbr.get(r.team)?.name ?? r.team}</span>
                <span className="block h-2 rounded-full" style={{ width: `${Math.max(4, (r.fans / top) * 100)}%`, background: byAbbr.get(r.team)?.color ?? 'var(--accent)' }} />
              </span>
              <span className="num font-semibold">{r.fans} <span className="muted font-normal text-xs">({Math.round((r.fans / total) * 100)}%)</span></span>
            </li>
          ))}
        </ol>
      )}
      {total > 0 && <p className="text-xs muted">{total} {total === 1 ? 'aðdáandi' : 'aðdáendur'} alls.</p>}
    </div>
  )
}
