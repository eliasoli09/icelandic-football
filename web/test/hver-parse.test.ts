import { describe, expect, it } from 'vitest'
import { agreeCareers, infobox, respell, linesOf, sameClubName, tmLines, tmMoves, tmProfile, tmSpells, wikiBirth, wikiCareer, wikiNationalTeams, years, type TmClub, type WikiSpell } from '../scripts/hver/parse'

describe('Wikipedia infobox', () => {
  const wt = `Intro {{Short description|x}}
{{Infobox football biography
| name = Gylfi Sigurðsson
| birth_date = {{birth date and age|1989|9|8|df=y}}<ref>{{cite web|url=x}}</ref>
| position = [[Attacking midfielder]]
| years1 = 2008–2010 | clubs1 = [[Reading F.C.|Reading]] | caps1 = 42
| years2 = 2008 | clubs2 = → [[Shrewsbury Town F.C.|Shrewsbury Town]] (loan)
| years3 = 2025– | clubs3 = [[Knattspyrnufélagið Víkingur|Víkingur Reykjavík]]
| nationalyears1 = 2007–2011 | nationalteam1 = [[Iceland national under-21 football team|Iceland U21]]
| nationalyears2 = 2010– | nationalteam2 = [[Iceland national football team|Iceland]]
}}
'''Gylfi''' is`

  it('reads parameters written on one line or many', () => {
    const p = infobox(wt)!
    expect(p.get('name')).toBe('Gylfi Sigurðsson')
    expect(wikiBirth(p)).toBe('1989-09-08')
    expect(wikiCareer(p)).toEqual([
      { from: 2008, to: 2010, club: 'Reading', target: 'Reading F.C.', loan: false },
      { from: 2008, to: 2008, club: 'Shrewsbury Town', target: 'Shrewsbury Town F.C.', loan: true },
      { from: 2025, to: null, club: 'Víkingur Reykjavík', target: 'Knattspyrnufélagið Víkingur', loan: false },
    ])
    expect(wikiNationalTeams(p)).toEqual(['Iceland'])
  })

  it('reads year spans and refuses what it cannot read', () => {
    expect(years('2012–13')).toEqual({ from: 2012, to: 2013 })
    expect(years('2019')).toEqual({ from: 2019, to: 2019 })
    expect(years('2020–')).toEqual({ from: 2020, to: null })
    expect(years('c. 1990')).toBeNull()
    expect(() => wikiCareer(new Map([['years1', 'early'], ['clubs1', '[[KR]]']]))).toThrow()
  })

  it('puts written positions in lines, a winger in two', () => {
    expect([...linesOf('Winger')].sort()).toEqual(['FW', 'MF'])
    expect([...linesOf('Centre-back')]).toEqual(['DF'])
    expect([...linesOf('Left wing-back')]).toEqual(['DF'])
    expect([...tmLines('Right Winger')].sort()).toEqual(['FW', 'MF'])
    expect([...tmLines('Goalkeeper')]).toEqual(['GK'])
    expect([...linesOf('DF')]).toEqual(['DF'])
  })

  it('reads birth dates with the month as a word or the template spelt with an underscore', () => {
    expect(wikiBirth(new Map([['birth_date', '{{Birth date and age|2004|August|29|df=y}}']]))).toBe('2004-08-29')
    expect(wikiBirth(new Map([['birth_date', '{{birth_date|1946|12|9|df=y}}']]))).toBe('1946-12-09')
    expect(wikiBirth(new Map([['birth_date', '{{Birth date and age|df=yes|1994|9|26}}']]))).toBe('1994-09-26')
    expect(wikiBirth(new Map([['birth_date', '1994']]))).toBeNull()
  })
})

const club = (name: string, slug = name.toLowerCase().replace(/\s+/g, '-'), iceland = false, special = false) =>
  ({ isSpecial: special, href: `/${slug}/transfers/verein/1`, clubName: name, countryFlag: iceland ? 'https://img/flagge/verysmall/73.png' : null })
const move = (date: string, from: ReturnType<typeof club>, to: ReturnType<typeof club>, fee = '-') =>
  ({ dateUnformatted: date, from, to, fee, upcoming: false, futureTransfer: 0 })

describe('Transfermarkt spells', () => {
  it('continues a parent spell after a loan and ends spells at retirement', () => {
    const reading = club('Reading'), crewe = club('Crewe Alexandra')
    const spells = tmSpells(tmMoves({ transfers: [
      move('2010-08-31', reading, club('Hoffenheim'), '€5.20m'),
      move('2009-05-01', crewe, reading, 'End of loan'),
      move('2009-02-01', reading, crewe, 'loan transfer'),
      move('2007-07-01', club('Reading U18'), reading),
      move('2012-07-01', club('Hoffenheim'), club('Retired', 'retired', false, true)),
    ] }))
    expect(spells.map((s) => [s.club.name, s.from, s.to, s.loan, s.optional])).toEqual([
      ['Reading U18', null, '2007-07-01', false, true],
      ['Reading', '2007-07-01', '2010-08-31', false, false],
      ['Crewe Alexandra', '2009-02-01', '2009-05-01', true, false],
      ['Hoffenheim', '2010-08-31', '2012-07-01', false, false],
    ])
  })

  it('starts a spell before the first move away from a club it never showed him joining', () => {
    const b = club('Breidablik', 'breidablik', true), a = club('Augnablik', 'augnablik', true)
    const spells = tmSpells(tmMoves({ transfers: [
      move('2012-05-15', b, a, 'loan transfer'), move('2012-10-16', a, b, 'End of loan'),
      move('2013-05-04', b, a, 'loan transfer'), move('2013-10-16', a, b, 'End of loan'),
      move('2017-07-31', b, club('Halmstads BK')),
    ] }))
    expect(spells.map((s) => [s.club.name, s.from, s.to, s.loan, s.optional])).toEqual([
      // where the history starts: it may be a youth side, so Wikipedia need not list it
      ['Breidablik', null, '2017-07-31', false, true],
      // a loan renewed for the next season is one spell
      ['Augnablik', '2012-05-15', '2013-10-16', true, false],
      ['Halmstads BK', '2017-07-31', null, false, false],
    ])
    expect(spells[0].club.iceland).toBe(true)
  })
})

describe('agreeing careers', () => {
  const same = (tm: TmClub, w: WikiSpell) => sameClubName(tm.name, w.club)
  const w = (from: number, to: number | null, c: string, loan = false): WikiSpell => ({ from, to, club: c, target: null, loan })
  const t = (from: string | null, to: string | null, name: string, loan = false, optional = false) =>
    ({ from, after: null, to, club: { name, slug: name.toLowerCase(), id: '1', iceland: false, special: false }, loan, optional })

  it('matches clubs by name, allows a year either side and keeps Wikipedia years in Transfermarkt order', () => {
    const r = agreeCareers([w(2008, 2010, 'Reading'), w(2009, 2009, 'Crewe Alexandra', true), w(2010, null, 'TSG Hoffenheim')],
      [t('2007-07-01', '2010-08-31', 'Reading'), t('2009-02-01', '2009-05-01', 'Crewe Alexandra', true), t('2010-08-31', null, 'Hoffenheim')], same)
    expect(r.problems).toEqual([])
    expect(r.rows.map((x) => `${x.from} ${x.club}`)).toEqual(['2008 Reading', '2009 Crewe Alexandra', '2010 TSG Hoffenheim'])
  })

  it('reports a club only one source has, and a start two years apart', () => {
    const r = agreeCareers([w(2005, 2008, 'Valur'), w(2010, null, 'KR')], [t('2005-01-01', '2008-01-01', 'Valur'), t('2008-01-01', null, 'KR'), t('2009-01-01', null, 'FH')], same)
    expect(r.problems).toHaveLength(3)
  })

  it('lets a youth side stand for the club, or drop out, but never a senior spell', () => {
    const r = agreeCareers([w(2006, 2008, 'AZ'), w(2008, null, 'Coventry City')],
      [t('2006-08-15', '2007-07-01', 'AZ U19', false, true), t('2007-07-01', '2008-07-01', 'AZ Alkmaar U21', false, true), t('2008-07-01', null, 'Coventry')], (tm, ws) => sameClubName(tm.name.replace(/ U\d+/, ''), ws.club))
    expect(r.problems).toEqual([])
    expect(r.rows.map((x) => x.club)).toEqual(['AZ', 'Coventry City'])
  })

  it('shows a loan only both sources call a loan as a plain spell', () => {
    const r = agreeCareers([w(1998, 1998, 'KR Reykjavík')], [t('1998-06-08', '1998-08-10', 'KR Reykjavík', true)], same)
    expect(r.problems).toEqual([])
    expect(r.rows[0].loan).toBe(false)
  })

  it('does not take one Manchester for the other', () => {
    expect(sameClubName('Man City', 'Manchester United')).toBe(false)
    expect(sameClubName('Manchester City', 'Manchester United')).toBe(false)
    expect(sameClubName('Swansea', 'Swansea City A.F.C.')).toBe(true)
    expect(sameClubName('Breidablik', "Breiðablik men's football")).toBe(true)
  })

  it('reads Transfermarkt short forms, but not a word that starts another', () => {
    expect(sameClubName('Heart of Midl.', 'Heart of Midlothian')).toBe(true)
    expect(sameClubName('Man Utd', 'Manchester United')).toBe(true)
    expect(sameClubName('Sheff Wed', 'Sheffield Wednesday')).toBe(true)
    expect(sameClubName('N.E.C.', 'NEC')).toBe(true)
    expect(sameClubName('Djurgården', 'Djurgårdens IF')).toBe(true)
    expect(sameClubName('Fram', 'Framherjar')).toBe(false)
    expect(sameClubName('Wolves', 'Wolverhampton Wanderers')).toBe(false)
    expect(sameClubName('T.', 'Thanda')).toBe(false)
  })
})

describe('Transfermarkt profile', () => {
  it('reads name, birth date, position, citizenship and the international side', () => {
    const html = `<h1 class="data-header__headline-wrapper"><span class="data-header__shirt-number">#10</span> Gylfi <strong>Sigurdsson</strong></h1>
      <span itemprop="birthDate" class="data-header__content">
        08/09/1989 (37) </span>
      <span itemprop="nationality" class="data-header__content"><img title="Iceland" class="flaggenrahmen" /> Iceland </span>
      <li class="data-header__label">Position:
        <span class="data-header__content">
          Attacking Midfield </span></li>
      <li for="" class="data-header__label">
        Former International:
        <span class="data-header__content"><img title="Iceland" /><a title="Iceland" href="/island/startseite/verein/3574">Iceland</a> </span></li>
      <span class="info-table__content info-table__content--regular">Name in home country:</span>
      <span class="info-table__content info-table__content--bold">Gylfi Þór Sigurðsson</span>`
    expect(tmProfile(html)).toEqual({ name: 'Gylfi Þór Sigurðsson', home: true, headline: 'Gylfi Sigurdsson', born: '1989-09-08', position: 'Attacking Midfield', citizenship: ['Iceland'], international: 'Iceland' })
  })
})

describe('player names', () => {
  it('keeps the name Icelanders use and restores the letters the sources agree on', () => {
    expect(respell('Jon Gudni Fjóluson', 'Jón Guðni Fjóluson', 'Jón Guðni Fjóluson')).toBe('Jón Guðni Fjóluson')
    expect(respell('Aron Einar Gunnarsson', 'Aron Einar Malmquist Gunnarsson', 'Aron Gunnarsson')).toBe('Aron Einar Gunnarsson')
    expect(respell('Stefán Teitur Þórðarsson', 'Stefán Teitur Þórðarson', 'Stefán Teitur Þórðarson')).toBe('Stefán Teitur Þórðarson')
    expect(respell('Birnir Snaer Ingason', null, 'Birnir Snær Ingason')).toBe('Birnir Snær Ingason')
    // one letter off in only one source is not enough
    expect(respell('Stefán Teitur Þórðarsson', null, 'Stefán Teitur Þórðarson')).toBe('Stefán Teitur Þórðarsson')
  })
})

