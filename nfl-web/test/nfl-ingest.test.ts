import { describe, it, expect } from 'vitest'
import { ingestWarnings } from '../src/lib/nfl/ingest'
import type { NflGame } from '../src/lib/nfl/types'

const g = (id: string, kickoff: string, scored: boolean, home = 'A', away = 'B') =>
  ({ game_id: id, game_type: 'REG', kickoff, home, away, home_score: scored ? 1 : null, away_score: scored ? 0 : null }) as NflGame

describe('ingestWarnings', () => {
  const now = new Date('2026-10-14T12:00:00Z')
  it('varar við leik án úrslita 18 klst eftir upphaf', () => {
    const w = ingestWarnings([g('x', '2026-10-13T17:00:00Z', false), g('y', '2026-10-14T00:00:00Z', false)], now, 2)
    expect(w).toEqual(['x: engin úrslit 19 klst eftir upphaf'])
  })
  it('varar ef liðafjöldi tímabilsins er rangur', () => {
    expect(ingestWarnings([g('x', '2026-10-20T17:00:00Z', false)], now)).toEqual(['tímabilið hefur 2 lið, ekki 32'])
  })
})
