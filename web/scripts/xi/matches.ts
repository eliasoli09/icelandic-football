/**
 * The famous matches the lineup game is built from. Each points at two
 * independent sources: KSÍ or a Wikipedia article for the eleven, and
 * Transfermarkt, found through a club's fixture list on the match date.
 *
 * The blurb must not name anyone who started, and says only what the results
 * already on this site confirm.
 */
export interface MatchSpec {
  id: string
  region: 'island' | 'enska' | 'evropa'
  date: string
  competition: string
  stage: string
  blurb: string
  /** team names as shown, in the order the primary source lists them */
  names: { home: string; away: string }
  icelandic: ('home' | 'away')[]
  ksi?: number
  wiki?: string
  /** a club on the fixture list of which the match appears on Transfermarkt */
  tm: { slug: string; id: number }
  /** shirt colours where Wikipedia shows no kit */
  colors?: { home?: string; away?: string }
  /** the word to guess where the surname is not what the player is known by, "home:13" */
  words?: Record<string, string>
  /** one person under two names in the two sources, written out rather than guessed */
  aliases?: [string, string][]
}

export const MATCHES: MatchSpec[] = [
  {
    id: 'fh-stjarnan-2014', region: 'island', date: '2014-10-04',
    competition: 'Pepsi-deild karla 2014', stage: 'Lokaumferð',
    blurb: 'Lokaumferðin réð úrslitum um titilinn. Sigurliðið varð Íslandsmeistari.',
    names: { home: 'FH', away: 'Stjarnan' }, icelandic: ['home', 'away'],
    ksi: 621734, tm: { slug: 'fh-hafnarfjordur', id: 1185 },
  },
  {
    id: 'vikingur-breidablik-2024', region: 'island', date: '2024-10-27',
    competition: 'Besta deild karla 2024', stage: 'Lokaumferð',
    blurb: 'Tvö efstu liðin mættust í síðasta leik tímabilsins. Sigurliðið varð Íslandsmeistari.',
    names: { home: 'Víkingur R.', away: 'Breiðablik' }, icelandic: ['home', 'away'],
    ksi: 685211, tm: { slug: 'breidablik-kopavogur', id: 3737 },
  },
  {
    id: 'bikar-2019', region: 'island', date: '2019-09-14',
    competition: 'Bikarkeppni karla 2019', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'Víkingur R.', away: 'FH' }, icelandic: ['home', 'away'],
    ksi: 641157, tm: { slug: 'fh-hafnarfjordur', id: 1185 },
  },
  {
    id: 'bikar-2023', region: 'island', date: '2023-09-16',
    competition: 'Bikarkeppni karla 2023', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'Víkingur R.', away: 'KA' }, icelandic: ['home', 'away'],
    ksi: 640403, tm: { slug: 'vikingur-reykjavik', id: 5849 },
    aliases: [['Rodrigo Gomes Mateo', 'Rodri']], words: { 'away:4': 'RODRI', 'home:10': 'PUNYED' },
  },
  {
    id: 'bikar-2024', region: 'island', date: '2024-09-21',
    competition: 'Bikarkeppni karla 2024', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'KA', away: 'Víkingur R.' }, icelandic: ['home', 'away'],
    ksi: 639352, tm: { slug: 'vikingur-reykjavik', id: 5849 },
    aliases: [['Rodrigo Gomes Mateo', 'Rodri']], words: { 'home:4': 'RODRI' },
  },
  {
    id: 'england-island-2016', region: 'island', date: '2016-06-27',
    competition: 'EM 2016', stage: '16 liða úrslit',
    blurb: 'Fyrsta stórmót Íslands. Sigurliðið fór í 8 liða úrslit.',
    names: { home: 'England', away: 'Ísland' }, icelandic: ['away'],
    wiki: 'UEFA Euro 2016 knockout stage', tm: { slug: 'island', id: 3574 },
    colors: { home: '#f4f4f4', away: '#1f4fa0' },
  },
  {
    id: 'argentina-island-2018', region: 'island', date: '2018-06-16',
    competition: 'HM 2018', stage: 'Riðlakeppni',
    blurb: 'Fyrsti leikur Íslands á heimsmeistaramóti.',
    names: { home: 'Argentína', away: 'Ísland' }, icelandic: ['away'],
    wiki: '2018 FIFA World Cup Group D', tm: { slug: 'island', id: 3574 },
    colors: { home: '#75aadb' },
  },
  {
    id: 'liverpool-milan-2005', region: 'evropa', date: '2005-05-25',
    competition: 'Meistaradeild Evrópu 2004/05', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Istanbúl.',
    names: { home: 'AC Milan', away: 'Liverpool' }, icelandic: [],
    wiki: '2005 UEFA Champions League final', tm: { slug: 'fc-liverpool', id: 31 },
    // Milan played in white; the kit template's red is its striped home pattern
    colors: { home: '#ffffff' },
  },
  {
    id: 'manutd-bayern-1999', region: 'evropa', date: '1999-05-26',
    competition: 'Meistaradeild Evrópu 1998/99', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Barcelona.',
    names: { home: 'Manchester United', away: 'Bayern München' }, icelandic: [],
    wiki: '1999 UEFA Champions League final', tm: { slug: 'manchester-united', id: 985 },
  },
  {
    id: 'manutd-chelsea-2008', region: 'evropa', date: '2008-05-21',
    competition: 'Meistaradeild Evrópu 2007/08', stage: 'Úrslitaleikur',
    blurb: 'Enskur úrslitaleikur í Moskvu.',
    names: { home: 'Manchester United', away: 'Chelsea' }, icelandic: [],
    wiki: '2008 UEFA Champions League final', tm: { slug: 'manchester-united', id: 985 },
  },
  {
    id: 'tottenham-liverpool-2019', region: 'evropa', date: '2019-06-01',
    competition: 'Meistaradeild Evrópu 2018/19', stage: 'Úrslitaleikur',
    blurb: 'Enskur úrslitaleikur í Madríd.',
    names: { home: 'Tottenham', away: 'Liverpool' }, icelandic: [],
    wiki: '2019 UEFA Champions League final', tm: { slug: 'fc-liverpool', id: 31 },
    words: { 'home:7': 'SON' },
  },
  {
    id: 'barcelona-realmadrid-2011', region: 'evropa', date: '2011-04-20',
    competition: 'Spænski bikarinn 2010/11', stage: 'Úrslitaleikur',
    blurb: 'El Clásico í úrslitaleik bikarsins í Valencia.',
    names: { home: 'Barcelona', away: 'Real Madrid' }, icelandic: [],
    wiki: '2011 Copa del Rey final', tm: { slug: 'real-madrid', id: 418 },
  },
  {
    id: 'brasilia-thyskaland-2014', region: 'evropa', date: '2014-07-08',
    competition: 'HM 2014', stage: 'Undanúrslit',
    blurb: 'Undanúrslit HM 2014 í Belo Horizonte.',
    names: { home: 'Brasilía', away: 'Þýskaland' }, icelandic: [],
    wiki: 'Brazil v Germany (2014 FIFA World Cup)', tm: { slug: 'brasilien', id: 3439 },
    words: { 'home:12': 'JULIOCESAR', 'home:4': 'DAVIDLUIZ', 'home:17': 'LUIZGUSTAVO' },
    // Germany wore red and black stripes, which the kit template draws as a pattern over black
    colors: { away: '#b0122a' },
  },
  {
    id: 'argentina-frakkland-2022', region: 'evropa', date: '2022-12-18',
    competition: 'HM 2022', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur HM í Katar.',
    names: { home: 'Argentína', away: 'Frakkland' }, icelandic: [],
    wiki: '2022 FIFA World Cup final', tm: { slug: 'argentinien', id: 3437 },
    colors: { home: '#75aadb' },
  },
  {
    id: 'liverpool-westham-2006', region: 'enska', date: '2006-05-13',
    competition: 'Enski bikarinn 2005/06', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur enska bikarsins í Cardiff.',
    names: { home: 'Liverpool', away: 'West Ham' }, icelandic: [],
    wiki: '2006 FA Cup final', tm: { slug: 'fc-liverpool', id: 31 },
  },
  {
    id: 'wigan-mancity-2013', region: 'enska', date: '2013-05-11',
    competition: 'Enski bikarinn 2012/13', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur enska bikarsins á Wembley.',
    names: { home: 'Manchester City', away: 'Wigan' }, icelandic: [],
    wiki: '2013 FA Cup final', tm: { slug: 'manchester-city', id: 281 },
    colors: { home: '#6cabdd', away: '#1d59af' },
  },
  {
    id: 'mancity-qpr-2012', region: 'enska', date: '2012-05-13',
    competition: 'Enska úrvalsdeildin 2011/12', stage: 'Lokaumferð',
    blurb: 'Síðasti leikur tímabilsins á Etihad. Titillinn var í húfi.',
    names: { home: 'Manchester City', away: 'QPR' }, icelandic: [],
    wiki: 'Manchester City F.C. 3–2 Queens Park Rangers F.C.', tm: { slug: 'manchester-city', id: 281 },
    colors: { home: '#6cabdd', away: '#005cab' },
  },
]
