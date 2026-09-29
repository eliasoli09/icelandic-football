'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trophy } from 'lucide-react'
import { GAME_LABEL, MIN_GAMES, cleanName, nameProblem, rank, type Row, type Sort } from '@/lib/leaderboard/rank'
import { claimName, flushQueue, loadBoard, queueLength, signIn, signOut, signUp, whoAmI, type Me } from '@/lib/leaderboard/store'
import { browserDb } from '@/lib/leaderboard/store'
import styles from './Leaderboard.module.css'

export function LeaderboardView() {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [sort, setSort] = useState<Sort>('won')
  const [waiting, setWaiting] = useState(0)
  const [note, setNote] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setRows(await loadBoard())
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const who = await whoAmI().catch(() => null)
      if (!alive) return
      setMe(who); setWaiting(queueLength()); setReady(true)
      await refresh()
      // anything played before signing in is recorded as soon as there is a name
      if (who?.name) {
        const saved = await flushQueue(who.id)
        if (alive && saved) { setWaiting(0); setNote({ kind: 'good', text: `${saved} ${saved === 1 ? 'úrslit komin' : 'úrslit komin'} á töfluna af þessu tæki.` }); await refresh() }
      }
    })()
    const { data } = browserDb().auth.onAuthStateChange(() => {
      void (async () => { const who = await whoAmI().catch(() => null); if (alive) { setMe(who); await refresh() } })()
    })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [refresh])

  const ranked = rank(rows, sort)
  const mine = me ? rows.find((r) => r.id === me.id) : undefined

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <p className={styles.kicker}><Trophy size={13} aria-hidden /> STIGATAFLA</p>
        <h1>Hver kann mest?</h1>
        <p>Þrautir Besta spáin telja: {Object.values(GAME_LABEL).join(', ')}. Hver þraut telur einu sinni, svo hvorki hlutfall né sigrar hækka við að spila sömu þrautina aftur.</p>
      </header>

      {ready && (me?.name
        ? <Signed me={me} mine={mine} waiting={waiting} onChanged={(text) => { setNote({ kind: 'good', text }); void refresh() }} onOut={() => { setMe(null); void refresh() }} />
        : <SignIn me={me} onDone={(text) => setNote(text ? { kind: 'good', text } : null)} />)}

      {note && <p className={`${styles.message} ${note.kind === 'good' ? styles.good : styles.bad}`} role="status">{note.text}</p>}

      <section className={styles.panel} aria-label="Stigatafla">
        <div className={styles.boardHead}>
          <h2>Taflan</h2>
          <div role="group" aria-label="Röðun" className={styles.sorts}>
            <button className={styles.sort} aria-pressed={sort === 'won'} onClick={() => setSort('won')}>Flestir sigrar</button>
            <button className={styles.sort} aria-pressed={sort === 'pct'} onClick={() => setSort('pct')}>Besta hlutfall</button>
          </div>
        </div>
        {ranked.length === 0
          ? <p className={styles.empty}>{sort === 'pct' ? `Enginn hefur lokið ${MIN_GAMES} þrautum ennþá.` : 'Enginn er kominn á töfluna ennþá. Vertu fyrst(ur).'}</p>
          : <table className={styles.table}>
              <thead>
                <tr><th className={styles.place}>#</th><th>Nafn</th><th>Sigrar</th><th className={styles.hideSmall}>Þrautir</th><th>Hlutfall</th></tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.id} className={me && r.id === me.id ? styles.me : undefined}>
                    <td className={styles.place}>{i + 1}</td>
                    <td className={styles.name}>{r.name}</td>
                    <td>{r.won}</td>
                    <td className={styles.hideSmall}>{r.played}</td>
                    <td className={styles.pct}>{r.winPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>}
        <p className={styles.note}>Hlutfallstaflan sýnir þá sem hafa lokið minnst {MIN_GAMES} þrautum. Sigur er þraut sem kláraðist: allir tíu í Tenaball, rétt nafn í Hver er maðurinn, allir ellefu í Byrjunarliðinu og bikarinn sjálfur í Bikarmeistara.</p>
      </section>
    </div>
  )
}

function SignIn({ me, onDone }: { me: Me | null; onDone: (text: string | null) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // signed in but without a name yet: only the name is missing
  if (me && !me.name) return <ChooseName me={me} onDone={onDone} />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === 'up') {
      const problem = nameProblem(name)
      if (problem) { setError(problem); return }
    }
    setBusy(true)
    const out = mode === 'up' ? await signUp(email.trim(), password) : await signIn(email.trim(), password)
    setBusy(false)
    if (!out.ok) { setError(out.message); return }
    if (out.needsEmail) { setSent(true); try { localStorage.setItem('stigatafla:nafn', cleanName(name)) } catch { /* typed again */ } return }
    const who = await whoAmI()
    if (who && mode === 'up') await claimName(who.id, cleanName(name))
    onDone(null)
  }

  if (sent) return (
    <section className={styles.panel}>
      <h2>Staðfestu netfangið</h2>
      <p>Við sendum þér póst. Smelltu á hlekkinn í honum og þá ertu kominn inn - nafnið bíður á meðan.</p>
    </section>
  )

  return (
    <section className={styles.panel} aria-label="Skráning">
      <h2>{mode === 'up' ? 'Búðu til aðgang' : 'Skráðu þig inn'}</h2>
      <p>{mode === 'up' ? 'Nafnið þitt birtist á töflunni. Netfangið sést engum öðrum.' : 'Sama tæki eða annað - úrslitin þín fylgja aðgangnum.'}</p>
      <form className={styles.form} onSubmit={submit}>
        {mode === 'up' && (
          <div className={styles.field}>
            <label htmlFor="lb-name">Nafn á töflunni</label>
            <input id="lb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" required />
          </div>
        )}
        <div className={styles.field}>
          <label htmlFor="lb-email">Netfang</label>
          <input id="lb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="lb-password">Lykilorð</label>
          <input id="lb-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required />
        </div>
        <div className={styles.row}>
          <button className={styles.primary} type="submit" disabled={busy}>{mode === 'up' ? 'Stofna aðgang' : 'Skrá mig inn'}</button>
          <button type="button" className={styles.switch} onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setError(null) }}>
            {mode === 'up' ? 'Ég á aðgang' : 'Ég er ekki með aðgang'}
          </button>
        </div>
      </form>
      {error && <p className={`${styles.message} ${styles.bad}`} role="alert">{error}</p>}
    </section>
  )
}

function ChooseName({ me, onDone }: { me: Me; onDone: (text: string) => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('stigatafla:nafn') ?? '' } catch { return '' } })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problem = nameProblem(name)
    if (problem) { setError(problem); return }
    setBusy(true)
    const out = await claimName(me.id, cleanName(name))
    setBusy(false)
    if (!out.ok) { setError(out.message); return }
    const saved = await flushQueue(me.id)
    onDone(saved ? `Velkomin(n)! ${saved} úrslit af þessu tæki fylgdu með.` : 'Velkomin(n) á töfluna.')
  }
  return (
    <section className={styles.panel} aria-label="Veldu nafn">
      <h2>Veldu nafn</h2>
      <p>Þetta nafn birtist á stigatöflunni.</p>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="lb-newname">Nafn</label>
          <input id="lb-newname" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" required />
        </div>
        <div className={styles.row}><button className={styles.primary} disabled={busy}>Vista nafn</button></div>
      </form>
      {error && <p className={`${styles.message} ${styles.bad}`} role="alert">{error}</p>}
    </section>
  )
}

function Signed({ me, mine, waiting, onChanged, onOut }: {
  me: Me; mine: Row | undefined; waiting: number; onChanged: (text: string) => void; onOut: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    const problem = nameProblem(name)
    if (problem) { setError(problem); return }
    const out = await claimName(me.id, cleanName(name))
    if (!out.ok) { setError(out.message); return }
    setEditing(false); onChanged('Nafnið uppfært.')
  }
  return (
    <section className={styles.panel} aria-label="Þinn aðgangur">
      <h2>{me.name}</h2>
      <p>{mine ? `${mine.won} sigrar af ${mine.played} þrautum - ${mine.winPct}% hlutfall.` : 'Engin þraut komin á töfluna ennþá. Spilaðu eina og hún birtist hér.'}
        {waiting > 0 ? ` ${waiting} úrslit bíða á þessu tæki.` : ''}</p>
      {editing
        ? <form className={styles.form} onSubmit={save}>
            <div className={styles.field}>
              <label htmlFor="lb-rename">Nýtt nafn</label>
              <input id="lb-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
            </div>
            <div className={styles.row}>
              <button className={styles.primary}>Vista</button>
              <button type="button" className={styles.ghost} onClick={() => { setEditing(false); setName(me.name ?? '') }}>Hætta við</button>
            </div>
          </form>
        : <div className={styles.row}>
            <button className={styles.ghost} onClick={() => setEditing(true)}>Breyta nafni</button>
            <button className={styles.ghost} onClick={async () => { await signOut(); onOut() }}>Skrá út</button>
          </div>}
      {error && <p className={`${styles.message} ${styles.bad}`} role="alert">{error}</p>}
    </section>
  )
}
