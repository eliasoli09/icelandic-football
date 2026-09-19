'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { queueResult, record, whoAmI } from '@/lib/leaderboard/store'
import type { Result } from '@/lib/leaderboard/rank'

type State = 'saved' | 'already' | 'waiting' | 'failed'

/**
 * One attempt per finished puzzle, shared by everything that asks for it. A
 * component that mounts twice - as React does in development, and as a game
 * does when it redraws - waits on the same promise instead of recording twice.
 */
const inFlight = new Map<string, Promise<State>>()

function save(key: string, result: Result): Promise<State> {
  const running = inFlight.get(key)
  if (running) return running
  const started = (async (): Promise<State> => {
    const me = await whoAmI().catch(() => null)
    if (!me?.name) { queueResult(result); return 'waiting' }
    const how = await record(me.id, result)
    return how === 'failed' ? 'failed' : how === 'already' ? 'already' : 'saved'
  })()
  inFlight.set(key, started)
  return started
}

/**
 * Records a finished puzzle for whoever is signed in, and says plainly what
 * happened. It inherits the colours around it, so each game keeps its own look.
 */
export function SaveResult({ result, className = '' }: { result: Result | null; className?: string }) {
  const [state, setState] = useState<State | null>(null)
  const latest = useRef(result)
  latest.current = result
  const key = result ? `${result.game}:${result.puzzle}:${result.won}` : ''

  useEffect(() => {
    if (!key) { setState(null); return }
    let alive = true
    void save(key, latest.current!).then((next) => { if (alive) setState(next) })
    return () => { alive = false }
  }, [key])

  if (!result || !state) return null
  const line = state === 'saved' ? 'Vistað á stigatöfluna.'
    : state === 'already' ? 'Þessi þraut er þegar komin á stigatöfluna.'
    : state === 'waiting' ? 'Úrslitin bíða á þessu tæki.'
    : 'Náði ekki að vista - úrslitin bíða á þessu tæki.'
  return (
    <p className={className} style={{ fontSize: 12, opacity: .85, margin: '10px 0 0' }} role="status">
      {line}{' '}
      <Link href="/stigatafla" style={{ textDecoration: 'underline' }}>
        {state === 'saved' || state === 'already' ? 'Sjá stigatöfluna' : 'Skráðu þig og náðu í þau'}
      </Link>
    </p>
  )
}
