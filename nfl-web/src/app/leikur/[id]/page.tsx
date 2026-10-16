import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { ProbSplit } from '@/components/Nfl/ProbSplit'
import { franchiseOf, predictGame } from '@/lib/nfl/elo'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { teamForm, type TeamForm } from '@/lib/nfl/form'
import { eloMove, modelSpreadLabel, probLabel, spreadLabel, totalLabel } from '@/lib/nfl/format'
import { devig } from '@/lib/nfl/odds'
import { nflGame, nflMeetings, nflNews, nflQbByName, nflSeasonModel } from '@/lib/nfl/queries'
import { NEWS_NOTE, NewsList } from '@/components/Nfl/NewsList'
import { ArticleList } from '@/components/Nfl/ArticleList'
import { nflGameArticles } from '@/lib/nfl/articles/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'
import { weekLabel } from '@/lib/nfl/week'

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const game = await nflGame((await params).id).catch(() => null)
  return { title: game ? `${game.away} @ ${game.home} - NFL` : 'Leikur fannst ekki' }
}

export default async function NflGamePage({ params }: Props) {
  const { id } = await params
  const game = await nflGame(id)
  if (!game) notFound()
  const model = await nflSeasonModel(game.season)
  const teams = new Map(model.teams.map((t) => [t.abbr, t]))
  const names = (abbr: string) => model.teams.filter((t) => t.franchise === franchiseOf(abbr)).map((t) => t.abbr)
  const meetings = (await nflMeetings(names(game.home), names(game.away), 6)).filter((g) => g.game_id !== game.game_id).slice(0, 5)
  const articles = await nflGameArticles(game.game_id, game.season, game.week).catch(() => [])
  const news = await nflNews({ teams: [franchiseOf(game.home), franchiseOf(game.away)], sinceDays: 7, limit: 4 }).catch(() => [])

  const played = isPlayed(game)
  const f = seasonForecasts(model.games, model.elo, model.state)[game.game_id]
  const pred = played ? null : predictGame(game, model.state)
  const eloRow = (abbr: string) => model.elo.find((r) => r.game_id === game.game_id && r.team === franchiseOf(abbr))
  const eloNow = (side: 'home' | 'away') => (pred ? (side === 'home' ? pred.eloHome : pred.eloAway) : eloRow(game[side])?.elo_before ?? null)
  const vegas = devig(game.home_ml, game.away_ml)
  const home = teams.get(game.home)
  const away = teams.get(game.away)
  const [awayQbId, homeQbId] = await Promise.all([game.away_qb, game.home_qb].map((q) => (q ? nflQbByName(q).catch(() => null) : null)))
  const sides = [
    { side: 'away' as const, team: away, abbr: game.away, qb: game.away_qb, qbId: awayQbId, newQb: f?.newQb?.away ?? null },
    { side: 'home' as const, team: home, abbr: game.home, qb: game.home_qb, qbId: homeQbId, newQb: f?.newQb?.home ?? null },
  ]

  return (
    <article className="grid gap-6">
      <Link href={`/?vika=${game.week}`} className="text-sm muted inline-flex items-center gap-1.5">
        <ArrowLeft size={14} aria-hidden /> {weekLabel(game.game_type, game.week)}
      </Link>

      <header className="card p-5 grid gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {sides.map(({ side, team, abbr }, i) => (
            <div key={side} className={`flex flex-col items-center gap-2 text-center ${i === 1 ? 'order-3' : ''}`}>
              <NflLogo team={team} size={64} />
              <span className="font-semibold leading-tight">{team?.name ?? abbr}</span>
              <span className="text-xs muted">{side === 'home' ? 'Heima' : 'Úti'}</span>
            </div>
          ))}
          <div className="order-2 text-center">
            {played ? (
              <p className="stat text-4xl">{game.away_score}–{game.home_score}</p>
            ) : (
              <p className="stat text-2xl">{game.time_tbd ? 'Tími óákveðinn' : clock(game.kickoff)}</p>
            )}
            <p className="text-xs muted mt-1">
              {played ? `Lokið${game.overtime ? ' · framl.' : ''}` : `${dayLabel(game.kickoff)}${isSmallHours(game.kickoff) ? ' · aðfaranótt' : ''}`}
            </p>
          </div>
        </div>
        {game.stadium && <p className="text-xs muted text-center">{game.stadium}{game.neutral ? ' (hlutlaus völlur)' : ''}</p>}
      </header>

      {f && (
        <section className="card p-5 grid gap-4">
          <h2 className="display text-lg font-extrabold">{played ? 'Spáin fyrir leik' : 'Spáin'}</h2>
          <div className="flex justify-between text-sm font-semibold num">
            <span>{game.away} {probLabel(1 - f.pHome)}</span>
            <span>{game.home} {probLabel(f.pHome)}</span>
          </div>
          <ProbSplit pHome={f.pHome} home={home} away={away} height={10} />
          <div className="table-wrap">
            <table className="text-sm w-full [&_td]:py-1.5 [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr className="muted text-xs text-left">
                  <th />
                  <th className="text-right">{game.away}</th>
                  <th className="text-right">{game.home}</th>
                  <th className="text-right">Forgjöf</th>
                </tr>
              </thead>
              <tbody>
                <tr className="trow">
                  <td className="font-semibold">Líkanið</td>
                  <td className="text-right num">{probLabel(1 - f.pHome)}</td>
                  <td className="text-right num">{probLabel(f.pHome)}</td>
                  <td className="text-right num">{f.spread !== null ? modelSpreadLabel(game.home, game.away, f.spread) : '-'}</td>
                </tr>
                <tr className="trow">
                  <td className="font-semibold">Vegas</td>
                  <td className="text-right num">{vegas ? probLabel(vegas.away) : '-'}</td>
                  <td className="text-right num">{vegas ? probLabel(vegas.home) : '-'}</td>
                  <td className="text-right num">{spreadLabel(game) ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {game.total_line !== null && <p className="text-xs muted">Heildarstig Vegas: {totalLabel(game.total_line)}. Líkanið spáir ekki heildarstigum.</p>}
          <p className="text-xs muted">Líkur Vegas eru reiknaðar úr stuðlunum (moneyline) eftir að álag bókarans er dregið frá.</p>
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-4">
        {sides.map(({ side, team, abbr, qb, qbId, newQb }) => (
          <TeamPanel key={side} team={team} abbr={abbr} elo={eloNow(side)} form={teamForm(abbr, game.kickoff, model.games, model.elo)} qb={qb} qbId={qbId} newQb={played ? null : newQb} />
        ))}
      </section>

      {articles.length > 0 && (
        <section className="grid gap-3">
          <h2 className="display text-lg font-extrabold">Greinar um leikinn</h2>
          <ArticleList items={articles} compact />
        </section>
      )}
      {news.length > 0 && (
        <section className="grid gap-3">
          <h2 className="display text-lg font-extrabold">Fréttir um liðin</h2>
          <NewsList items={news} compact />
          <p className="text-[11px] muted">{NEWS_NOTE}</p>
        </section>
      )}

      <section className="card p-5">
        <h2 className="display text-lg font-extrabold mb-3">Innbyrðis</h2>
        {meetings.length === 0 ? <p className="text-sm muted">Liðin hafa ekki mæst síðan 1999.</p> : (
          <ul className="grid gap-1.5 text-sm">
            {meetings.map((m) => <Meeting key={m.game_id} g={m} />)}
          </ul>
        )}
      </section>
    </article>
  )
}

function TeamPanel({ team, abbr, elo, form, qb, qbId, newQb }: { team: NflTeam | undefined; abbr: string; elo: number | null; form: TeamForm; qb: string | null; qbId: string | null; newQb: { qb: string; usual: string } | null }) {
  const change = form.eloChange5
  return (
    <div className="card p-5 grid gap-3">
      <div className="flex items-center gap-2.5">
        <NflLogo team={team} size={28} />
        <h3 className="font-semibold">{team?.name ?? abbr}</h3>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="muted">Elo</dt>
        <dd className="text-right num font-semibold">
          {elo === null ? 'engin saga' : Math.round(elo)}
          {change !== null && (() => {
            const m = eloMove(change)
            return <span className="ml-2 text-xs" style={{ color: m.dir === 'up' ? 'var(--win)' : m.dir === 'down' ? 'var(--loss)' : 'var(--text-2)' }}>{m.text}</span>
          })()}
        </dd>
        <dt className="muted">Met tímabilsins</dt>
        <dd className="text-right num">{form.record.w}-{form.record.l}{form.record.t ? `-${form.record.t}` : ''}</dd>
        <dt className="muted">Síðustu leikir</dt>
        <dd className="text-right">
          {form.last5.length === 0 ? <span className="muted">engir</span> : (
            <span className="inline-flex gap-1">
              {form.last5.map((r, i) => (
                <span key={i} className="w-5 h-5 rounded text-[10px] font-bold inline-flex items-center justify-center"
                  style={{ background: r === 'S' ? 'var(--win)' : r === 'T' ? 'var(--loss)' : 'var(--draw)', color: '#0a0d0b' }}>{r}</span>
              ))}
            </span>
          )}
        </dd>
        <dt className="muted">Leikstjórnandi</dt>
        <dd className="text-right">{qb && qbId ? <Link href={`/leikmadur/${qbId}`} className="underline decoration-dotted underline-offset-2">{qb}</Link> : qb ?? '-'}</dd>
      </dl>
      {change !== null && <p className="text-[11px] muted">Breyting á Elo síðustu {form.last5.length} leiki.</p>}
      {newQb && (
        <p className="text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <AlertTriangle size={12} aria-hidden /> Nýr leikstjórnandi: {newQb.qb} (í stað {newQb.usual})
        </p>
      )}
    </div>
  )
}

function Meeting({ g }: { g: NflGame }) {
  // the season, not the calendar year: a Super Bowl in February belongs to the autumn before
  return (
    <li>
      <Link href={`/leikur/${g.game_id}`} className="trow flex items-center justify-between gap-3 px-2 py-1.5 rounded">
        <span className="muted num w-12">{g.season}</span>
        <span className="flex-1">
          {g.away} @ {g.home}
          {g.game_type !== 'REG' && <span className="text-xs muted ml-2">{weekLabel(g.game_type, g.week)}</span>}
        </span>
        <span className="num font-semibold">{g.away_score}–{g.home_score}</span>
      </Link>
    </li>
  )
}
