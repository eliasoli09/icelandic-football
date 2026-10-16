'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trophy } from 'lucide-react'
import { GAME_LABEL, MIN_GAMES, cleanName, nameProblem, rank, type Row, type Sort } from '@/lib/leaderboard/rank'
import { claimName, flushQueue, loadBoard, queueLength, signOut, whoAmI, type Me } from '@/lib/leaderboard/store'
import { SignIn } from './SignIn'
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
