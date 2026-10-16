'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Trophy } from 'lucide-react'
import { SignIn } from '@/components/Leaderboard/SignIn'
import { browserDb, whoAmI, type Me } from '@/lib/leaderboard/store'
import { MODEL_ID, lastGameOf, modelPicks, seasonBoard, weekBoard, type Tiebreak, type UserPick } from '@/lib/nfl/pickem'
import { flushPicks, joinLeague, takeInvite, loadPicks, loadTiebreaks, myLeagues, namesOf, queuePick, queuedPicks, savePick, saveTiebreak, type League } from '@/lib/nfl/pickStore'
import { weekLabel, weekTypes } from '@/lib/nfl/week'
import { isPlayed, type NflGame, type NflTeam } from '@/lib/nfl/types'
import { PickRow } from './PickRow'
import { PickBoards } from './PickBoards'
import { PickLeagues } from './PickLeagues'

type Note = { kind: 'good' | 'bad'; text: string } | null

export function PickemView({ season, games, teams, pHome, initialWeek, hero }: {
  season: number; games: NflGame[]; teams: NflTeam[]; pHome: Record<string, number>; initialWeek: number; hero: string | null
}) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const weeks = useMemo(() => weekTypes(games), [games])
  const [week, setWeek] = useState(initialWeek)
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [picks, setPicks] = useState<UserPick[]>([])
  const [local, setLocal] = useState<Record<string, string>>({})
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [leagues, setLeagues] = useState<League[]>([])
  const [note, setNote] = useState<Note>(null)
  const [league, setLeague] = useState<string>('all')
  const [now, setNow] = useState(() => Date.now())

  // locks follow the clock: re-check every half minute while the page is open
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const started = useCallback((g: NflGame) => isPlayed(g) || new Date(g.kickoff).getTime() <= now, [now])

  const reload = useCallback(async (who: Me | null) => {
    const [p, t, l] = await Promise.all([loadPicks(games.map((g) => g.game_id)), loadTiebreaks(season), who?.name ? myLeagues() : Promise.resolve([])])
    setPicks(p); setTiebreaks(t); setLeagues(l)
    const ids = [...new Set([...p.map((x) => x.player), ...t.map((x) => x.player), ...l.flatMap((x) => x.members)])]
    setNames(await namesOf(ids))
  }, [games, season])

  const signedIn = useCallback(async () => {
    const who = await whoAmI().catch(() => null)
    setMe(who)
    if (who?.name) {
      const saved = await flushPicks(who.id)
      setLocal({})
      if (saved) setNote({ kind: 'good', text: `${saved} ${saved === 1 ? 'spá vistaðist' : 'spár vistuðust'} af þessu tæki.` })
      const invite = takeInvite()
      if (invite) {
        const joined = await joinLeague(invite)
        if (joined.ok) { setLeague(joined.id); setNote({ kind: 'good', text: `Þú ert kominn í ${joined.name}.` }) }
        else setNote({ kind: 'bad', text: joined.message })
      }
    } else setLocal(queuedPicks())
    await reload(who)
    setReady(true)
  }, [reload])

  useEffect(() => {
    void signedIn()
    const { data } = browserDb().auth.onAuthStateChange(() => { void signedIn() })
    return () => data.subscription.unsubscribe()
  }, [signedIn])

  // ?vika= and ?deild= from a shared link or the invite page
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const v = Number(q.get('vika'))
    if (weeks.some(([w]) => w === v)) setWeek(v)
    const d = q.get('deild')
    if (d) setLeague(d)
  }, [weeks])

  const mine = useMemo(() => {
    const out: Record<string, string> = { ...local }
    if (me) for (const p of picks) if (p.player === me.id) out[p.game_id] = p.pick
    return out
  }, [picks, local, me])

  const choose = async (g: NflGame, team: string) => {
    if (started(g)) return
    setNote(null)
    if (!me?.name) {
      queuePick(g.game_id, team)
      setLocal(queuedPicks())
      return
    }
    // show it at once; put it back if the database says no
    const before = picks
    setPicks([...picks.filter((p) => !(p.player === me.id && p.game_id === g.game_id)), { player: me.id, game_id: g.game_id, pick: team }])
    const out = await savePick(me.id, g.game_id, team)
    if (out !== 'saved') {
      setPicks(before)
      setNote({ kind: 'bad', text: out === 'locked' ? 'Leikurinn er hafinn, spáin læstist.' : 'Spáin vistaðist ekki. Reyndu aftur.' })
      void reload(me)
    }
  }

  const round = useMemo(() => games.filter((g) => g.week === week).sort((a, b) => a.kickoff.localeCompare(b.kickoff)), [games, week])
  const model = useMemo(() => modelPicks(games, new Map(Object.entries(pHome))), [games, pHome])
  // everyone's picks and the model's, for games under way or over
  const visible = useMemo(() => {
    const open = new Set(games.filter((g) => !started(g)).map((g) => g.game_id))
    return [...picks, ...model.filter((p) => !open.has(p.game_id))]
  }, [picks, model, games, started])

  const idx = weeks.findIndex(([w]) => w === week)
  const type = weeks[idx]?.[1] ?? 'REG'
  const last = lastGameOf(games, season, week)
  const myTiebreak = me ? tiebreaks.find((t) => t.player === me.id && t.week === week)?.total ?? null : null
  const openCount = round.filter((g) => !started(g)).length
  const pickedCount = round.filter((g) => !started(g) && mine[g.game_id]).length

  const board = useMemo(() => {
    const keep = league === 'all' ? null : new Set(leagues.find((l) => l.id === league)?.members ?? [])
    const filter = <T extends { id: string }>(rows: T[]) => (keep ? rows.filter((r) => r.id === MODEL_ID || keep.has(r.id)) : rows)
    return {
      week: filter(weekBoard(games, visible, tiebreaks, names, season, week)),
      season: filter(seasonBoard(games, visible, names, season)),
    }
  }, [games, visible, tiebreaks, names, season, week, league, leagues])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element -- one local banner
        <img src={hero} alt="" className="w-full h-36 sm:h-52 object-cover rounded-2xl" />
      )}

      <header className="grid gap-2">
        <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><Trophy size={13} aria-hidden /> SPÁLEIKUR</p>
        <h2 className="display text-3xl font-extrabold tracking-tight">Hver vinnur?</h2>
        <p className="muted text-sm max-w-prose">
          Veldu sigurvegara í hverjum leik. Réttur sigurvegari gefur stig, og spáin læsist þegar leikurinn hefst.
          Líkanið keppir líka: getur þú gert betur en Elo?
        </p>
      </header>

      {ready && !me?.name && (
        <p className="text-sm">
          <a href="#innskraning" className="font-semibold underline decoration-dotted underline-offset-2">Skráðu þig inn</a> til að vista spárnar og komast á töfluna. Það sem þú velur bíður á meðan, í þessu tæki.
        </p>
      )}

      {note && <p className="text-sm font-semibold" role="status" style={{ color: note.kind === 'good' ? 'var(--win)' : 'var(--loss)' }}>{note.text}</p>}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex items-center justify-between gap-3">
          <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
            disabled={idx <= 0} onClick={() => setWeek(weeks[idx - 1][0])} aria-label="Fyrri umferð">
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="text-center">
            <p className="display text-2xl font-extrabold">{weekLabel(type, week)}</p>
            <p className="text-xs muted">{openCount ? `${pickedCount} af ${openCount} opnum leikjum valdir` : 'Allir leikir umferðarinnar eru hafnir'}</p>
          </div>
          <button className="w-11 h-11 rounded-full border inline-flex items-center justify-center disabled:opacity-30" style={{ borderColor: 'var(--border)' }}
            disabled={idx < 0 || idx >= weeks.length - 1} onClick={() => setWeek(weeks[idx + 1][0])} aria-label="Næsta umferð">
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {round.map((g) => (
            <PickRow key={g.game_id} g={g} home={byAbbr.get(g.home)} away={byAbbr.get(g.away)} pick={mine[g.game_id] ?? null}
              locked={started(g)} picks={visible.filter((p) => p.game_id === g.game_id && p.player !== MODEL_ID)}
              model={started(g) ? model.find((p) => p.game_id === g.game_id)?.pick ?? null : null}
              onPick={(team) => void choose(g, team)} />
          ))}
        </div>

        {last && me?.name && (
          <Tiebreaker key={`${week}:${myTiebreak}`} last={last} value={myTiebreak} locked={started(last)}
            onSave={async (total) => {
              const out = await saveTiebreak(me.id, season, week, total)
              setNote(out === 'saved' ? { kind: 'good', text: 'Bráðabaninn vistaðist.' } : { kind: 'bad', text: out === 'locked' ? 'Síðasti leikurinn er hafinn, bráðabaninn læstist.' : 'Bráðabaninn vistaðist ekki.' })
              void reload(me)
            }} />
        )}
      </section>

      {ready && !me?.name && (
        <div id="innskraning" className="scroll-mt-20">
          <SignIn me={me} onDone={() => { void signedIn() }} />
        </div>
      )}

      <PickBoards board={board} me={me?.id ?? null} weekName={weekLabel(type, week)} leagues={leagues} league={league} onLeague={setLeague} />

      {me?.name && <PickLeagues me={me} leagues={leagues} names={names} onChanged={(text, select) => {
        setNote(text ? { kind: 'good', text } : null)
        if (select) setLeague(select)
        void reload(me)
      }} onError={(text) => setNote({ kind: 'bad', text })} />}

      <p className="text-[11px] muted">
        Stig: 1 fyrir réttan sigurvegara, ½ fyrir jafntefli. Innan umferðar sker bráðabaninn úr: sá sem er næst heildarstigum í síðasta leiknum.
        Spár annarra sjást þegar leikurinn hefst. Líkanið velur alltaf liðið sem það telur sigurstranglegra.
      </p>
    </div>
  )
}

function Tiebreaker({ last, value, locked, onSave }: { last: NflGame; value: number | null; locked: boolean; onSave: (total: number) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const total = Number(text)
  const valid = text !== '' && Number.isInteger(total) && total >= 0 && total <= 150
  return (
    <form className="card p-4 grid gap-2" onSubmit={(e) => { e.preventDefault(); if (valid && !locked) onSave(total) }}>
      <label htmlFor="tiebreak" className="text-sm font-semibold">Bráðabani: heildarstig í {last.away} @ {last.home}</label>
      <div className="flex items-center gap-2">
        <input id="tiebreak" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, ''))} disabled={locked}
          className="w-24 min-h-[40px] rounded-lg border px-3 num" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} placeholder="t.d. 44" />
        {locked
          ? <span className="text-xs muted inline-flex items-center gap-1"><Lock size={12} aria-hidden /> Læst</span>
          : <button className="rounded-full px-4 min-h-[40px] font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} disabled={!valid}>Vista</button>}
      </div>
    </form>
  )
}
