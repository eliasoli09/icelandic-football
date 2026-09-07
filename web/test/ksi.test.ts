import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMatchCards } from '../src/lib/ksi'

const fx = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')

describe('parseMatchCards — results page (Besta deild 2026)', () => {
  const cards = parseMatchCards(fx('results_page.html'), 2026)

  it('finds all 15 cards on the page', () => {
    expect(cards).toHaveLength(15)
  })

  it('parses a played match with correct teams, score, venue and date', () => {
    const m = cards.find((c) => c.ksiId === 7041400)!
    expect(m.home).toBe('ÍBV')
    expect(m.away).toBe('Valur')
    expect(m.homeGoals).toBe(1)
    expect(m.awayGoals).toBe(0)
    expect(m.status).toBe('played')
    // ÍBV's home ground — proves venue is taken from the card's own header,
    // not the following card's
    expect(m.venue).toBe('Hásteinsvöllur')
    expect(m.date).toMatch(/^2026-07-04T/)
  })

  it('assigns ELKEM völlurinn (ÍA home ground) to the ÍA card', () => {
    const m = cards.find((c) => c.home === 'ÍA')!
    expect(m.venue).toBe('ELKEM völlurinn')
  })
})

describe('parseMatchCards — fixtures page (upcoming)', () => {
  const cards = parseMatchCards(fx('fixtures_page.html'), 2026)

  it('parses the upcoming Keflavík–Fram card with kickoff time', () => {
    const m = cards.find((c) => c.home === 'Keflavík' && c.away === 'Fram')!
    expect(m.status).toBe('upcoming')
    expect(m.homeGoals).toBeNull()
    expect(m.date).toBe('2026-07-06T19:15:00Z')
    expect(m.venue).toBe('HS Orku völlurinn')
    expect(m.ksiId).toBe(7041404) // imminent match already has its link
  })

  it('far-future fixtures have no KSÍ id yet and never steal a neighbour card link', () => {
    const ka = cards.find((c) => c.home === 'KA' && c.away === 'ÍA')!
    expect(ka.ksiId).toBeNull()
    expect(ka.status).toBe('upcoming')
    expect(cards.filter((c) => c.ksiId === 7041404)).toHaveLength(1)
  })
})

// KSÍ added Tailwind utility classes to the team-name spans (seen Sept 2026:
// `max-w-[125rem] l:max-w-[160rem] wrap-break-word`). The old exact-class
// regexes matched nothing, so the nightly ingest silently scraped zero cards
// for six weeks. Parse on the stable part of the class list instead.
describe('parseMatchCards — KSÍ markup with extra utility classes', () => {
  const cards = parseMatchCards(fx('results_page_v2.html'), 2026)

  it('still finds all 15 cards', () => {
    expect(cards).toHaveLength(15)
  })

  it('keeps home and away on their own sides of the score', () => {
    const m = cards.find((c) => c.ksiId === 7041453)!
    expect(m.home).toBe('ÍA')
    expect(m.away).toBe('KR')
    expect(m.homeGoals).toBe(3)
    expect(m.awayGoals).toBe(1)
    expect(m.status).toBe('played')
    expect(m.venue).toBe('ELKEM völlurinn')
  })

  it('never reads the same club on both sides of a card', () => {
    for (const c of cards) expect(c.home).not.toBe(c.away)
  })

  it('parses upcoming split-round cards too', () => {
    const up = parseMatchCards(fx('fixtures_page_v2.html'), 2026)
    expect(up.length).toBeGreaterThan(0)
    expect(up.every((c) => c.home && c.away)).toBe(true)
  })
})

// KSÍ publishes placeholder cards for stages whose participants aren't decided
// ("Úrslitaleikur" / "23. Umferð" vs a team literally named "."). They look
// like real cards — team links, crest slots — so they were ingested as matches
// and even created clubs named "23. Umferð" in the teams table.
describe('parseMatchCards — undecided-stage placeholders', () => {
  const cards = parseMatchCards(fx('playoff_placeholder_page.html'), 2026)

  it('keeps the real playoff ties', () => {
    expect(cards).toHaveLength(4)
    expect(cards.map((c) => `${c.home}-${c.away}`)).toContain('Njarðvík-Þróttur R.')
  })

  it('drops the undecided final rather than inventing clubs for it', () => {
    expect(cards.some((c) => c.home === 'Úrslitaleikur' || c.away === '.')).toBe(false)
  })
})
