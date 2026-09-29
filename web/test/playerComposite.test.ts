import { describe, it, expect } from 'vitest'
import { computeComposite, type SofaPlayerInput } from '../src/lib/playerComposite'

const player = (
  name: string,
  extra: Record<string, unknown>,
  assists = 0,
  appearances = 10,
): SofaPlayerInput => ({ name, appearances, assists, extra })

const BASE = {
  'Big Chances Created': 0, 'Key Passes': 0, 'Successful Dribbles': 0,
  Tackles: 0, Interceptions: 0, Clearances: 0, 'Total Duels Won': 0,
  'Accurate Passes': 100, 'Accurate Passes %': 70, Saves: 0,
  'Clean Sheets': 0, 'Penalty Saves': 0,
}

describe('computeComposite', () => {
  const pool: SofaPlayerInput[] = [
    player('Skapari', { ...BASE, 'Big Chances Created': 12, 'Key Passes': 40 }, 8),
    player('Varnarjaxl', { ...BASE, Tackles: 60, Interceptions: 40, Clearances: 80, 'Total Duels Won': 120 }),
    player('Sendingameistari', { ...BASE, 'Accurate Passes': 600, 'Accurate Passes %': 92 }),
    player('Markvörður', { ...BASE, Saves: 45, 'Clean Sheets': 6, 'Penalty Saves': 2 }),
    player('Slakur markvörður', { ...BASE, Saves: 20, 'Clean Sheets': 1 }),
    player('Meðaljón A', BASE),
    player('Meðaljón B', BASE),
    player('Meðaljón C', BASE),
  ]
  const comp = computeComposite(pool)

  it('rewards each specialist in their own category', () => {
    expect(comp.get('Skapari')!.creation).toBeGreaterThan(10)
    expect(comp.get('Varnarjaxl')!.defense).toBeGreaterThan(10)
    expect(comp.get('Sendingameistari')!.passing).toBeGreaterThan(4)
    expect(comp.get('Markvörður')!.goalkeeping).toBeGreaterThan(10)
  })

  it('a defender is not punished for creating nothing more than the average player', () => {
    const varnar = comp.get('Varnarjaxl')!
    const medal = comp.get('Meðaljón A')!
    expect(varnar.total).toBeGreaterThan(medal.total)
  })

  it('caps the total and skips players with too few appearances', () => {
    for (const b of comp.values()) expect(Math.abs(b.total)).toBeLessThanOrEqual(80)
    const few = computeComposite([player('Nýliði', BASE, 0, 2)])
    expect(few.has('Nýliði')).toBe(false)
  })

  it('outfield players get no goalkeeping component', () => {
    expect(comp.get('Skapari')!.goalkeeping).toBe(0)
  })
})

describe('progression category', () => {
  it('activates only when progression columns are present in the drop', () => {
    const without = computeComposite([
      player('A', BASE), player('B', BASE), player('C', BASE),
    ])
    expect(without.get('A')!.progression).toBe(0)

    const withProg = computeComposite([
      player('Djúpspilari', { ...BASE, 'Accurate Long Balls': 80, 'Passes into Final Third': 120 }),
      player('B', BASE),
      player('C', BASE),
    ])
    expect(withProg.get('Djúpspilari')!.progression).toBeGreaterThan(4)
    expect(withProg.get('Djúpspilari')!.total).toBeGreaterThan(withProg.get('B')!.total)
  })
})
