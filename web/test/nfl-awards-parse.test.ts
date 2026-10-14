import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { linkWinner, normName, parseAwardPage, parseRookiePage, parseSeasonPage } from '../src/lib/nfl/awardsParse'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'nfl-awards', f), 'utf-8')

describe('parseAwardPage', () => {
  const mvp = parseAwardPage(fx('mvp.html'), 'MVP')
  it('deilt MVP 2003 verður tveir sigurvegarar', () => {
    expect(mvp.filter((w) => w.season === 2003).map((w) => w.name).sort()).toEqual(['Peyton Manning', 'Steve McNair'])
  })
  it('hreinsar fjölda sigra og neðanmálsgreinar', () => {
    const x = mvp.find((w) => w.season === 2004)!
    expect(x.name).toBe('Peyton Manning')
    expect(mvp.every((w) => !/[\[\]()†*‡]/.test(w.name))).toBe(true)
  })
  it('nýjustu ár og staða/lið þegar einn vinnur', () => {
    expect(mvp.find((w) => w.season === 2025)).toMatchObject({ name: 'Matthew Stafford', position: 'Quarterback' })
    expect(parseAwardPage(fx('opoy.html'), 'OPOY').find((w) => w.season === 2025)!.name).toBe('Jaxon Smith-Njigba')
    expect(parseAwardPage(fx('dpoy.html'), 'DPOY').find((w) => w.season === 2025)!.name).toBe('Myles Garrett')
    expect(parseAwardPage(fx('cpoy.html'), 'CPOY').find((w) => w.season === 1999)!.name).toBe('Bryant Young')
  })
  it('eitt ár í röð, engin tvítekning nema deilt', () => {
    const counts = new Map<number, number>()
    for (const w of mvp) counts.set(w.season, (counts.get(w.season) ?? 0) + 1)
    expect([...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s).sort()).toEqual([1997, 2003])
  })
})

describe('parseRookiePage (AP-taflan)', () => {
  const roy = parseRookiePage(fx('roy.html'))
  it('sóknar- og varnarnýliði hvert ár', () => {
    expect(roy.filter((w) => w.season === 2003).map((w) => [w.award, w.name])).toEqual([['OROY', 'Anquan Boldin'], ['DROY', 'Terrell Suggs']])
    expect(roy.find((w) => w.season === 2025 && w.award === 'DROY')).toMatchObject({ name: 'Carson Schwesinger', position: 'LB' })
  })
})

describe('parseSeasonPage', () => {
  it('verðlaunatafla tímabilssíðu, aðeins verðlaunin sex', () => {
    const s = parseSeasonPage(fx('season-2025.html'), 2025)
    expect(s.map((w) => w.award).sort()).toEqual(['CPOY', 'DPOY', 'DROY', 'MVP', 'OPOY', 'OROY'])
    expect(s.find((w) => w.award === 'CPOY')!.name).toBe('Christian McCaffrey')
  })
})

describe('nöfn og pörun', () => {
  it('stöðlun', () => {
    expect(normName('Odell Beckham Jr.')).toBe('odell beckham')
    expect(normName('Ja\'Marr Chase')).toBe('jamarr chase')
    expect(normName('A.J. Brown')).toBe('aj brown')
    expect(normName('Jaxon Smith-Njigba')).toBe('jaxon smith-njigba')
    expect(normName('J. J. Watt')).toBe(normName('J.J. Watt'))
    expect(normName('C. J. Stroud')).toBe('cj stroud')
  })
  it('nákvæm pörun, tvíræð eða engin gefur null', () => {
    const pool = [{ player_id: '1', name: 'Josh Allen' }, { player_id: '2', name: 'Josh Allen' }, { player_id: '3', name: 'Myles Garrett' }]
    expect(linkWinner('Myles Garrett', pool)).toBe('3')
    expect(linkWinner('Josh Allen', pool)).toBeNull()
    expect(linkWinner('Myles Garret', pool)).toBeNull()
  })
  it('nafnatvífarar greindir í sundur á stöðu, ef aðeins einn passar', () => {
    const pool = [{ player_id: 'rb', name: 'Adrian Peterson', position: 'RB' }, { player_id: 'rb2', name: 'Adrian Peterson', position: 'RB' }, { player_id: 'db', name: 'Michael Thomas', position: 'SS' }, { player_id: 'wr', name: 'Michael Thomas', position: 'WR' }]
    expect(linkWinner('Michael Thomas', pool, 'offence')).toBe('wr')
    expect(linkWinner('Michael Thomas', pool, 'defence')).toBe('db')
    expect(linkWinner('Adrian Peterson', pool, 'offence')).toBeNull()
  })
  it('nýliðaár greinir nýliðann frá eldri nafna', () => {
    const pool = [{ player_id: 'old', name: 'Adrian Peterson', position: 'RB', rookie_season: 2002 }, { player_id: 'new', name: 'Adrian Peterson', position: 'RB', rookie_season: 2007 }]
    expect(linkWinner('Adrian Peterson', pool, 'offence', 2007)).toBe('new')
  })
  it('handstaðfest samheiti, ekkert annað', () => {
    expect(linkWinner('Michael Vick', [{ player_id: 'v', name: 'Mike Vick' }])).toBe('v')
    expect(linkWinner('Michael Jordan', [{ player_id: 'j', name: 'Mike Jordan' }])).toBeNull()
  })
})
