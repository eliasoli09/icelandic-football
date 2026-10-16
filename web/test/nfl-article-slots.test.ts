import { describe, it, expect } from 'vitest'
import { dueSlots, slugify } from '../src/lib/nfl/articles/slots'

const g = (week: number, away: string, home: string, kickoff: string, played: boolean) => ({
  game_id: `2026_${week}_${away}_${home}`, season: 2026, week, kickoff, away, home,
  home_score: played ? 20 : null, away_score: played ? 17 : null,
})

describe('dueSlots', () => {
  const games = [
    g(6, 'SEA', 'DEN', '2026-10-17T00:15:00Z', true),
    g(6, 'HOU', 'JAX', '2026-10-18T13:30:00Z', false),
    g(7, 'KC', 'LV', '2026-10-23T00:15:00Z', false),
  ]
  it('upphitun þremur dögum fyrir fyrsta leik umferðar, umfjöllun eftir spilaðan leik', () => {
    const slots = dueSlots(games, new Date('2026-10-20T08:00:00Z'))
    expect(slots.map((s) => s.slug).sort()).toEqual(['umfjollun-sea-den-2026-v6', 'upphitun-2026-v7'])
    expect(slots.find((s) => s.kind === 'umfjollun')!.game_id).toBe('2026_6_SEA_DEN')
  })
  it('engin upphitun eftir að fyrsti leikur hefst, engin umfjöllun um gamla leiki', () => {
    const slots = dueSlots(games, new Date('2026-10-23T08:00:00Z'))
    expect(slots.map((s) => s.slug)).toEqual([])
  })
  it('vikan þegar allir leikir umferðar eru spilaðir', () => {
    const done = games.map((x) => ({ ...x, home_score: 20, away_score: 17 }))
    const slots = dueSlots(done.slice(0, 2), new Date('2026-10-19T08:00:00Z'))
    expect(slots.map((s) => s.slug).sort()).toEqual(['umfjollun-hou-jax-2026-v6', 'umfjollun-sea-den-2026-v6', 'vikan-2026-v6'])
  })
})

describe('slugify', () => {
  it('íslenskir stafir og tákn', () => {
    expect(slugify('Mahomes snýr aftur: Þrjú snertimörk!')).toBe('mahomes-snyr-aftur-thrju-snertimork')
    expect(slugify('Æðisleg vörn í Ölfusi')).toBe('aedisleg-vorn-i-olfusi')
    expect(slugify('???')).toBe('grein')
  })
})
