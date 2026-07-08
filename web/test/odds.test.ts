import { describe, expect, it } from 'vitest'
import { parseFixtures, parseMatchOdds, splitFixtureSlug } from '../src/lib/odds'

describe('splitFixtureSlug', () => {
  it('splits multi-word slugs on known team boundaries', () => {
    expect(splitFixtureSlug('ka-akureyri-akranes')).toEqual(['KA', 'ÍA'])
    expect(splitFixtureSlug('thor-akureyri-vikingur-reykjavik')).toEqual(['Þór', 'Víkingur R.'])
    expect(splitFixtureSlug('fram-thor-akureyri')).toEqual(['Fram', 'Þór'])
    expect(splitFixtureSlug('hafnarfjordur-valur')).toEqual(['FH', 'Valur'])
  })
  it('returns null for unknown teams', () => {
    expect(splitFixtureSlug('arsenal-chelsea')).toBeNull()
  })
})

describe('parseFixtures', () => {
  const html = `
    <table>
    <tr data-dt="10,7,2026,19,15"><td><a href="/football/iceland/besta-deild-karla/fram-thor-akureyri/MmjeHJwq/">Fram</a></td></tr>
    <tr><td class="table-main__datetime">12.07. 20:00</td>
      <td><a href="/football/iceland/besta-deild-karla/ka-akureyri-akranes/j5aPMuGL/">KA Akureyri</a></td>
      <td><a href="/football/iceland/besta-deild-karla/ka-akureyri-akranes/j5aPMuGL/">dup</a></td></tr>
    <tr><td>no link here</td></tr>
    </table>`
  it('extracts unique fixtures with mapped names and UTC dates', () => {
    const fx = parseFixtures(html)
    expect(fx).toHaveLength(2)
    expect(fx[0]).toMatchObject({ bexId: 'MmjeHJwq', homeName: 'Fram', awayName: 'Þór' })
    expect(fx[0].date?.toISOString()).toBe('2026-07-10T19:15:00.000Z')
    expect(fx[1]).toMatchObject({ bexId: 'j5aPMuGL', homeName: 'KA', awayName: 'ÍA' })
    expect(fx[1].date?.getUTCDate()).toBe(12)
    expect(fx[1].date?.getUTCMonth()).toBe(6)
  })
})

describe('parseMatchOdds', () => {
  const html = `
    <tr data-bid="43"><td><a class="in-bookmaker-logo-link l43"><input type="hidden" class="bookmakersUrl" value="/bookmaker/241/x"/>Betsson</a></td>
      <td class="odds" data-odd="2.50" data-created="07,07,2026,20,26" data-pos="1"></td>
      <td class="odds" data-odd="3.60" data-pos="0"></td>
      <td class="odds" data-odd="2.20" data-pos="2"></td></tr>
    <tr data-bid="9"><td><a class="in-bookmaker-logo-link l9">bet365</a></td>
      <td data-odd="2.45" data-pos="1"></td><td data-odd="3.80" data-pos="0"></td><td data-odd="2.30" data-pos="2"></td></tr>
    <tr><td>average row without bookmaker link</td><td data-odd="7.95" data-pos="1"></td></tr>`
  it('parses one row per bookmaker, mapping data-pos 1/0/2 to home/draw/away', () => {
    const odds = parseMatchOdds(html)
    expect(odds).toEqual([
      { bookmaker: 'Betsson', home: 2.5, draw: 3.6, away: 2.2 },
      { bookmaker: 'bet365', home: 2.45, draw: 3.8, away: 2.3 },
    ])
  })
  it('skips partial rows where the favourite odds are missing', () => {
    const partial = `
      <tr data-bid="417"><td><a class="in-bookmaker-logo-link">1xBet</a></td>
        <td data-odd="8.70" data-pos="1"></td><td data-odd="6.55" data-pos="0"></td><td>&nbsp;</td></tr>`
    expect(parseMatchOdds(partial)).toEqual([])
  })
})
