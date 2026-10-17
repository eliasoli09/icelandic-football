'use client'

import { useEffect, useState } from 'react'
import { Vote } from 'lucide-react'
import { browserDb } from '@/lib/leaderboard/store'
import { probLabel } from '@/lib/nfl/format'
import type { NflTeam } from '@/lib/nfl/types'
import { NflLogo } from './NflLogo'
import { ProbSplit } from './ProbSplit'

const DEVICE = 'nfl:taeki'
const VOTES = 'nfl:atkvaedi'

/** A random id for this device, kept so a reader can change their vote but not vote twice. */
function device(): string {
  try {
    let d = localStorage.getItem(DEVICE)
    if (!d) { d = crypto.randomUUID(); localStorage.setItem(DEVICE, d) }
    return d
  } catch { return crypto.randomUUID() }
}
const myVotes = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(VOTES) ?? '{}') } catch { return {} } }
const remember = (game: string, pick: string) => { try { localStorage.setItem(VOTES, JSON.stringify({ ...myVotes(), [game]: pick })) } catch { /* shown, not remembered */ } }

/** "Hver vinnur?": readers' votes against the model's chance. Results show once you have voted or the game has started. */
export function PollBox({ gameId, home, away, pHome, locked }: { gameId: string; home: NflTeam | undefined; away: NflTeam | undefined; pHome: number | null; locked: boolean }) {
  const [counts, setCounts] = useState<{ home: number; away: number } | null>(null)
  const [mine, setMine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const h = home?.abbr ?? 'HEIMA', a = away?.abbr ?? 'ÚTI'

  useEffect(() => {
    setMine(myVotes()[gameId] ?? null)
    void browserDb().rpc('rpc_nfl_poll_counts', { p_games: [gameId] }).then(({ data }) => {
      const r = (data ?? [])[0]
      setCounts(r ? { home: r.home, away: r.away } : { home: 0, away: 0 })
    })
  }, [gameId])

  const vote = async (pick: string) => {
    setBusy(true); setError(null)
    const { data, error: e } = await browserDb().rpc('rpc_nfl_poll_vote', { p_game: gameId, p_pick: pick, p_device: device() })
    setBusy(false)
    if (e) { setError(e.message.includes('hafinn') ? 'Leikurinn er hafinn, könnuninni er lokið.' : e.message.includes('neti') ? 'Of mörg atkvæði frá sama neti.' : 'Atkvæðið skilaði sér ekki. Reyndu aftur.'); return }
    const r = (data ?? [])[0]
    if (r) setCounts({ home: r.home, away: r.away })
    setMine(pick); remember(gameId, pick)
  }

  const total = counts ? counts.home + counts.away : 0
  const showResults = (mine || locked) && counts
  const share = counts && total ? counts.home / total : 0.5
  return (
    <section className="card p-5 grid gap-3" aria-label="Könnun">
      <h2 className="display text-lg font-extrabold inline-flex items-center gap-2"><Vote size={18} aria-hidden /> Hver vinnur?</h2>
      {!locked && (
        <div className="grid grid-cols-2 gap-2">
          {([[a, away], [h, home]] as const).map(([abbr, team]) => (
            <button key={abbr} disabled={busy} onClick={() => void vote(abbr)} aria-pressed={mine === abbr}
              className="rounded-xl border min-h-[48px] px-3 flex items-center justify-center gap-2 font-semibold"
              style={{ borderColor: mine === abbr ? 'var(--accent)' : 'var(--border)', background: mine === abbr ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent' }}>
              <NflLogo team={team} size={24} /> {team?.name.split(' ').at(-1) ?? abbr}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--loss)' }}>{error}</p>}
      {showResults ? (
        total ? (
          <div className="grid gap-1.5">
            <ProbSplit pHome={share} home={home} away={away} height={8} />
            <div className="flex justify-between text-xs num">
              <span>{a} {probLabel(1 - share)}</span>
              <span className="muted">{total} {total === 1 ? 'atkvæði' : 'atkvæði'}{pHome !== null ? ` · líkanið: ${h} ${probLabel(pHome)}` : ''}</span>
              <span>{h} {probLabel(share)}</span>
            </div>
          </div>
        ) : <p className="text-sm muted">Engin atkvæði{locked ? '.' : ' enn. Vertu fyrst(ur).'}</p>
      ) : !locked && <p className="text-xs muted">Niðurstaðan birtist þegar þú hefur kosið. Hægt er að skipta um skoðun fram að leik.</p>}
    </section>
  )
}
