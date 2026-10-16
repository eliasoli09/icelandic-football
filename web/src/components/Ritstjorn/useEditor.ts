'use client'

import { useEffect, useState } from 'react'
import { browserDb, whoAmI, type Me } from '@/lib/leaderboard/store'
import { amEditor } from '@/lib/nfl/articles/editorStore'

/** Who is at the desk: not signed in, signed in but not an editor, or an editor. */
export function useEditor(): { ready: boolean; me: Me | null; editor: boolean } {
  const [state, setState] = useState<{ ready: boolean; me: Me | null; editor: boolean }>({ ready: false, me: null, editor: false })
  useEffect(() => {
    let alive = true
    const check = async () => {
      const me = await whoAmI().catch(() => null)
      const editor = me ? await amEditor().catch(() => false) : false
      if (alive) setState({ ready: true, me, editor })
    }
    void check()
    const { data } = browserDb().auth.onAuthStateChange(() => { void check() })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return state
}
