import { describe, expect, it } from 'vitest'
import { FIFA, lineOf, tier } from '../src/lib/fifa/ratings'

describe('FIFA ratings', () => {
  const players = FIFA.players

  it('rates every player once, the best at 94 and nobody above', () => {
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length)
    expect(Math.max(...players.map((p) => p.rating))).toBe(94)
    for (const p of players) {
      expect(Number.isInteger(p.rating), p.name).toBe(true)
      expect(p.rating, p.name).toBeGreaterThanOrEqual(40)
      expect(p.rating, p.name).toBeLessThanOrEqual(94)
    }
  })

  it('covers all twelve clubs with a full season of minutes', () => {
    const teams = new Map<string, number>()
    for (const p of players) teams.set(p.team, (teams.get(p.team) ?? 0) + p.minutes)
    expect(teams.size).toBe(12)
    // eleven players for ninety minutes of each match, give or take red cards
    for (const [team, minutes] of teams) expect(minutes / (FIFA.matches / 6 * 90 * 11), team).toBeGreaterThan(0.95)
  })

  it('is sorted best first and was checked against ratings it did not see', () => {
    players.forEach((p, i) => { if (i) expect(players[i - 1].rating).toBeGreaterThanOrEqual(p.rating) })
    expect(FIFA.model.crossValidation.auc).toBeGreaterThan(0.7)
  })

  it('maps positions to lines and ratings to card colours', () => {
    expect([lineOf('CB'), lineOf('CAM'), lineOf('ST'), lineOf('GK'), lineOf(null)]).toEqual(['DEF', 'MID', 'FWD', 'GK', null])
    expect([tier(94), tier(75), tier(74), tier(65), tier(64)]).toEqual(['gold', 'gold', 'silver', 'silver', 'bronze'])
    for (const p of players) if (p.position) expect(lineOf(p.position), `${p.name} ${p.position}`).not.toBeNull()
  })
})
