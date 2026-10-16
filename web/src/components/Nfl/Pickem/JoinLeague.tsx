'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { SignIn } from '@/components/Leaderboard/SignIn'
import { browserDb, whoAmI, type Me } from '@/lib/leaderboard/store'
import { joinLeague } from '@/lib/nfl/pickStore'

/** A league stays closed until you are in it, so its name shows only once you have joined. */
export function JoinLeague({ code }: { code: string }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attempt = useCallback(async () => {
    const who = await whoAmI().catch(() => null)
    setMe(who); setReady(true)
    if (!who?.name) return
    const out = await joinLeague(code)
    if (out.ok) router.replace(`/nfl/spa?deild=${out.id}`)
    else setError(out.message)
  }, [code, router])

  useEffect(() => {
    void attempt()
    const { data } = browserDb().auth.onAuthStateChange(() => { void attempt() })
    return () => data.subscription.unsubscribe()
  }, [attempt])

  return (
    <div className="grid gap-5 max-w-xl">
      <header className="grid gap-2">
        <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><Users size={13} aria-hidden /> SPÁLEIKUR</p>
        <h2 className="display text-3xl font-extrabold tracking-tight">Þér er boðið í deild</h2>
        <p className="muted text-sm">Skráðu þig inn eða búðu til aðgang, og þá ertu kominn í deildina. Þú spáir í sigurvegara hverrar viku í NFL og keppir við hina í deildinni.</p>
      </header>
      {error && <p className="text-sm font-semibold" role="alert" style={{ color: 'var(--loss)' }}>{error}</p>}
      {ready && !me?.name && !error && <SignIn me={me} onDone={() => { void attempt() }} />}
      {ready && me?.name && !error && <p className="muted text-sm">Augnablik, þú ert að komast inn ...</p>}
    </div>
  )
}
