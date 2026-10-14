import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { PlayerHead } from '@/components/Nfl/PlayerHead'
import { barColor } from '@/lib/nfl/format'
import { ageOn, draftLabel, STATS, statGroups, type StatGroup } from '@/lib/nfl/players'
import { nflPlayer, nflPlayerCareer, nflPlayerGames, nflTeams, type PlayerSeasonRow } from '@/lib/nfl/queries'
import { GROUP_COLUMNS, GROUP_LABEL } from '@/lib/nfl/statColumns'
import type { NflTeam } from '@/lib/nfl/types'
import { weekLabel } from '@/lib/nfl/week'

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const p = await nflPlayer((await params).id).catch(() => null)
  return { title: p ? `${p.name} - NFL` : 'Leikmaður fannst ekki' }
}

/** Groups the position calls for, or else whichever groups the player actually has numbers in. */
function groupsFor(position: string | null, career: PlayerSeasonRow[]): StatGroup[] {
  const g = statGroups(position)
  if (g.length) return g
  const has = (keys: string[]) => career.some((r) => keys.some((k) => Number(r[k as keyof PlayerSeasonRow]) > 0))
  return (['sendingar', 'hlaup', 'gripir', 'vorn'] as StatGroup[]).filter((x) =>
    has(x === 'sendingar' ? ['attempts'] : x === 'hlaup' ? ['carries'] : x === 'gripir' ? ['targets'] : ['tackles_solo', 'tackle_assists', 'def_sacks']))
}

export default async function NflPlayerPage({ params }: Props) {
  const { id } = await params
  const player = await nflPlayer(id)
  if (!player) notFound()
  const [career, teamList] = await Promise.all([nflPlayerCareer(id), nflTeams()])
  const teams = new Map(teamList.map((t) => [t.abbr, t]))
  const latest = career.length ? Math.max(...career.map((r) => r.season)) : null
  const games = latest ? await nflPlayerGames(id, latest) : []
  const groups = groupsFor(player.position, career)
  const thisSeason = career.filter((r) => r.season === latest)
  const team = teams.get(thisSeason[0]?.team ?? player.team ?? '')
  const age = ageOn(player.birth_date, new Date())
  const reg = career.filter((r) => r.season_type === 'REG')
  const post = career.filter((r) => r.season_type === 'POST')

  return (
    // minmax(0, 1fr): a wide career table must scroll inside its card, not widen the page
    <article className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Link href="/nfl/leikmenn" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Leikmenn</Link>

      <header className="card p-5 flex flex-wrap items-center gap-5">
        <PlayerHead name={player.name} src={player.headshot} color={barColor(team)} size={88} />
        <div className="grid gap-1 min-w-0">
          <h2 className="display text-2xl font-extrabold">{player.name}</h2>
          <p className="text-sm muted flex flex-wrap items-center gap-x-2 gap-y-1">
            {team && <span className="inline-flex items-center gap-1.5"><NflLogo team={team} size={16} />{team.name}</span>}
            {player.position && <span>· {player.position}</span>}
            {player.jersey !== null && <span>· #{player.jersey}</span>}
            {age !== null && <span>· {age} ára</span>}
          </p>
          <p className="text-xs muted">
            {draftLabel(player)}{player.draft_team ? ` (${player.draft_team})` : ''}
            {player.college ? ` · ${player.college}` : ''}
            {player.rookie_season ? ` · nýliði ${player.rookie_season}` : ''}
          </p>
        </div>
      </header>

      {latest && groups.length > 0 && (
        <section className="card p-5 grid gap-4">
          <h3 className="display text-lg font-extrabold">Tímabilið {latest}</h3>
          {groups.map((g) => {
            const row = thisSeason.find((r) => r.season_type === 'REG') ?? thisSeason[0]
            return (
              <div key={g}>
                <p className="text-xs muted mb-1.5">{GROUP_LABEL[g]}</p>
                <dl className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {GROUP_COLUMNS[g].map((c) => (
                    <div key={c.label} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }} title={c.title}>
                      <dt className="text-[11px] muted">{c.label}</dt>
                      <dd className="stat text-lg">{row ? c.value(row) : '-'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </section>
      )}

      {games.length > 0 && (
        <section className="card p-5">
          <h3 className="display text-lg font-extrabold mb-3">Leikir {latest}</h3>
          <StatTable groups={groups} teams={teams} rows={games.map((w) => ({
            key: `${w.season_type}-${w.week}`,
            first: w.season_type === 'POST' ? weekLabel(postType(w.week, w.season), w.week) : `Vika ${w.week}`,
            team: w.opponent, prefix: 'gegn', values: w,
          }))} />
        </section>
      )}

      {reg.length > 0 && (
        <section className="card p-5">
          <h3 className="display text-lg font-extrabold mb-3">Ferillinn</h3>
          <StatTable groups={groups} teams={teams} withGames rows={reg.map((r) => ({ key: `${r.season}`, first: String(r.season), team: r.team, values: r, games: r.games }))} />
          {post.length > 0 && (
            <>
              <h4 className="text-sm font-semibold mt-5 mb-2">Úrslitakeppni</h4>
              <StatTable groups={groups} teams={teams} withGames rows={post.map((r) => ({ key: `p${r.season}`, first: String(r.season), team: r.team, values: r, games: r.games }))} />
            </>
          )}
          <p className="text-[11px] muted mt-3">Tölfræði frá 1999. Gögn: nflverse.</p>
        </section>
      )}
    </article>
  )
}

// the weekly file numbers playoff rounds as weeks after the regular season
function postType(week: number, season: number) {
  const first = season >= 2021 ? 19 : 18
  return (['WC', 'DIV', 'CON', 'SB'] as const)[Math.min(3, Math.max(0, week - first))]
}

type TableRow = { key: string; first: string; team: string; prefix?: string; values: Partial<Record<(typeof STATS)[number], number>>; games?: number }

function StatTable({ groups, teams, rows, withGames }: { groups: StatGroup[]; teams: Map<string, NflTeam>; rows: TableRow[]; withGames?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="text-sm w-full [&_td]:px-2 [&_th]:px-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead>
          <tr className="muted text-xs text-left">
            <th />
            <th>Lið</th>
            {withGames && <th className="text-right">L</th>}
            {groups.flatMap((g) => GROUP_COLUMNS[g].map((c, i) => (
              <th key={`${g}-${c.label}`} className={`text-right ${i === 0 ? 'pl-4' : ''}`} title={`${GROUP_LABEL[g]}: ${c.title}`}>{c.label}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="trow">
              <td className="py-1.5 num muted">{r.first}</td>
              <td>
                <span className="inline-flex items-center gap-1.5">
                  {r.prefix && <span className="muted text-xs">{r.prefix}</span>}
                  <NflLogo team={teams.get(r.team)} size={16} />{r.team}
                </span>
              </td>
              {withGames && <td className="text-right num">{r.games}</td>}
              {groups.flatMap((g) => GROUP_COLUMNS[g].map((c, i) => (
                <td key={`${g}-${c.label}`} className={`text-right num ${i === 0 ? 'pl-4' : ''}`}>{c.value(r.values)}</td>
              )))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
