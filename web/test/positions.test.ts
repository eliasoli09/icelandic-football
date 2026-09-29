import { describe, it, expect } from 'vitest'
import { inferPositions, normalizeName } from '../src/lib/positions'
import type { SofaPlayerInput } from '../src/lib/playerComposite'

const player = (
  name: string,
  extra: Record<string, unknown>,
  goals = 0,
): SofaPlayerInput => ({ name, appearances: 10, assists: 0, goals, extra })

const BASE = {
  'Total Shots': 5, 'Big Chances Missed': 0, 'Big Chances Created': 1,
  'Key Passes': 5, 'Accurate Passes': 200, Tackles: 10, Interceptions: 5,
  Clearances: 10, Saves: 0,
}

describe('inferPositions', () => {
  const pos = inferPositions([
    player('Markvörður', { ...BASE, Saves: 40 }),
    player('Miðvörður', { ...BASE, Tackles: 35, Interceptions: 25, Clearances: 90, 'Total Shots': 2 }),
    player('Skapandi miðjumaður', { ...BASE, 'Key Passes': 45, 'Big Chances Created': 10, 'Accurate Passes': 550 }),
    player('Framherji', { ...BASE, 'Total Shots': 60, 'Big Chances Missed': 12, Clearances: 2, Tackles: 3 }, 11),
    player('Venjulegur A', BASE),
    player('Venjulegur B', BASE),
  ])

  it('classifies the archetypes correctly', () => {
    expect(pos.get('Markvörður')).toBe('GK')
    expect(pos.get('Miðvörður')).toBe('DF')
    expect(pos.get('Skapandi miðjumaður')).toBe('MF')
    expect(pos.get('Framherji')).toBe('FW')
  })

  it('assigns every player a position', () => {
    expect(pos.size).toBe(6)
  })
})

describe('normalizeName', () => {
  it('matches SofaScore spellings to KSÍ spellings', () => {
    expect(normalizeName('Hallgrimur Mar Steingrimsson')).toBe(
      normalizeName('Hallgrímur Már Steingrímsson'),
    )
    expect(normalizeName('Óskar Borgthórsson')).toBe(normalizeName('Óskar Borgþórsson'))
    expect(normalizeName('Aron Sigurðarson')).toBe(normalizeName('Aron Sigurdarson'))
  })
})
