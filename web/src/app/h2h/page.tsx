import { teams, h2hAll } from '@/lib/queries'
import { ShareButton } from '@/components/ShareButton'

export const revalidate = 3600

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const { a, b } = await searchParams
  let names = new Map<number, string>()
  let pairs: Awaited<ReturnType<typeof h2hAll>> = []
  try {
    ;[names, pairs] = await Promise.all([teams(), h2hAll()])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  const nm = (id: number) => names.get(id) ?? `#${id}`
  const inH2H = new Set<number>()
  for (const p of pairs) { inH2H.add(p.team_a); inH2H.add(p.team_b) }
  const options = [...inH2H].map((id) => ({ id, name: nm(id) })).sort((x, y) => x.name.localeCompare(y.name, 'is'))

  const aId = a ? Number(a) : null
  const bId = b ? Number(b) : null
  const pair = aId && bId
    ? pairs.find((p) =>
        (p.team_a === Math.min(aId, bId) && p.team_b === Math.max(aId, bId)))
    : null
  const stats = pair?.stats as {
    aWins: number; bWins: number; draws: number; aGoals: number; bGoals: number
    first: string | null; last: string | null
    biggest: { home: number; away: number; hg: number; ag: number; date: string | null } | null
  } | undefined
  const flip = pair && aId ? pair.team_a !== aId : false
  const w1 = stats ? (flip ? stats.bWins : stats.aWins) : 0
  const w2 = stats ? (flip ? stats.aWins : stats.bWins) : 0
  const g1 = stats ? (flip ? stats.bGoals : stats.aGoals) : 0
  const g2 = stats ? (flip ? stats.aGoals : stats.bGoals) : 0

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Innbyrðis viðureignir frá 1985</h1>
      <p className="text-sm muted mb-4">Veldu tvö lið til að sjá söguna í efstu deild. KSÍ á markatölur frá 1985; eldri leikir eru til sem leikjaskrár án úrslita.</p>
      <form className="flex gap-3 mb-6" method="get">
        <select name="a" defaultValue={a ?? ''} className="card px-3 py-2 text-sm flex-1" style={{ color: 'var(--text)' }}>
          <option value="">— Lið A —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select name="b" defaultValue={b ?? ''} className="card px-3 py-2 text-sm flex-1" style={{ color: 'var(--text)' }}>
          <option value="">— Lið B —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button type="submit" className="card px-4 py-2 text-sm font-semibold" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}>
          Sækja
        </button>
      </form>

      {aId && bId && !pair && (
        <p className="muted">Þessi lið hafa aldrei mæst í efstu deild.</p>
      )}
      {pair && stats && aId && bId && (
        <div className="card p-6">
          <div className="flex justify-end mb-2">
            <ShareButton
              title={`${nm(aId)} gegn ${nm(bId)}`}
              text={`${nm(aId)} ${w1}–${stats.draws}–${w2} ${nm(bId)} í efstu deild frá 1985:`}
              path={`/h2h?a=${aId}&b=${bId}`}
            />
          </div>
          <div className="grid grid-cols-3 items-center text-center mb-4">
            <h2 className="text-lg font-bold">{nm(aId)}</h2>
            <span className="text-3xl font-black num">{w1}–{stats.draws}–{w2}</span>
            <h2 className="text-lg font-bold">{nm(bId)}</h2>
          </div>
          <div className="grid gap-2 text-sm max-w-md mx-auto">
            <div className="flex justify-between"><span className="muted">Leikir alls</span><span className="num">{w1 + w2 + stats.draws}</span></div>
            <div className="flex justify-between"><span className="muted">Mörk</span><span className="num">{g1}–{g2}</span></div>
            <div className="flex justify-between"><span className="muted">Fyrsti leikur</span><span className="num">{stats.first ? new Date(stats.first).toLocaleDateString('is-IS', { timeZone: 'UTC' }) : '—'}</span></div>
            <div className="flex justify-between"><span className="muted">Nýjasti leikur</span><span className="num">{stats.last ? new Date(stats.last).toLocaleDateString('is-IS', { timeZone: 'UTC' }) : '—'}</span></div>
            {stats.biggest && (
              <div className="flex justify-between">
                <span className="muted">Stærsti sigur</span>
                <span className="num">{nm(stats.biggest.home)} {stats.biggest.hg}–{stats.biggest.ag} {nm(stats.biggest.away)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
