import Link from 'next/link'
import { ChevronLeft, ChevronRight, Star as StarIcon } from 'lucide-react'
import { PlayersSwitch } from '@/components/Nfl/PlayersSwitch'
import { PlayerHead } from '@/components/Nfl/PlayerHead'
import { nflCurrentSeason, nflRoundLines, nflSeasonGames, nflTeams } from '@/lib/nfl/queries'
import { SLOT_LABEL, starWeek, statLine, type Star } from '@/lib/nfl/stars'
import { isPlayed, type NflTeam } from '@/lib/nfl/types'
import { weekLabel } from '@/lib/nfl/week'

export const metadata = {
  title: 'Stjörnulið vikunnar',
  description: 'Besti leikmaður í hverri stöðu í NFL-umferðinni, og leikstjórnandi, sóknarmaður og varnarmaður vikunnar.',
}

type Props = { searchParams: Promise<{ vika?: string }> }

const pts = (x: number) => String(x).replace('.', ',')

export default async function StarTeamPage({ searchParams }: Props) {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  const [games, teams] = await Promise.all([nflSeasonGames(season), nflTeams()])
  // rounds with at least one game played, oldest first
  const rounds = [...new Set(games.filter(isPlayed).map((g) => g.week))].sort((a, b) => a - b)
  const done = (wk: number) => games.filter((g) => g.week === wk).every(isPlayed)
  const asked = Number((await searchParams).vika)
  // by default the latest round that is over: a round with one game played is not a week's team
  let week = rounds.includes(asked) ? asked : [...rounds].reverse().find(done) ?? rounds[rounds.length - 1]
  let lines = week ? await nflRoundLines(season, week) : []
  // player stats land a day after the games: show the round before until they do
  if (!lines.length && !rounds.includes(asked) && rounds.indexOf(week) > 0) { week = rounds[rounds.indexOf(week) - 1]; lines = await nflRoundLines(season, week) }
  const played = games.filter((g) => g.week === week && isPlayed(g)).length
  const total = games.filter((g) => g.week === week).length
  const w = starWeek(lines)
  const team = new Map(teams.map((t) => [t.abbr, t]))
  const type = games.find((g) => g.week === week)?.game_type ?? 'REG'
  const i = rounds.indexOf(week)

  return (
    <div className="grid gap-6">
      <PlayersSwitch active="stjornulid" />
      <div className="flex items-center justify-between gap-3">
        {i > 0 ? <Link href={`/leikmenn/stjornulid?vika=${rounds[i - 1]}`} className="w-11 h-11 rounded-full border inline-flex items-center justify-center" style={{ borderColor: 'var(--border)' }} aria-label="Fyrri umferð"><ChevronLeft size={18} aria-hidden /></Link> : <span className="w-11" />}
        <div className="text-center">
          <p className="display text-2xl font-extrabold">Stjörnulið: {week ? weekLabel(type, week).toLowerCase() : '-'}</p>
          <p className="text-xs muted">{played < total ? `${played} af ${total} leikjum umferðarinnar spilaðir` : `Tímabilið ${season}`}</p>
        </div>
        {i >= 0 && i < rounds.length - 1 ? <Link href={`/leikmenn/stjornulid?vika=${rounds[i + 1]}`} className="w-11 h-11 rounded-full border inline-flex items-center justify-center" style={{ borderColor: 'var(--border)' }} aria-label="Næsta umferð"><ChevronRight size={18} aria-hidden /></Link> : <span className="w-11" />}
      </div>

      {!w.team.length ? (
        <p className="muted">Tölfræði leikmanna úr þessari umferð er ekki komin. Hún kemur venjulega daginn eftir leik.</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {([['Leikstjórnandi vikunnar', w.qb], ['Sóknarmaður vikunnar', w.offence], ['Varnarmaður vikunnar', w.defence]] as const).map(([title, s]) => s && (
              <Award key={title} title={title} star={s} team={team.get(s.line.team)} />
            ))}
          </section>

          <section className="grid gap-3">
            <h2 className="display text-xl font-extrabold">Stjörnuliðið</h2>
            <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {w.team.map((s) => (
                <li key={s.slot}>
                  <Link href={`/leikmadur/${s.line.player_id}`} className="trow grid grid-cols-[6.5rem_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                    <span className="text-[11px] font-bold tracking-wide muted">{SLOT_LABEL[s.slot].toUpperCase()}</span>
                    <PlayerHead name={s.line.name} src={s.line.headshot} color={team.get(s.line.team)?.color} size={36} />
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{s.line.name} <span className="muted font-normal text-xs">{s.line.team}{s.line.opponent ? ` gegn ${s.line.opponent}` : ''}</span></span>
                      <span className="block text-xs muted truncate">{statLine(s.line, s.slot)}</span>
                    </span>
                    <span className="num font-semibold">{pts(s.score)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-[11px] muted max-w-prose">
            Sóknarmenn fá stig eins og í fantasy: 1 fyrir hverja 25 sendingajarda, 1 fyrir hverja 10 hlaupa- eða gripjarda, ½ fyrir grip,
            4 fyrir snertimarkssendingu og 6 fyrir annað snertimark, −2 fyrir hlerun eða boltamissi. Varnarmenn: 4 fyrir fellu,
            5 fyrir hlerun, 4 fyrir þvingaðan boltamissi, 6 fyrir snertimark, 1,5 fyrir tæklingu fyrir tap og varða sendingu, 1 fyrir tæklingu.
            Flex er besti hlaupari, útherji eða innherji sem ekki er þegar í liðinu.
          </p>
        </>
      )}
    </div>
  )
}

function Award({ title, star, team }: { title: string; star: Star; team: NflTeam | undefined }) {
  return (
    <Link href={`/leikmadur/${star.line.player_id}`} className="card card-hover p-4 grid gap-3 content-start">
      <span className="text-[11px] font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><StarIcon size={12} aria-hidden /> {title.toUpperCase()}</span>
      <span className="flex items-center gap-3">
        <PlayerHead name={star.line.name} src={star.line.headshot} color={team?.color} size={56} />
        <span className="min-w-0">
          <span className="block font-bold text-lg leading-tight">{star.line.name}</span>
          <span className="block text-xs muted">{team?.name ?? star.line.team}{star.line.opponent ? ` gegn ${star.line.opponent}` : ''}</span>
        </span>
      </span>
      <span className="text-sm">{statLine(star.line, star.slot)}</span>
    </Link>
  )
}
