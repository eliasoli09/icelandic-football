'use client'

import { useState, type FormEvent } from 'react'
import { cleanName, nameProblem } from '@/lib/leaderboard/rank'
import { claimName, flushQueue, signIn, signUp, whoAmI, type Me } from '@/lib/leaderboard/store'
import styles from './Leaderboard.module.css'

/**
 * Sign in or sign up with an e-mail, and choose the name the boards show.
 * Shared by /stigatafla and the NFL pick'em; the same account counts in both.
 */
export function SignIn({ me, onDone }: { me: Me | null; onDone: (text: string | null) => void }) {
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
