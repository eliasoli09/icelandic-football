/**
 * Full-season fixture calendars from openfootball, whose community-maintained
 * text files carry a date and a kick-off time for every match of a season.
 *
 * The results feed only publishes the next few days, so without this the site
 * knows who is playing this weekend and nothing after that.
 *
 * openfootball writes clubs out in full — "Paris Saint-Germain FC" where our
 * history has "Paris SG" — so every name is mapped explicitly. Nothing is
 * guessed: a first attempt matched on normalised substrings and quietly put
 * Paris Saint-Germain on Paris FC, which would have handed one club's season
 * to another. A league whose mapping is not a bijection is refused outright.
 */

export interface CalendarMatch {
  matchday: number
  /** null when the match is postponed without a new date yet */
  date: string | null
  time: string | null
  home: string
  away: string
  /** a result is already printed beside it */
  played: boolean
}

const MONTH: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

/** Where each league's calendar lives. */
export const CALENDAR_SOURCES: Record<string, string> = {
  premier: 'https://raw.githubusercontent.com/openfootball/england/master/2026-27/1-premierleague.txt',
  championship: 'https://raw.githubusercontent.com/openfootball/england/master/2026-27/2-championship.txt',
  laliga: 'https://raw.githubusercontent.com/openfootball/espana/master/2026-27/1-liga.txt',
  bundesliga: 'https://raw.githubusercontent.com/openfootball/deutschland/master/2026-27/1-bundesliga.txt',
  seriea: 'https://raw.githubusercontent.com/openfootball/italy/master/2026-27/1-seriea.txt',
  ligue1: 'https://raw.githubusercontent.com/openfootball/europe/master/france/2026-27_fr1.txt',
  eredivisie: 'https://raw.githubusercontent.com/openfootball/europe/master/netherlands/2026-27_nl1.txt',
  primeira: 'https://raw.githubusercontent.com/openfootball/europe/master/portugal/2026-27_pt1.txt',
}

/**
 * openfootball's club name to the one our match history uses. Written out in
 * full rather than derived, because the failure mode of a near-miss is silent.
 */
export const CLUB_NAMES: Record<string, string> = {
  // England
  'Manchester United FC': 'Man United', 'Manchester City FC': 'Man City',
  'Tottenham Hotspur FC': 'Tottenham', 'Nottingham Forest FC': "Nott'm Forest",
  'Brighton & Hove Albion FC': 'Brighton', 'Newcastle United FC': 'Newcastle',
  'Leeds United FC': 'Leeds', 'Hull City AFC': 'Hull',
  'Ipswich Town FC': 'Ipswich', 'Coventry City FC': 'Coventry',
  'Birmingham City FC': 'Birmingham', 'Blackburn Rovers FC': 'Blackburn',
  'Bolton Wanderers FC': 'Bolton', 'Cardiff City FC': 'Cardiff',
  'Charlton Athletic FC': 'Charlton', 'Derby County FC': 'Derby',
  'Lincoln City FC': 'Lincoln', 'Norwich City FC': 'Norwich',
  'Preston North End FC': 'Preston', 'Stoke City FC': 'Stoke',
  'Swansea City AFC': 'Swansea', 'West Bromwich Albion FC': 'West Brom',
  'West Ham United FC': 'West Ham', 'Queens Park Rangers FC': 'QPR',
  'Wolverhampton Wanderers FC': 'Wolves',
  // Spain
  'CA Osasuna': 'Osasuna', 'Deportivo Alavés': 'Alaves',
  'RC Celta de Vigo': 'Celta', 'RC Deportivo La Coruña': 'La Coruna',
  'RCD Espanyol de Barcelona': 'Espanol', 'Rayo Vallecano de Madrid': 'Vallecano',
  'Real Betis Balompié': 'Betis', 'Real Racing Club de Santander': 'Santander',
  'Real Sociedad de Fútbol': 'Sociedad', 'Athletic Club': 'Ath Bilbao',
  'Club Atlético de Madrid': 'Ath Madrid',
  // Germany
  '1. FC Köln': 'FC Koln', '1. FC Union Berlin': 'Union Berlin',
  '1. FSV Mainz 05': 'Mainz', 'Bayer 04 Leverkusen': 'Leverkusen',
  'Borussia Dortmund': 'Dortmund', 'Hamburger SV': 'Hamburg',
  'SC Paderborn 07': 'Paderborn', 'SV 07 Elversberg': 'Elversberg',
  'TSG 1899 Hoffenheim': 'Hoffenheim', 'Borussia Mönchengladbach': "M'gladbach",
  'Eintracht Frankfurt': 'Ein Frankfurt', 'FC Bayern München': 'Bayern Munich',
  // Italy
  'ACF Fiorentina': 'Fiorentina', 'Bologna FC 1909': 'Bologna',
  'Como 1907': 'Como', 'FC Internazionale Milano': 'Inter',
  'Genoa CFC': 'Genoa', 'Parma Calcio 1913': 'Parma',
  // France
  'AJ Auxerre': 'Auxerre', 'Angers SCO': 'Angers', 'ES Troyes AC': 'Troyes',
  'Lille OSC': 'Lille', 'OGC Nice': 'Nice', 'Olympique Lyonnais': 'Lyon',
  'Olympique de Marseille': 'Marseille', 'Paris Saint-Germain FC': 'Paris SG',
  'RC Strasbourg Alsace': 'Strasbourg', 'Racing Club de Lens': 'Lens',
  'Stade Brestois 29': 'Brest', 'Stade Rennais FC 1901': 'Rennes',
  // Netherlands
  'ADO Den Haag': 'Den Haag', AZ: 'AZ Alkmaar', 'Feyenoord Rotterdam': 'Feyenoord',
  'PEC Zwolle': 'Zwolle', PSV: 'PSV Eindhoven', 'SBV Excelsior': 'Excelsior',
  'SC Cambuur-Leeuwarden': 'Cambuur', 'Willem II Tilburg': 'Willem II',
  'Fortuna Sittard': 'For Sittard', NEC: 'Nijmegen',
  // Portugal
  'CF Estrela da Amadora': 'Estrela', 'CS Marítimo': 'Maritimo',
  'GD Estoril Praia': 'Estoril', 'Sport Lisboa e Benfica': 'Benfica',
  'Vitória Guimarães': 'Guimaraes', 'Sporting Clube de Braga': 'Sp Braga',
  'Sporting Clube de Portugal': 'Sp Lisbon',
}

/**
 * Everything both spellings agree on: accents, punctuation, the club-type
 * designator and the founding year. What is left has to match exactly — never
 * as a substring, which is the mistake that put Paris Saint-Germain on Paris
 * FC, since "paris saint germain" does contain "paris".
 */
const DESIGNATORS = new RegExp(
  '\\b(fc|afc|cfc|cf|sc|ac|acf|bc|ssc|sv|us|as|ss|ud|cd|rcd|sd|gd|cs|ca|rc|bk|' +
  'vfl|vfb|tsg|bsc|fsv|spvgg|osc|sco|aj|es|calcio|club|de|da|del|deportivo)\\b',
  'g',
)
const normalise = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\b\d{2,4}\b/g, ' ')
    .replace(DESIGNATORS, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ').trim()

/** openfootball's club name, as our history spells it. */
export const clubName = (raw: string, known?: Set<string>) => {
  const t = raw.trim()
  const mapped = CLUB_NAMES[t]
  if (mapped) return mapped
  if (!known || known.has(t)) return t
  const n = normalise(t)
  for (const k of known) if (normalise(k) === n) return k
  return t
}

export function parseCalendar(text: string): CalendarMatch[] {
  const out: CalendarMatch[] = []
  let matchday = 0
  let year = 0
  let date: string | null = null
  let time: string | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.startsWith('#') || line.startsWith('=')) continue

    const md = line.match(/^\s*[^\w\s]?\s*Matchday\s+(\d+)/i)
    if (md) { matchday = Number(md[1]); continue }

    // "  Fri Aug 14 2026" — the year is written once and carried forward
    const dl = line.match(/^\s{0,4}[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/)
    if (dl) {
      if (dl[3]) year = Number(dl[3])
      const month = MONTH[dl[1]]
      if (month && year) {
        date = `${year}-${String(month).padStart(2, '0')}-${String(Number(dl[2])).padStart(2, '0')}`
        time = null
      }
      continue
    }

    // "    20:00  Home FC  v  Away FC   2-1 (1-0)" — time and score both optional
    const m = line.match(/^\s+(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)\s*$/)
    if (!m) continue
    if (m[1]) time = m[1]

    let away = m[3]
    let played = false
    const score = away.match(/^(.*?)\s{2,}\d+-\d+(?:\s*\(.*\))?\s*$/)
    if (score) { away = score[1]; played = true }
    // "[postponed]" or "[cancelled]" sits where the score would be
    const note = away.match(/^(.*?)\s*\[([^\]]*)\]\s*$/)
    let postponed = false
    if (note) { away = note[1]; postponed = /postpon|cancel|abandon/i.test(note[2]) }

    const home = m[2].trim()
    away = away.trim()
    if (!home || !away) continue
    out.push({ matchday, date: postponed ? null : date, time: postponed ? null : time, home, away, played })
  }
  return out
}

export interface MappingCheck {
  ok: boolean
  mapped: Map<string, string>
  unmapped: string[]
  unused: string[]
  collisions: string[]
}

/**
 * Does every club in the calendar correspond to exactly one club of ours, and
 * the other way round? Anything less and the calendar is not safe to import.
 */
export function checkMapping(calendarClubs: string[], ourClubs: string[]): MappingCheck {
  const known = new Set(ourClubs)
  const mapped = new Map<string, string>()
  const unmapped: string[] = []
  for (const c of calendarClubs) {
    const n = clubName(c, known)
    if (known.has(n)) mapped.set(c, n)
    else unmapped.push(c)
  }
  const seen = new Map<string, string[]>()
  for (const [from, to] of mapped) seen.set(to, [...(seen.get(to) ?? []), from])
  const collisions = [...seen.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([to, v]) => `${to} ← ${v.join(' + ')}`)
  const unused = ourClubs.filter((o) => !seen.has(o))
  return { ok: !unmapped.length && !collisions.length && !unused.length, mapped, unmapped, unused, collisions }
}
