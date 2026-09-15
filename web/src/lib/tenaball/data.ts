import existing from '../topp10/lists/evropa-titlar.json'

export interface Club { id: string; label: string; accept: string[] }
export interface Question { id: string; title: string; question: string; clubIds: string[]; source: string; verifiedAt: string; cutoff: string }

// Resolve inherited spellings by club name, never by a changing ranking position.
const inheritedClub = (id: string, label: string): Club => ({
  id, label, accept: existing.answers.find(a => a.label === label)?.accept ?? [label],
})
export const CLUBS: Club[] = [
  inheritedClub('real-madrid', 'Real Madrid'),
  inheritedClub('ac-milan', 'AC Milan'),
  inheritedClub('bayern-munchen', 'Bayern München'),
  inheritedClub('liverpool', 'Liverpool'),
  inheritedClub('barcelona', 'Barcelona'),
  inheritedClub('ajax', 'Ajax'),
  inheritedClub('inter', 'Inter'),
  inheritedClub('manchester-united', 'Manchester United'),
  inheritedClub('juventus', 'Juventus'),
  inheritedClub('benfica', 'Benfica'),
  inheritedClub('chelsea', 'Chelsea'),
  inheritedClub('paris-saint-germain', 'Paris Saint-Germain'),
  inheritedClub('nottingham-forest', 'Nottingham Forest'),
  inheritedClub('porto', 'Porto'),
  { id: 'borussia-dortmund', label: 'Borussia Dortmund', accept: ['borussia dortmund', 'dortmund', 'bvb'] },
  { id: 'celtic', label: 'Celtic', accept: ['celtic', 'celtic fc', 'glasgow celtic'] },
  { id: 'hamburg', label: 'Hamburg', accept: ['hamburg', 'hamburger sv', 'hsv'] },
  { id: 'marseille', label: 'Marseille', accept: ['marseille', 'olympique de marseille', 'om'] },
  { id: 'steaua-bucuresti', label: 'Steaua București', accept: ['steaua bucuresti', 'steaua bucharest', 'steaua'] },
  { id: 'aston-villa', label: 'Aston Villa', accept: ['aston villa', 'aston villa fc'] },
  { id: 'crvena-zvezda', label: 'Crvena Zvezda', accept: ['crvena zvezda', 'red star belgrade', 'rauða stjarnan'] },
  { id: 'feyenoord', label: 'Feyenoord', accept: ['feyenoord', 'feyenoord rotterdam'] },
  { id: 'psv-eindhoven', label: 'PSV Eindhoven', accept: ['psv eindhoven', 'psv'] },
  { id: 'manchester-city', label: 'Manchester City', accept: ['manchester city', 'man city', 'mcfc'] },
]
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map(c => [c.id, c]))

// Complete eligibility sets, checked against UEFA's honours board on 2026-09-15.
// The closed 2025/26 season is the cutoff, so later results cannot silently change a round.
const provenance = {
  source: 'https://www.uefa.com/news/0275-1541637ad1db-88aeeefefefd-1000--all-time-honours-board/',
  verifiedAt: '2026-09-15', cutoff: '2025/26',
}
export const QUESTIONS: Question[] = [
  { id: 'european-champions-2026', title: 'Evrópumeistarar', question: 'Nefndu 10 félög sem hafa unnið Evrópukeppni meistaraliða eða Meistaradeildina.', clubIds: CLUBS.map(c => c.id), ...provenance },
  { id: 'champions-league-era-2026', title: 'Nýtt nafn. Sömu draumar.', question: 'Nefndu 10 félög sem hafa unnið Meistaradeildina frá og með tímabilinu 1992/93.', clubIds: ['real-madrid', 'barcelona', 'ac-milan', 'bayern-munchen', 'chelsea', 'liverpool', 'manchester-united', 'paris-saint-germain', 'juventus', 'ajax', 'borussia-dortmund', 'inter', 'marseille', 'porto', 'manchester-city'], ...provenance },
  { id: 'both-eras-2026', title: 'Meistarar tveggja tímabila', question: 'Nefndu 10 félög sem hafa unnið bæði Evrópukeppni meistaraliða fyrir 1992/93 og Meistaradeildina frá 1992/93.', clubIds: ['real-madrid', 'barcelona', 'ac-milan', 'bayern-munchen', 'liverpool', 'manchester-united', 'juventus', 'ajax', 'inter', 'porto'], ...provenance },
]
