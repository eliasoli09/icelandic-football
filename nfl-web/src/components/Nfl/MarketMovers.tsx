import { OUTSIDE, rankLabel } from './MarketChart'
import type { Move } from '@/lib/nfl/market'
import { SEASON_MIN_GAMES, type ClientRow } from '@/lib/nfl/marketView'

function List({ title, sub, moves, names, onPick }: { title: string; sub: string; moves: Move[]; names: Map<string, ClientRow>; onPick: (id: string) => void }) {
  return (
    <div className="card p-4">
      <h3 className="display font-extrabold">{title}</h3>
      <p className="text-xs muted mb-2">{sub}</p>
      {moves.length ? (
        <ol className="grid">
          {moves.map((m) => {
            const r = names.get(m.player_id)
            return (
              <li key={m.player_id}>
                <button onClick={() => onPick(m.player_id)} className="trow w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-left min-h-[40px]">
                  <span className="min-w-0">
                    <span className="font-semibold block truncate">{r?.name ?? m.player_id}</span>
                    <span className="muted text-xs block truncate">{r?.position} · {m.from === null ? OUTSIDE : rankLabel(m.from)} → {rankLabel(m.rank)}</span>
                  </span>
                  <span className="font-bold tabular-nums whitespace-nowrap" style={{ color: m.change > 0 ? 'var(--good, #3fb950)' : 'var(--bad, #f85149)' }}>{m.change > 0 ? '▲' : '▼'} {Math.abs(m.change)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : <p className="text-sm muted">Engar hreyfingar enn.</p>}
    </div>
  )
}

/** Kaupa núna / Selja núna this round, and the biggest moves since the first round. Clicking a name puts him on the chart. */
export function MarketMovers({ week, season, first, board, onPick }: {
  week: { up: Move[]; down: Move[] }; season: { up: Move[]; down: Move[] }; first: number; board: ClientRow[]; onPick: (id: string) => void
}) {
  const names = new Map(board.map((r) => [r.player_id, r]))
  return (
    <section className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Kaupa núna" sub="Hækkuðu mest í umferðinni: náðu í hann áður en hann verður dýrari." moves={week.up} names={names} onPick={onPick} />
        <List title="Selja núna" sub="Lækkuðu mest í umferðinni: losaðu þig við hann áður en hann fellur meira." moves={week.down} names={names} onPick={onPick} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title={`Upp frá umferð ${first}`} sub={`Minnst ${SEASON_MIN_GAMES} leikir á tímabilinu.`} moves={season.up} names={names} onPick={onPick} />
        <List title={`Niður frá umferð ${first}`} sub={`Minnst ${SEASON_MIN_GAMES} leikir á tímabilinu.`} moves={season.down} names={names} onPick={onPick} />
      </div>
    </section>
  )
}
