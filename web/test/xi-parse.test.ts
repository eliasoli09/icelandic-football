import { describe, it, expect } from 'vitest'
import { parseKsiReport, parseTmFixtures, parseTmFormation, parseTmLineups, parseTmReport, parseWikiMatch } from '../scripts/xi/parse'

describe('KSÍ report', () => {
  const player = (id: number, n: number, full: string, short: string) =>
    `<a href="/leikmenn/leikmadur?id=${id}"><div> <span>${n}</span> <span>${full}</span> <span>${short}</span> </div></a>`
  const html = `<title>FH-Stjarnan</title><span>Pepsi deild karla 2014 / 22. umferð</span>
    <span>Lau 4. október 2014 16:00</span>
    <a href="/oll-mot/mot/lid?id=1&#38;c=2"><div><img alt="FH"></div> <span>FH</span></a>
    <h1>1 - 2</h1>
    <a href="/oll-mot/mot/lid?id=3&#38;c=2"><div><img alt="Stjarnan"></div> <span>Stjarnan</span></a>
    <div data-panel="home"><span>Byrjunarlið</span></div><div data-panel="away"><span>Byrjunarlið</span></div>
    <div data-panel="home">${player(1, 1, 'Róbert Örn Óskarsson (M)', 'R. Óskarsson')}${player(2, 22, 'Ólafur Páll Snorrason (F)', 'Ó. Snorrason')}</div>
    <div data-panel="away">${player(3, 1, 'Ingvar Jónsson (M)', 'I. Jónsson')}</div>
    <div data-panel="home">${player(9, 12, 'Kristján Finnbogason (M)', 'K. Finnbogason')}</div>`

  it('reads the date, score, teams and starting elevens with keeper and captain', () => {
    const r = parseKsiReport(html)
    expect(r.date).toBe('2014-10-04')
    expect(r.score).toEqual([1, 2])
    expect([r.home, r.away]).toEqual(['FH', 'Stjarnan'])
    expect(r.competition).toBe('Pepsi deild karla 2014 / 22. umferð')
    expect(r.lineups.home.map((p) => p.number)).toEqual([1, 22])
    expect(r.lineups.home[0]).toMatchObject({ name: 'Róbert Örn Óskarsson', short: 'R. Óskarsson', goalkeeper: true, captain: false, ksiId: 1 })
    expect(r.lineups.home[1].captain).toBe(true)
  })
})

describe('Transfermarkt', () => {
  it('finds fixtures by date in either year format', () => {
    const html = `<tr><td>Final Wed 26/05/1999</td><td><a href="/spielbericht/index/spielbericht/111">2:1</a></td></tr>
      <tr><td>Final Wed 21/05/08</td><td><a href="/spielbericht/index/spielbericht/222">6:5</a></td></tr>`
    expect(parseTmFixtures(html).map((f) => [f.id, f.date])).toEqual([[111, '1999-05-26'], [222, '2008-05-21']])
  })

  it('reads line-ups with numbers, positions and the captain', () => {
    const row = (n: number, pos: string, name: string, captain = false) =>
      `<tr><td \n class="zentriert rueckennummer bg_x"\n title="${pos}"\n ><div class="rn_nummer"> ${n} </div></td>
       <td><a title="${name}" class="wichtig" href="/x">${name}</a>${captain ? '<span title="Team captain" class="kapitaenicon-table"></span>' : ''}</td>
       <td class="zentriert"><img src="f.png" alt="Iceland" title="Iceland" class="flaggenrahmen"></td></tr>`
    const html = `<a title="FH Hafnarfjördur" href="/fh/startseite/verein/1185"></a>Starting Line-up ${row(1, 'Goalkeeper', 'Róbert Örn Óskarsson')}${row(22, 'Central Midfield', 'Ólafur Páll Snorrason', true)} Substitutes ${row(12, 'Goalkeeper', 'Sub')}
      <a title="Stjarnan Gardabaer" href="/s/startseite/verein/21875"></a>Starting Line-up ${row(1, 'Goalkeeper', 'Ingvar Jónsson')} Substitutes`
    const l = parseTmLineups(html)
    expect(l.home.team).toBe('FH Hafnarfjördur')
    expect(l.home.players).toEqual([
      { number: 1, name: 'Róbert Örn Óskarsson', position: 'Goalkeeper', goalkeeper: true, captain: false, nations: ['Iceland'] },
      { number: 22, name: 'Ólafur Páll Snorrason', position: 'Central Midfield', goalkeeper: false, captain: true, nations: ['Iceland'] },
    ])
    expect(l.away.players.map((p) => p.number)).toEqual([1])
  })

  it('takes the score from the goals after a shoot-out, whose kicks the headline adds in', () => {
    const goal = (side: string, name: string) => `<li class="sb-aktion-${side}"><a title="${name}" class="wichtig" href="/x">${name}</a></li>`
    const html = `<title>AC Milan - Liverpool FC, 25/05/2005 - UEFA Champions League</title>
      <div class="sb-endstand">5:6<div class="sb-halbzeit">on pens</div></div>
      <div id="sb-tore"><ul>${goal('heim', 'Paolo Maldini')}${goal('heim', 'Hernán Crespo')}${goal('heim', 'Hernán Crespo')}${goal('gast', 'Steven Gerrard')}${goal('gast', 'Vladimír Smicer')}${goal('gast', 'Xabi Alonso')}</ul></div><div id="sb-karten"></div>`
    const r = parseTmReport(html)
    expect(r.date).toBe('2005-05-25')
    expect(r.score).toEqual([3, 3])
    expect(r.penalties).toEqual([2, 3])
    expect(r.extraTime).toBe(true)
  })

  it('reads where each shirt stands in the pitch graphic', () => {
    const shirt = (n: number, top: number, left: number) => `<div class="formation-player-container" style="top: ${top}%; left: ${left}%;"> <div class="tm-shirt-number tm-shirt-number--large"> ${n} </div></div>`
    const team = (offset: number) => Array.from({ length: 11 }, (_, i) => shirt(offset + i, 80 - i * 5, 10 + i)).join('')
    const html = `<div class="aufstellung-unterueberschrift-mannschaft"></div>${team(1)}<div class="aufstellung-unterueberschrift-mannschaft"></div>${team(21)}`
    const f = parseTmFormation(html)!
    expect(f.home.get(1)).toEqual({ top: 80, left: 10 })
    expect(f.away.size).toBe(11)
  })
})

describe('Wikipedia', () => {
  const box = (date: string, t1: string, t2: string, score: string) => `{{Football box\n|date = ${date}\n|team1 = ${t1}\n|score = ${score}\n|team2 = ${t2}\n|goals1 = [[Paolo Maldini|Maldini]] {{goal|1}}\n|goals2 = [[Steven Gerrard|Gerrard]] {{goal|54}} [[Xabi Alonso|Alonso]] {{goal|60}}\n|penaltyscore = 2–3\n}}`
  const lineup = (rows: string) => `{|\n|-\n${rows}\n|-\n|colspan="3"|'''Substitutions:'''\n|-\n|GK ||'''12'''||[[Sub Keeper]]\n|}\n`
  const wt = [
    box('{{Start date|2005|5|25}}', '[[AC Milan|Milan]]', '[[Liverpool F.C.|Liverpool]]', '3–3 ([[Overtime (sports)|a.e.t.]])'),
    '{{Football kit |body = FFFFFF |title = Milan}}{{Football kit |body = E00000 |title = Liverpool}}',
    '{|\n|valign="top"|\n' + lineup("|GK ||'''1''' ||{{flagicon|BRA}} [[Nelson Dida|Dida]]\n|-\n|CB ||'''3''' ||{{flagicon|ITA}} [[Paolo Maldini]] ([[Captain (association football)|c]])"),
    '|valign="top"|\n' + lineup("|GK ||'''1''' ||{{flagicon|POL}} [[Jerzy Dudek]]\n|-\n|CM ||'''8''' ||{{flagicon|ENG}} [[Steven Gerrard]] ([[Captain (association football)|c]])"),
    box('25 May 2005', '{{fb-rt|ENG}}', '{{fb|ISL}}', '1–2'),
  ].join('\n')

  it('picks the match by date and teams and reads both elevens', () => {
    const m = parseWikiMatch(wt, '2005-05-25', (h) => h === 'Milan')
    expect([m.home, m.away]).toEqual(['Milan', 'Liverpool'])
    expect(m.score).toEqual([3, 3])
    expect(m.extraTime).toBe(true)
    expect(m.penalties).toBe('2-3'.replace('-', '–'))
    expect(m.kits).toEqual({ home: '#ffffff', away: '#e00000' })
    expect(m.lineups.home).toEqual([
      { number: 1, name: 'Dida', short: 'Nelson Dida', position: 'GK', goalkeeper: true, captain: false },
      { number: 3, name: 'Paolo Maldini', short: 'Paolo Maldini', position: 'CB', goalkeeper: false, captain: true },
    ])
    expect(m.lineups.away.map((p) => p.number)).toEqual([1, 8])
    expect(m.goals).toEqual([
      { name: 'Paolo Maldini', side: 'home', count: 1 },
      { name: 'Steven Gerrard', side: 'away', count: 1 },
      { name: 'Xabi Alonso', side: 'away', count: 1 },
    ])
  })

  it('reads country codes as team names and refuses an ambiguous date', () => {
    expect(parseWikiMatch(wt, '2005-05-25', (h, a) => h === 'England' && a === 'Iceland').score).toEqual([1, 2])
    expect(() => parseWikiMatch(wt, '2005-05-25')).toThrow(/2 leikir/)
  })
})
