import Link from 'next/link'
import { Bomb, Flame, Footprints, Hand, Send, Shield, Sigma, Target, Trophy, Zap } from 'lucide-react'
import { NflLogo } from '@/components/Nfl/NflLogo'
import { PlayerHead } from '@/components/Nfl/PlayerHead'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { probLabel } from '@/lib/nfl/format'
import { availability, STATUS_LABEL } from '@/lib/nfl/injuries'
import { nflCurrentSeason, nflInjuries, nflSeasonModel, nflVedmalData, type InjuryList } from '@/lib/nfl/queries'
import { clock, dayLabel, isSmallHours } from '@/lib/nfl/time'
import type { NflTeam } from '@/lib/nfl/types'
import type { Slip } from '@/lib/nfl/vedmal'
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
const n0 = (x: number) => String(Math.round(x))
const n1 = (x: number) => x.toFixed(1).replace('.', ',').replace(',0', '')
const last3 = (p: PlayerPick, f: (x: number) => string) => p.basis.recent.length ? ` · síðustu ${p.basis.recent.length}: ${p.basis.recent.map(f).join(', ')}` : ''
/** "Meðaltal 88 · síðustu 3: 102, 75, 91 · LAC gefur 131 í leik (deild 117)" */
const basisLine = (f: (x: number) => string, opp: (p: PlayerPick, x: string, lg: string) => string) => (p: PlayerPick) =>
  `Meðaltal ${f(p.basis.avg)}${last3(p, f)}${p.basis.opp !== null && p.basis.league !== null ? ` · ${opp(p, f(p.basis.opp), f(p.basis.league))}` : ''}`
const gives = (what: string) => (p: PlayerPick, x: string, lg: string) => `${p.opp} gefur ${x} ${what} í leik (deild ${lg})`
const MARKET_VIEW: Record<string, { icon: typeof Target; fmt: (v: number) => string; basis: (p: PlayerPick) => string }> = {
  pass: { icon: Send, fmt: n0, basis: basisLine(n0, gives('sendingajarda')) },
  rec: { icon: Hand, fmt: n0, basis: basisLine(n0, gives('gripjarda')) },
  catches: { icon: Hand, fmt: n1, basis: basisLine(n1, gives('grip')) },
  sacks: { icon: Shield, fmt: (v) => probLabel(v), basis: basisLine(n1, (p, x, lg) => `${p.opp} fær á sig ${x} fellur í leik (deild ${lg})`) },
  ints: { icon: Shield, fmt: (v) => probLabel(v), basis: basisLine(n1, gives('hleranir')) },
}

export default async function VedmalPage() {
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

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-3xl font-extrabold">Veðmálin</h1>
          <span className="rounded-full border px-2 py-0.5 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>18+</span>
        </div>
        <p className="muted text-sm">{weekLabel(view.type, view.week)} · {view.games.length} {view.games.length === 1 ? 'leikur' : 'leikir'} eftir · uppfært á 5 mínútna fresti</p>
        {inj.week !== view.week && <p className="text-xs muted">Meiðslaskýrsla vikunnar er ekki komin; aðeins leikmenn á meiðslalista eru teknir út. <Link href="/leikmenn/meidsli" className="underline">Meiðslalistinn</Link></p>}
      </header>

      <section className="grid gap-3 content-start" aria-label="Seðlar vikunnar">
        <h2 className="display text-xl font-extrabold">Seðlar vikunnar</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {view.slips.map((s) => <SlipCard key={s.key} k={s.key} name={s.name} target={s.target} slip={s.slip} team={team} />)}
        </div>
        <p className="text-xs muted max-w-prose">
          Hver seðill er sá líklegasti sem nær stuðlinum (mest 15% yfir), einn sigurvegari úr leik. Líkurnar eru líkur veðbankanna eftir að álag þeirra er dregið frá.
          Elo-líkanið okkar fékk að velja í prófun á {B.test[0]}-{B.test[1]} og gerði það verr: seðlarnir þess sögðust ganga upp í {probLabel(B.slipsModelOnly.double.modelP)} tilvika (Double Trouble) en gerðu það í {probLabel(B.slipsModelOnly.double.hitRate)}.
          Líkanið velur einmitt leikina þar sem það er ósammála markaðnum, og þar hefur markaðurinn oftast rétt fyrir sér.
        </p>
      </section>

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
              </article>
            ))}
          </div>
          <p className="text-xs muted max-w-prose">
            Líklegustu snertimarksskorararnir, einn úr hverjum leik. Stuðullinn er okkar eigin, reiknaður beint úr líkunum án álags.
            Veðbankar borga yfirleitt minna fyrir snertimörk; ef þeirra stuðull er hærri en þessi er það veðmál með virði samkvæmt líkaninu.
          </p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <PlayerList icon={Target} title="Líklegustu snertimarksskorararnir" unit="líkur á snertimarki" picks={view.scorers} fmt={(v) => probLabel(v)} team={team} basis={(p) => `${p.basis.note ?? ''}${last3(p, n0)}`}
          note={`Hlaup eða grip. Prófað á ${B.test[0]}-${B.test[1]}: þeir sem fengu 50-60% skoruðu í ${probLabel(B.td.test.buckets[5].scored)} tilvika, 30-40% í ${probLabel(B.td.test.buckets[3].scored)}. Aðeins leikmenn sem spiluðu síðasta leik liðsins; þeir sem eru frá eða ólíklegir samkvæmt meiðslaskýrslunni eru teknir út.`} />
        <PlayerList icon={Footprints} title="Hlaupamestir" unit="spáðir hlaupajardar" picks={view.rushers} fmt={n0} team={team} basis={basisLine(n0, gives('hlaupajarda'))}
          note={`Meðaltal leikmannsins á tímabilinu, leiðrétt eftir því hve mikið mótherjinn gefur eftir. Skeikar að jafnaði um ${Math.round(B.rush.test.mae)} jarda í leik.`} />
        {view.markets.map((m) => {
          const mv = MARKET_VIEW[m.key]
          const test = m.test.metric === 'mae'
            ? `Skeikar að jafnaði um ${n1(m.test.score)} á ${B.test[0]}-${B.test[1]}, meðaltal tímabilsins eitt um ${n1(m.test.naive)}.`
            : `Prófað á ${B.test[0]}-${B.test[1]}: betra en meðaltal tímabilsins og betra en að gefa öllum sömu líkur.`
          return <PlayerList key={m.key} icon={mv.icon} title={m.title} unit={m.unit} picks={m.picks} fmt={mv.fmt} team={team} basis={mv.basis} note={m.key === 'pass' ? `${test} Hleranir eru ekki með: þar gerði spáin ekki betur en að gefa öllum sömu líkur.` : test} />
        })}

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
          <p className="text-xs muted">
            Heildarstig veðbankanna og hvernig þau skiptast. Okkar eigin spá úr sókn og vörn liðanna skeikaði um {dec(B.totals.test.mae, 1)} stig að jafnaði á {B.test[0]}-{B.test[1]}, lína Vegas um {dec(B.totals.test.maeVegas, 1)}, svo lína Vegas ræður.
          </p>
        </section>

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
          <p className="text-xs muted">Líkur veðbankanna á sigri, álagið dregið frá. Elo-líkanið okkar stendur við hliðina.</p>
        </section>
      </div>

      <aside className="card p-4 grid gap-1.5 text-sm" style={{ borderColor: 'var(--border)' }}>
        <p className="font-semibold">Líkur, ekki loforð</p>
        <p className="muted text-xs max-w-prose">
          Þessi síða er til fróðleiks og skemmtunar og er ekki á vegum neins veðbanka. Veðmál eru aðeins fyrir 18 ára og eldri. Leggðu aldrei undir meira en þú
          mátt missa. Ef spilamennskan er farin að valda vanda getur þú talað við Hjálparsíma Rauða krossins í síma 1717, allan sólarhringinn.
        </p>
      </aside>
    </div>
  )
}

function SlipCard({ k, name, target, slip, team }: { k: string; name: string; target: number; slip: Slip | null; team: Map<string, NflTeam> }) {
  const Icon = SLIP_ICON[k as keyof typeof SLIP_ICON]
  const past = BACKTEST.slips[k as keyof typeof BACKTEST.slips]
  return (
    <article className="card p-4 grid gap-3 content-start">
      <header className="flex items-center justify-between gap-2">
        <span className="display text-lg font-extrabold inline-flex items-center gap-2"><Icon size={18} aria-hidden style={{ color: 'var(--accent)' }} /> {name}</span>
        <span className="text-xs muted">stuðull um {dec(target, 1)}</span>
      </header>
      {!slip ? <p className="text-sm muted">Enginn seðill nær þessum stuðli úr leikjunum sem eftir eru.</p> : (
        <>
          <ul className="grid gap-2">
            {slip.legs.map((l) => (
              <li key={l.game_id}>
                <Link href={`/leikur/${l.game_id}`} className="trow rounded-lg grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2 py-1.5 -mx-2">
                  <NflLogo team={team.get(l.team)} size={28} />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{team.get(l.team)?.name ?? l.team} vinnur</span>
                    <span className="block text-xs muted truncate">{l.home ? 'gegn' : 'á útivelli gegn'} {l.opp} · {when(l.kickoff)}</span>
                  </span>
                  <span className="num font-semibold">{dec(l.odds)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-end justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <span>
              <span className="block text-[11px] muted">Líkur</span>
              <span className="num font-bold text-lg">{probLabel(slip.p)}</span>
            </span>
            <span className="text-right">
              <span className="block text-[11px] muted">Heildarstuðull</span>
              <span className="num font-extrabold text-2xl" style={{ color: 'var(--accent)' }}>{dec(slip.odds)}</span>
            </span>
          </div>
        </>
      )}
      <p className="text-[11px] muted">
        Ferill {BACKTEST.slipSeasons[0]}-{BACKTEST.slipSeasons[1]}: gekk upp {past.hits} af {past.weeks} vikum ({probLabel(past.hitRate)}).
        1.000 kr. á hverja viku: {kr(1000 * past.weeks)} lagðar undir, {kr(1000 * past.weeks * (1 + past.roi))} til baka
      </p>
    </article>
  )
}

function PlayerList({ icon: Icon, title, unit, picks, fmt, team, note, basis }: { icon: typeof Target; title: string; unit: string; picks: PlayerPick[]; fmt: (v: number) => string; team: Map<string, NflTeam>; note: string; basis: (p: PlayerPick) => string }) {
  return (
    <section className="grid gap-3 content-start" aria-label={title}>
      <h2 className="display text-xl font-extrabold inline-flex items-center gap-2"><Icon size={18} aria-hidden /> {title}</h2>
      {!picks.length ? <p className="text-sm muted">Engin gögn um leikmenn enn á þessu tímabili.</p> : (
        <ol className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {picks.map((p, i) => (
            <li key={p.player_id}>
              <Link href={`/leikmadur/${p.player_id}`} className="trow grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-2.5">
                <span className="text-xs muted num pt-2">{i + 1}</span>
                <PlayerHead name={p.name} src={p.headshot} color={team.get(p.team)?.color} size={32} />
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{p.name}{p.status && <span className="ml-1.5 rounded px-1 py-px text-[10px] font-bold align-middle" style={{ background: 'color-mix(in srgb, var(--loss) 18%, transparent)', color: 'var(--loss)' }}>{STATUS_LABEL[p.status].toUpperCase()}</span>}</span>
                  <span className="block text-xs muted truncate">{p.position ?? ''} · {p.team} gegn {p.opp}</span>
                  <span className="block text-[11px] muted">{basis(p)}</span>
                </span>
                <span className="num font-bold" style={{ color: 'var(--accent)' }} title={unit}>{fmt(p.value)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs muted">{note}</p>
    </section>
  )
}
