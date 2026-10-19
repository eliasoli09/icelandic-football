import Link from 'next/link'
import { Bomb, Flame, Footprints, Hand, Send, Shield, Sigma, Target, Trophy, Zap } from 'lucide-react'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { PlayerHead } from '@/components/Nfl/PlayerHead'
import { TrackButton } from '@/components/Nfl/TrackButton'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { probLabel } from '@/lib/nfl/format'
import { availability, STATUS_LABEL } from '@/lib/nfl/injuries'
import { nflCurrentSeason, nflInjuries, nflSeasonModel, nflVedmalData, type InjuryList } from '@/lib/nfl/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import type { NflTeam } from '@/lib/nfl/types'
import type { Leg, Slip, YardStat } from '@/lib/nfl/vedmal'
import type { BetLeg } from '@/lib/nfl/tracker'
import { BACKTEST, vedmalWeek, type PlayerPick } from '@/lib/nfl/vedmalView'
import { weekLabel } from '@/lib/nfl/week'

export const revalidate = 300
export const metadata = {
  title: 'Veðmálin',
  description: 'Seðlar vikunnar í NFL (Double Trouble, Sprengjan og Bomban), líklegustu snertimarksskorararnir, hlaupamestu leikmennirnir, markahæstu leikirnir og sigurstranglegustu liðin.',
}

const dec = (x: number, d = 2) => x.toFixed(d).replace('.', ',')
const kr = (x: number) => `${Math.round(x).toLocaleString('de-DE')} kr.`
const when = (iso: string) => `${dayLabel(iso)} ${isSmallHours(iso) ? 'aðfaranótt ' : 'kl. '}${clock(iso)}`
const SLIP_ICON = { double: Zap, sprengjan: Flame, bomban: Bomb } as const
const TABS = [{ key: 'sedlar', label: 'Seðlar' }, { key: 'leikmenn', label: 'Leikmenn' }, { key: 'leikir', label: 'Leikir' }]
const LIST_LABEL: Record<string, string> = { pass: 'Sendingar', rec: 'Gripjardar', catches: 'Grip', sacks: 'Fellur', ints: 'Hleranir' }

/** A row of links that reads as tabs: the active one filled. */
function Pills({ label, items, active, small = false }: { label: string; items: { key: string; label: string; href: string }[]; active: string; small?: boolean }) {
  return (
    <nav aria-label={label} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? 'page' : undefined} scroll={false}
          className={`shrink-0 rounded-full border font-semibold ${small ? 'px-3 min-h-[34px] text-[13px]' : 'px-4 min-h-[38px] text-sm'} inline-flex items-center`}
          style={i.key === active ? { background: 'var(--pill)', borderColor: 'transparent', color: '#ffffff' } : { borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
const n0 = (x: number) => String(Math.round(x))
const n1 = (x: number) => x.toFixed(1).replace('.', ',').replace(',0', '')
const last3 = (p: PlayerPick, f: (x: number) => string) => p.basis.recent.length ? ` · síðustu ${p.basis.recent.length}: ${p.basis.recent.map(f).join(', ')}` : ''
/** The numbers behind a pick: the player's own ("Meðaltal 88 · síðustu 3: 102, 75, 91") and, where phones have room for less, the opponent's ("LAC gefur 131 í leik (deild 117)"). */
type BasisText = [mine: string, more: string]
const basisLine = (f: (x: number) => string, opp: (p: PlayerPick, x: string, lg: string) => string) => (p: PlayerPick): BasisText =>
  [`Meðaltal ${f(p.basis.avg)}${last3(p, f)}`, p.basis.opp !== null && p.basis.league !== null ? opp(p, f(p.basis.opp), f(p.basis.league)) : '']
/** Touchdowns: the count and the last three games, then the usage behind them. */
const tdBasis = (p: PlayerPick): BasisText => {
  const [count, use] = (p.basis.note ?? '').split(' · ')
  return [`${count ?? ''}${last3(p, n0)}`, use ?? '']
}
const gives = (what: string) => (p: PlayerPick, x: string, lg: string) => `${p.opp} gefur ${x} ${what} í leik (deild ${lg})`
const MARKET_VIEW: Record<string, { icon: typeof Target; fmt: (v: number) => string; basis: (p: PlayerPick) => BasisText }> = {
  pass: { icon: Send, fmt: n0, basis: basisLine(n0, gives('sendingajarda')) },
  rec: { icon: Hand, fmt: n0, basis: basisLine(n0, gives('gripjarda')) },
  catches: { icon: Hand, fmt: n1, basis: basisLine(n1, gives('grip')) },
  sacks: { icon: Shield, fmt: (v) => probLabel(v), basis: basisLine(n1, (p, x, lg) => `${p.opp} fær á sig ${x} fellur í leik (deild ${lg})`) },
  ints: { icon: Shield, fmt: (v) => probLabel(v), basis: basisLine(n1, gives('hleranir')) },
}

export default async function VedmalPage({ searchParams }: { searchParams: Promise<{ syn?: string; listi?: string }> }) {
  const sp = await searchParams
  let view: ReturnType<typeof vedmalWeek> = null
  let teams: NflTeam[] = []
  let inj: InjuryList = { week: null, rows: [] }
  try {
    const season = await nflCurrentSeason()
    if (season) {
      const [model, data] = await Promise.all([nflSeasonModel(season), nflVedmalData(season)])
      teams = model.teams
      const now = new Date()
      const next = model.games.filter((g) => new Date(g.kickoff) > now && g.home_score === null).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
      // a missing injury list must not take the page down: the players just are not filtered
      inj = next ? await nflInjuries(season, next.week).catch(() => ({ week: null, rows: [] })) : inj
      view = vedmalWeek(model.games, seasonForecasts(model.games, model.elo, model.state), data.lines, data.prev, data.leaguePts, data.teamGames, now, (wk) => availability(inj.rows, inj.week, wk))
    }
  } catch {
    return <p className="muted">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>
  }
  if (!view) return <p className="muted">Engir leikir fram undan með stuðlum. Seðlarnir koma þegar næsta umferð fær stuðla.</p>
  const team = new Map(teams.map((t) => [t.abbr, t]))
  const B = BACKTEST

  const tab = TABS.some((t) => t.key === sp.syn) ? sp.syn! : 'sedlar'
  const lists: { key: string; label: string; el: React.ReactNode }[] = [
    { key: 'snertimork', label: 'Snertimörk', el: <PlayerList icon={Target} title="Líklegustu snertimarksskorararnir" unit="líkur á snertimarki" picks={view.scorers} fmt={(v) => probLabel(v)} team={team} basis={tdBasis} /> },
    { key: 'hlaup', label: 'Hlaup', el: <PlayerList icon={Footprints} title="Hlaupamestir" unit="spáðir hlaupajardar" picks={view.rushers} fmt={n0} team={team} basis={basisLine(n0, gives('hlaupajarda'))} /> },
    ...view.markets.map((m) => {
      const mv = MARKET_VIEW[m.key]
      return { key: m.key, label: LIST_LABEL[m.key] ?? m.title, el: <PlayerList icon={mv.icon} title={m.title} unit={m.unit} picks={m.picks} fmt={mv.fmt} team={team} basis={mv.basis} /> }
    }),
  ]
  const list = lists.find((l) => l.key === sp.listi) ?? lists[0]
  const href = (q: Record<string, string>) => `/vedmal?${new URLSearchParams(q)}`

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-3xl font-extrabold">Veðmálin</h1>
          <span className="rounded-full border px-2 py-0.5 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>18+</span>
        </div>
        <p className="muted text-sm">{weekLabel(view.type, view.week)} · {view.games.length} {view.games.length === 1 ? 'leikur' : 'leikir'} eftir</p>
        {inj.week !== view.week && <p className="text-xs muted">Meiðslaskýrsla vikunnar er ekki komin; aðeins leikmenn á meiðslalista eru teknir út. <Link href="/leikmenn/meidsli" className="underline">Meiðslalistinn</Link></p>}
      </header>

      <Pills label="Veðmálin" items={TABS.map((t) => ({ key: t.key, label: t.label, href: href({ syn: t.key }) }))} active={tab} />

      {tab === 'sedlar' && (
        <div className="grid gap-6">
          <div className="grid gap-3 md:grid-cols-3">
            {view.slips.map((s) => <SlipCard key={s.key} k={s.key} name={s.name} target={s.target} slip={s.slip} withPlayer={s.withPlayer} team={team} />)}
          </div>
          {view.scorerSlips.length > 0 && (
            <section className="grid gap-3" aria-label="Snertimarkaseðillinn">
              <h2 className="display text-xl font-extrabold inline-flex items-center gap-2"><Target size={18} aria-hidden /> Snertimarkaseðillinn</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {view.scorerSlips.map((s) => (
                  <article key={s.picks.length} className="card p-4 grid gap-3 content-start">
                    <p className="display text-lg font-extrabold">{s.picks.length === 2 ? 'Tvenna' : 'Þrenna'}: allir skora</p>
                    <ul className="grid gap-2">
                      {s.picks.map((p) => (
                        <li key={p.player_id}>
                          <Link href={`/leikmadur/${p.player_id}`} className="trow rounded-lg grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2 py-1.5 -mx-2">
                            <PlayerHead name={p.name} src={p.headshot} color={team.get(p.team)?.color} size={30} />
                            <span className="min-w-0"><span className="block font-semibold truncate">{p.name} skorar</span><span className="block text-xs muted truncate">{p.position ?? ''} · {p.team} gegn {p.opp}</span></span>
                            <span className="num font-semibold">{probLabel(p.value)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-end justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <span><span className="block text-[11px] muted">Líkur</span><span className="num font-bold text-lg">{probLabel(s.p)}</span></span>
                      <span className="text-right"><span className="block text-[11px] muted">Sanngjarn stuðull</span><span className="num font-extrabold text-2xl" style={{ color: 'var(--accent)' }}>{dec(s.fair)}</span></span>
                    </div>
                    <TrackButton name={`Snertimarka${s.picks.length === 2 ? 'tvenna' : 'þrenna'}`} odds={Math.round(s.fair * 100) / 100} fair legs={s.picks.map((p) => ({ kind: 'td', game_id: p.game_id, player_id: p.player_id, name: p.name, team: p.team }))} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'leikmenn' && (
        <div className="grid gap-4">
          <Pills label="Listar" small items={lists.map((l) => ({ key: l.key, label: l.label, href: href({ syn: 'leikmenn', listi: l.key }) }))} active={list.key} />
          <div className="max-w-2xl w-full">{list.el}</div>
        </div>
      )}

      {tab === 'leikir' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="grid gap-3 content-start" aria-label="Sigurstranglegustu">
            <h2 className="display text-xl font-extrabold inline-flex items-center gap-2"><Trophy size={18} aria-hidden /> Sigurstranglegustu</h2>
            <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {view.favourites.slice(0, 10).map((f) => (
                <li key={`${f.game.game_id}:${f.team}`}>
                  <Link href={`/leikur/${f.game.game_id}`} className="trow grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                    <NflLogo team={team.get(f.team)} size={28} />
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{team.get(f.team)?.name ?? f.team} <span className="muted font-normal text-xs">{f.game.home === f.team ? 'gegn' : 'á útivelli gegn'} {f.opp}</span></span>
                      <span className="block text-xs muted">Líkanið okkar: {probLabel(f.model)} · {when(f.game.kickoff)}</span>
                    </span>
                    <span className="num font-bold text-lg" style={{ color: 'var(--accent)' }}>{probLabel(f.p)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-3 content-start" aria-label="Markahæstu leikirnir">
            <h2 className="display text-xl font-extrabold inline-flex items-center gap-2"><Sigma size={18} aria-hidden /> Markahæstu leikirnir</h2>
            <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {view.totals.slice(0, 8).map((x) => (
                <li key={x.game.game_id}>
                  <Link href={`/leikur/${x.game.game_id}`} className="trow grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold truncate">
                        <NflLogo team={team.get(x.game.away)} size={20} /> {x.game.away} <span className="muted font-normal">{dec(x.away, 1)}</span>
                        <span className="muted font-normal">@</span>
                        <NflLogo team={team.get(x.game.home)} size={20} /> {x.game.home} <span className="muted font-normal">{dec(x.home, 1)}</span>
                      </span>
                      <span className="block text-xs muted">{when(x.game.kickoff)}</span>
                    </span>
                    <span className="text-right"><span className="block num font-bold text-lg leading-none">{dec(x.total, 1)}</span><span className="text-[11px] muted">stig</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <details className="card px-4 py-3 text-sm">
        <summary className="font-semibold cursor-pointer">Hvernig er þetta reiknað?</summary>
        <div className="grid gap-2 mt-3 muted text-xs max-w-prose leading-relaxed">
          <p>Hver seðill er sá líklegasti sem nær stuðlinum (mest 15% yfir), mest einn leggur úr hverjum leik. Sigur og yfir/undir eru á stuðlum veðbankanna og með líkum þeirra eftir að álag er dregið frá. Elo-líkanið okkar fékk að velja í prófun á {B.test[0]}-{B.test[1]} og gerði það verr: seðlar þess sögðust ganga upp í {probLabel(B.slipsModelOnly.double.modelP)} tilvika (Double Trouble) en gerðu það í {probLabel(B.slipsModelOnly.double.hitRate)}.</p>
          <p>Prófað á {B.test[0]}-{B.test[1]}: {view.slips.map((s) => { const p = B.slipsPlayers[s.key as keyof typeof B.slipsPlayers]; return `${s.name} gekk upp í ${probLabel(p.hitRate)} vikna (líkurnar sögðu ${probLabel(p.said)})` }).join(', ')}.</p>
          <p>Leikmannaleggir (snertimark, jardar) eru með líkum okkar. Við höfum ekki stuðla veðbanka á leikmenn, svo stuðullinn er áætlaður (≈) með álagi eins og veðbankar leggja yfirleitt á. Þeir hækka ekki líkurnar fyrir sama stuðul, svo leikmannaútgáfa hvers seðils er sér, með því sem hún kostar. Snertimarkaseðillinn er á okkar sanngjarna stuðli, án álags.</p>
          <p>Snertimörk: þeir sem fengu 50-60% skoruðu í {probLabel(B.td.test.buckets[5].scored)} tilvika. Hlaupajardar skeika um {Math.round(B.rush.test.mae)} jarda að jafnaði. Aðeins leikmenn sem spiluðu síðasta leik liðsins; þeir sem eru frá eða ólíklegir eru teknir út. Hleranir eru ekki með: þar gerði spáin ekki betur en að gefa öllum sömu líkur.</p>
          <p>Heildarstig eru lína veðbankanna: okkar eigin spá skeikaði um {dec(B.totals.test.mae, 1)} stig, lína Vegas um {dec(B.totals.test.maeVegas, 1)}.</p>
        </div>
      </details>

      <p className="text-xs muted max-w-prose">
        Líkur, ekki loforð. Til fróðleiks og skemmtunar, ekki á vegum neins veðbanka. Aðeins fyrir 18 ára og eldri. Ef spilamennskan er farin að valda vanda: Hjálparsími Rauða krossins, 1717, allan sólarhringinn.
      </p>
    </div>
  )
}

function SlipCard({ k, name, target, slip, withPlayer, team }: { k: string; name: string; target: number; slip: Slip | null; withPlayer: Slip | null; team: Map<string, NflTeam> }) {
  const Icon = SLIP_ICON[k as keyof typeof SLIP_ICON]
  const same = !!slip && !!withPlayer && slip.legs.length === withPlayer.legs.length && slip.legs.every((l, i) => l === withPlayer.legs[i])
  return (
    <article className="card p-4 grid gap-3 content-start">
      <header className="flex items-center justify-between gap-2">
        <span className="display text-lg font-extrabold inline-flex items-center gap-2"><Icon size={18} aria-hidden style={{ color: 'var(--accent)' }} /> {name}</span>
        <span className="text-xs muted">stuðull um {dec(target, 1)}</span>
      </header>
      {!slip ? <p className="text-sm muted">Enginn seðill nær þessum stuðli úr leikjunum sem eftir eru.</p> : (
        <>
          <ul className="grid gap-2">
            {slip.legs.map((l) => <LegRow key={l.game_id} l={l} team={team} />)}
          </ul>
          <div className="flex items-end justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <span>
              <span className="block text-[11px] muted">Líkur</span>
              <span className="num font-bold text-lg">{probLabel(slip.p)}</span>
            </span>
            <span className="text-right">
              <span className="block text-[11px] muted">{slip.estimated ? 'Áætlaður heildarstuðull' : 'Heildarstuðull'}</span>
              <span className="num font-extrabold text-2xl" style={{ color: 'var(--accent)' }}>{slip.estimated ? '≈ ' : ''}{dec(slip.odds)}</span>
            </span>
          </div>
          <TrackButton name={name} odds={Math.round(slip.odds * 100) / 100} fair={slip.estimated} legs={slip.legs.map(trackLeg)} />
        </>
      )}
      {withPlayer && !same && (
        <details className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
          <summary className="cursor-pointer font-semibold">Með leikmönnum: {probLabel(withPlayer.p)} á ≈ {dec(withPlayer.odds)}{slip ? <span className="muted font-normal"> ({Math.round((slip.p - withPlayer.p) * 100)} prósentustigum minna)</span> : null}</summary>
          <ul className="grid gap-2 mt-2">{withPlayer.legs.map((l) => <LegRow key={l.game_id} l={l} team={team} />)}</ul>
          <div className="mt-2"><TrackButton name={`${name} með leikmönnum`} odds={Math.round(withPlayer.odds * 100) / 100} fair legs={withPlayer.legs.map(trackLeg)} /></div>
        </details>
      )}
    </article>
  )
}

const STAT_WORD: Record<YardStat, string> = { rush: 'hlaupajarda', rec: 'gripjarda', pass: 'sendingajarda' }
const line1 = (x: number) => String(x).replace('.', ',')

/** One pick on a slip: who or what, the game, and the price (≈ when estimated). */
function LegRow({ l, team }: { l: Leg; team: Map<string, NflTeam> }) {
  const game = `${l.kind === 'win' ? (l.home ? 'gegn' : 'á útivelli gegn') + ' ' + l.opp : l.kind === 'over' || l.kind === 'under' ? `${l.opp} @ ${l.team}` : `${l.team} ${l.home ? 'gegn' : '@'} ${l.opp}`} · ${when(l.kickoff)}`
  const what = l.kind === 'win' ? `${team.get(l.team)?.name ?? l.team} vinnur`
    : l.kind === 'over' ? `Yfir ${line1(l.line!)} stig` : l.kind === 'under' ? `Undir ${line1(l.line!)} stig`
    : l.kind === 'td' ? `${l.player!.name} skorar` : `${l.player!.name}: ${line1(l.line!)}+ ${STAT_WORD[l.stat!]}`
  const href = l.player ? `/leikmadur/${l.player.id}` : `/leikur/${l.game_id}`
  return (
    <li>
      <Link href={href} className="trow rounded-lg grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2 py-1.5 -mx-2">
        {l.player ? <PlayerHead name={l.player.name} src={l.player.headshot} color={team.get(l.team)?.color} size={28} /> : <NflLogo team={team.get(l.team)} size={28} />}
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{what}</span>
          <span className="block text-xs muted truncate">{game} · {probLabel(l.p)}</span>
        </span>
        <span className="num font-semibold" title={l.estimated ? 'Áætlaður stuðull: við höfum ekki stuðla veðbanka á leikmenn' : undefined}>{l.estimated ? '≈' : ''}{dec(l.odds)}</span>
      </Link>
    </li>
  )
}

/** A slip pick as the dashboard follows it. */
function trackLeg(l: Leg): BetLeg {
  const odds = Math.round(l.odds * 100) / 100
  if (l.kind === 'win') return { kind: 'win', game_id: l.game_id, team: l.team, odds }
  if (l.kind === 'over' || l.kind === 'under') return { kind: 'total', game_id: l.game_id, team: l.team, side: l.kind, line: l.line! }
  const p = { game_id: l.game_id, player_id: l.player!.id, name: l.player!.name, team: l.team }
  return l.kind === 'td' ? { kind: 'td', ...p } : { kind: 'yards', ...p, stat: l.stat!, line: l.line! }
}

/** On a phone the top five show and the rest open on demand; from a tablet up, all of them. */
const PHONE_ROWS = 5

function PlayerList({ icon: Icon, title, unit, picks, fmt, team, note, basis }: { icon: typeof Target; title: string; unit: string; picks: PlayerPick[]; fmt: (v: number) => string; team: Map<string, NflTeam>; note?: string; basis: (p: PlayerPick) => BasisText }) {
  const row = (p: PlayerPick, i: number, cls = '') => {
    const [mine, more] = basis(p)
    return (
      <li key={p.player_id} className={cls}>
        <Link href={`/leikmadur/${p.player_id}`} className="trow grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-2.5">
          <span className="text-xs muted num pt-2">{i + 1}</span>
          <PlayerHead name={p.name} src={p.headshot} color={team.get(p.team)?.color} size={32} />
          <span className="min-w-0">
            <span className="block font-semibold truncate">{p.name}{p.status && <span className="ml-1.5 rounded px-1 py-px text-[10px] font-bold align-middle" style={{ background: 'color-mix(in srgb, var(--loss) 18%, transparent)', color: 'var(--loss)' }}>{STATUS_LABEL[p.status].toUpperCase()}</span>}</span>
            <span className="block text-xs muted truncate">{p.position ?? ''} · {p.team} gegn {p.opp}</span>
            <span className="block text-[11px] muted">{mine}{more && <span className="hidden sm:inline"> · {more}</span>}</span>
          </span>
          <span className="num font-bold" style={{ color: 'var(--accent)' }} title={unit}>{fmt(p.value)}</span>
        </Link>
      </li>
    )
  }
  const rest = picks.slice(PHONE_ROWS)
  return (
    <section className="grid gap-3 content-start" aria-label={title}>
      <h2 className="display text-xl font-extrabold inline-flex items-center gap-2"><Icon size={18} aria-hidden /> {title}</h2>
      {!picks.length ? <p className="text-sm muted">Engin gögn um leikmenn enn á þessu tímabili.</p> : (
        <div className="card overflow-hidden">
          <ol className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {picks.map((p, i) => row(p, i, i >= PHONE_ROWS ? 'hidden sm:block' : ''))}
          </ol>
          {rest.length > 0 && (
            <details className="sm:hidden border-t" style={{ borderColor: 'var(--border)' }}>
              <summary className="px-4 min-h-[44px] flex items-center text-sm font-semibold cursor-pointer" style={{ color: 'var(--accent)' }}>Sýna {rest.length} í viðbót</summary>
              <ol className="divide-y border-t" style={{ borderColor: 'var(--border)' }}>{rest.map((p, i) => row(p, i + PHONE_ROWS))}</ol>
            </details>
          )}
        </div>
      )}
      {note && <p className="text-xs muted">{note}</p>}
    </section>
  )
}
