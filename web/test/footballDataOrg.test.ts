import { describe, it, expect } from 'vitest'
import { mapFdClubs, fdStatus, fdMatchId, FD_COMPETITIONS, type FdMatch } from '../src/lib/footballDataOrg'

/** football-data.org's names for 2026/27, as the API returned them on 5 Nov 2026 */
const FD: Record<string, string[]> = {"PL": ["AFC Bournemouth", "Arsenal FC", "Aston Villa FC", "Brentford FC", "Brighton & Hove Albion FC", "Chelsea FC", "Coventry City FC", "Crystal Palace FC", "Everton FC", "Fulham FC", "Hull City AFC", "Ipswich Town FC", "Leeds United FC", "Liverpool FC", "Manchester City FC", "Manchester United FC", "Newcastle United FC", "Nottingham Forest FC", "Sunderland AFC", "Tottenham Hotspur FC"], "ELC": ["Birmingham City FC", "Blackburn Rovers FC", "Bolton Wanderers FC", "Bristol City FC", "Burnley FC", "Cardiff City FC", "Charlton Athletic FC", "Derby County FC", "Lincoln City FC", "Middlesbrough FC", "Millwall FC", "Norwich City FC", "Portsmouth FC", "Preston North End FC", "Queens Park Rangers FC", "Sheffield United FC", "Southampton FC", "Stoke City FC", "Swansea City AFC", "Watford FC", "West Bromwich Albion FC", "West Ham United FC", "Wolverhampton Wanderers FC", "Wrexham AFC"], "PD": ["Athletic Club", "CA Osasuna", "Club Atlético de Madrid", "Deportivo Alavés", "Elche CF", "FC Barcelona", "Getafe CF", "Levante UD", "Málaga CF", "RC Celta de Vigo", "RC Deportivo La Coruña", "RCD Espanyol de Barcelona", "Rayo Vallecano de Madrid", "Real Betis Balompié", "Real Madrid CF", "Real Racing Club de Santander", "Real Sociedad de Fútbol", "Sevilla FC", "Valencia CF", "Villarreal CF"], "SA": ["AC Milan", "AC Monza", "ACF Fiorentina", "AS Roma", "Atalanta BC", "Bologna FC 1909", "Cagliari Calcio", "Como 1907", "FC Internazionale Milano", "Frosinone Calcio", "Genoa CFC", "Juventus FC", "Parma Calcio 1913", "SS Lazio", "SSC Napoli", "Torino FC", "US Lecce", "US Sassuolo Calcio", "Udinese Calcio", "Venezia FC"], "BL1": ["1. FC Köln", "1. FC Union Berlin", "1. FSV Mainz 05", "Bayer 04 Leverkusen", "Borussia Dortmund", "Borussia Mönchengladbach", "Eintracht Frankfurt", "FC Augsburg", "FC Bayern München", "FC Schalke 04", "Hamburger SV", "RB Leipzig", "SC Freiburg", "SC Paderborn 07", "SV 07 Elversberg", "SV Werder Bremen", "TSG 1899 Hoffenheim", "VfB Stuttgart"], "FL1": ["AJ Auxerre", "AS Monaco FC", "Angers SCO", "ES Troyes AC", "FC Lorient", "Le Havre AC", "Le Mans FC", "Lille OSC", "OGC Nice", "Olympique Lyonnais", "Olympique de Marseille", "Paris FC", "Paris Saint-Germain FC", "RC Strasbourg Alsace", "Racing Club de Lens", "Stade Brestois 29", "Stade Rennais FC 1901", "Toulouse FC"], "DED": ["ADO Den Haag", "AFC Ajax", "AZ", "FC Groningen", "FC Twente '65", "FC Utrecht", "Feyenoord Rotterdam", "Fortuna Sittard", "Go Ahead Eagles", "NEC", "PEC Zwolle", "PSV", "SBV Excelsior", "SC Cambuur-Leeuwarden", "SC Heerenveen", "Sparta Rotterdam", "Telstar 1963", "Willem II Tilburg"], "PPL": ["Académico de Viseu FC", "CD Nacional", "CD Santa Clara", "CF Estrela da Amadora", "CS Marítimo", "Casa Pia AC", "FC Alverca", "FC Arouca", "FC Famalicão", "FC Porto", "GD Estoril Praia", "Gil Vicente FC", "Moreirense FC", "Rio Ave FC", "Sport Lisboa e Benfica", "Sporting Clube de Braga", "Sporting Clube de Portugal", "Vitória SC"]}

/** the same clubs as our match history spells them */
const OURS: Record<string, string> = {
  premier: "Arsenal|Aston Villa|Bournemouth|Brentford|Brighton|Chelsea|Coventry|Crystal Palace|Everton|Fulham|Hull|Ipswich|Leeds|Liverpool|Man City|Man United|Newcastle|Nott'm Forest|Sunderland|Tottenham",
  championship: 'Birmingham|Blackburn|Bolton|Bristol City|Burnley|Cardiff|Charlton|Derby|Lincoln|Middlesbrough|Millwall|Norwich|Portsmouth|Preston|QPR|Sheffield United|Southampton|Stoke|Swansea|Watford|West Brom|West Ham|Wolves|Wrexham',
  laliga: 'Alaves|Ath Bilbao|Ath Madrid|Barcelona|Betis|Celta|Elche|Espanol|Getafe|La Coruna|Levante|Malaga|Osasuna|Real Madrid|Santander|Sevilla|Sociedad|Valencia|Vallecano|Villarreal',
  seriea: 'Atalanta|Bologna|Cagliari|Como|Fiorentina|Frosinone|Genoa|Inter|Juventus|Lazio|Lecce|Milan|Monza|Napoli|Parma|Roma|Sassuolo|Torino|Udinese|Venezia',
  bundesliga: "Augsburg|Bayern Munich|Dortmund|Ein Frankfurt|Elversberg|FC Koln|Freiburg|Hamburg|Hoffenheim|Leverkusen|M'gladbach|Mainz|Paderborn|RB Leipzig|Schalke 04|Stuttgart|Union Berlin|Werder Bremen",
  ligue1: 'Angers|Auxerre|Brest|Le Havre|Le Mans|Lens|Lille|Lorient|Lyon|Marseille|Monaco|Nice|Paris FC|Paris SG|Rennes|Strasbourg|Toulouse|Troyes',
  eredivisie: 'Ajax|AZ Alkmaar|Cambuur|Den Haag|Excelsior|Feyenoord|For Sittard|Go Ahead Eagles|Groningen|Heerenveen|Nijmegen|PSV Eindhoven|Sparta Rotterdam|Telstar|Twente|Utrecht|Willem II|Zwolle',
  primeira: 'Academico Viseu|Alverca|Arouca|Benfica|Casa Pia|Estoril|Estrela|Famalicao|Gil Vicente|Guimaraes|Maritimo|Moreirense|Nacional|Porto|Rio Ave|Santa Clara|Sp Braga|Sp Lisbon',
}

describe('mapFdClubs', () => {
  for (const { code, league } of FD_COMPETITIONS) {
    it(`maps every ${code} club onto exactly one of ours`, () => {
      const check = mapFdClubs(FD[code], OURS[league].split('|'))
      expect({ unmapped: check.unmapped, unused: check.unused, collisions: check.collisions })
        .toEqual({ unmapped: [], unused: [], collisions: [] })
      expect(check.ok).toBe(true)
    })
  }
  it('keeps the two Paris clubs apart', () => {
    const m = mapFdClubs(FD.FL1, OURS.ligue1.split('|')).mapped
    expect(m.get('Paris Saint-Germain FC')).toBe('Paris SG')
    expect(m.get('Paris FC')).toBe('Paris FC')
  })
  it('refuses a club it cannot place', () => {
    const check = mapFdClubs([...FD.PL.slice(1), 'Leicester City FC'], OURS.premier.split('|'))
    expect(check.ok).toBe(false)
    expect(check.unmapped).toContain('Leicester City FC')
  })
})

const m = (status: string, home: number | null = null, away: number | null = null) =>
  ({ status, score: { fullTime: { home, away } } }) as unknown as FdMatch

describe('fdStatus', () => {
  it('a finished match with a score is played', () =>
    expect(fdStatus(m('FINISHED', 2, 1))).toEqual({ status: 'played', dated: true }))
  it('a finished match without a score is skipped, never written as 0-0', () =>
    expect(fdStatus(m('FINISHED')).status).toBe('skip'))
  it('a match in progress stays upcoming', () =>
    expect(fdStatus(m('IN_PLAY', 1, 0)).status).toBe('upcoming'))
  it('a postponed match stays on the calendar without a date', () =>
    expect(fdStatus(m('POSTPONED'))).toEqual({ status: 'upcoming', dated: false }))
  it('ids sit above every other source', () => expect(fdMatchId(560542)).toBe(4_000_560_542))
})
