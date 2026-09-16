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
  // ── bætt við 16. september 2026 ──
  {
    id: 'stjarnan-breidablik-2010', region: 'island', date: '2010-09-25',
    competition: 'Pepsi-deild karla 2010', stage: 'Lokaumferð',
    blurb: 'Lokaumferðin. Útiliðið varð Íslandsmeistari í fyrsta sinn.',
    names: { home: 'Stjarnan', away: 'Breiðablik' }, icelandic: ['home', 'away'],
    ksi: 664085, tm: { slug: 'breidablik-kopavogur', id: 3737 },
  },
  {
    id: 'vikingur-leiknir-2021', region: 'island', date: '2021-09-25',
    competition: 'Pepsi Max-deild karla 2021', stage: 'Lokaumferð',
    blurb: 'Lokaumferðin. Heimaliðið varð Íslandsmeistari.',
    names: { home: 'Víkingur R.', away: 'Leiknir R.' }, icelandic: ['home', 'away'],
    ksi: 684203, tm: { slug: 'vikingur-reykjavik', id: 5849 },
    aliases: [['Brynjar Hlöðversson', 'Brynjar Hlödvers']],
    words: { 'home:10': 'PUNYED' },
  },
  {
    id: 'bikar-2015', region: 'island', date: '2015-08-15',
    competition: 'Bikarkeppni karla 2015', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'Valur', away: 'KR' }, icelandic: ['home', 'away'],
    ksi: 639492, tm: { slug: 'valur-reykjavik', id: 1033 },
  },
  {
    id: 'bikar-2016', region: 'island', date: '2016-08-13',
    competition: 'Bikarkeppni karla 2016', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'Valur', away: 'ÍBV' }, icelandic: ['home', 'away'],
    ksi: 639415, tm: { slug: 'valur-reykjavik', id: 1033 },
    words: { 'away:6': 'PUNYED' },
  },
  {
    id: 'bikar-2017', region: 'island', date: '2017-08-12',
    competition: 'Bikarkeppni karla 2017', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'ÍBV', away: 'FH' }, icelandic: ['home', 'away'],
    ksi: 640392, tm: { slug: 'fh-hafnarfjordur', id: 1185 },
    // the sources spell the Faroese surname two ways; he is known as Kaj Leo
    aliases: [['Kaj Leo Í Bartalstovu', 'Kaj Leo í Bartalsstovu']], words: { 'home:7': 'KAJLEO', 'home:6': 'PUNYED' },
  },
  {
    id: 'bikar-2021', region: 'island', date: '2021-10-16',
    competition: 'Bikarkeppni karla 2021', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'ÍA', away: 'Víkingur R.' }, icelandic: ['home', 'away'],
    ksi: 639707, tm: { slug: 'vikingur-reykjavik', id: 5849 },
    words: { 'away:10': 'PUNYED' },
  },
  {
    id: 'bikar-2022', region: 'island', date: '2022-10-01',
    competition: 'Bikarkeppni karla 2022', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur bikarkeppninnar á Laugardalsvelli.',
    names: { home: 'FH', away: 'Víkingur R.' }, icelandic: ['home', 'away'],
    ksi: 640415, tm: { slug: 'vikingur-reykjavik', id: 5849 },
    aliases: [['Kyle Douglas Mc Lagan', 'Kyle McLagan']], words: { 'away:5': 'MCLAGAN', 'away:10': 'PUNYED' },
  },
  {
    id: 'portugal-island-2016', region: 'island', date: '2016-06-14',
    competition: 'EM 2016', stage: 'Riðlakeppni',
    blurb: 'Fyrsti leikur Íslands á stórmóti, í Saint-Étienne.',
    names: { home: 'Portúgal', away: 'Ísland' }, icelandic: ['away'],
    wiki: 'UEFA Euro 2016 Group F', tm: { slug: 'island', id: 3574 },
    words: { 'home:10': 'JOAOMARIO' },
  },
  {
    id: 'island-ungverjaland-2016', region: 'island', date: '2016-06-18',
    competition: 'EM 2016', stage: 'Riðlakeppni',
    blurb: 'Annar leikur Íslands á EM 2016, í Marseille.',
    names: { home: 'Ísland', away: 'Ungverjaland' }, icelandic: ['home'],
    wiki: 'UEFA Euro 2016 Group F', tm: { slug: 'island', id: 3574 },
  },
  {
    id: 'island-austurriki-2016', region: 'island', date: '2016-06-22',
    competition: 'EM 2016', stage: 'Riðlakeppni',
    blurb: 'Síðasti leikur riðilsins, á Stade de France.',
    names: { home: 'Ísland', away: 'Austurríki' }, icelandic: ['home'],
    wiki: 'UEFA Euro 2016 Group F', tm: { slug: 'island', id: 3574 },
  },
  {
    id: 'frakkland-island-2016', region: 'island', date: '2016-07-03',
    competition: 'EM 2016', stage: '8 liða úrslit',
    blurb: '8 liða úrslit EM 2016 á Stade de France.',
    names: { home: 'Frakkland', away: 'Ísland' }, icelandic: ['away'],
    wiki: 'UEFA Euro 2016 knockout stage', tm: { slug: 'island', id: 3574 },
  },
  {
    id: 'barcelona-manutd-2009', region: 'evropa', date: '2009-05-27',
    competition: 'Meistaradeild Evrópu 2008/09', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Róm.',
    names: { home: 'Barcelona', away: 'Manchester United' }, icelandic: [],
    wiki: '2009 UEFA Champions League final', tm: { slug: 'manchester-united', id: 985 },
    words: { 'away:13': 'PARK' },
    // Barcelona's stripes are drawn over red in the kit template
    colors: { home: '#a50044' },
  },
  {
    id: 'bayern-inter-2010', region: 'evropa', date: '2010-05-22',
    competition: 'Meistaradeild Evrópu 2009/10', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn á Santiago Bernabéu í Madríd.',
    names: { home: 'Bayern München', away: 'Inter' }, icelandic: [],
    wiki: '2010 UEFA Champions League final', tm: { slug: 'fc-bayern-munchen', id: 27 },
    words: { 'away:12': 'JULIOCESAR' },
  },
  {
    id: 'bayern-chelsea-2012', region: 'evropa', date: '2012-05-19',
    competition: 'Meistaradeild Evrópu 2011/12', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í München.',
    names: { home: 'Bayern München', away: 'Chelsea' }, icelandic: [],
    wiki: '2012 UEFA Champions League final', tm: { slug: 'fc-chelsea', id: 631 },
    words: { 'away:4': 'DAVIDLUIZ', 'away:12': 'MIKEL' },
  },
  {
    id: 'realmadrid-atletico-2014', region: 'evropa', date: '2014-05-24',
    competition: 'Meistaradeild Evrópu 2013/14', stage: 'Úrslitaleikur',
    blurb: 'Tvö lið frá Madríd mættust í úrslitaleiknum í Lissabon.',
    names: { home: 'Real Madrid', away: 'Atlético Madrid' }, icelandic: [],
    wiki: '2014 UEFA Champions League final', tm: { slug: 'real-madrid', id: 418 },
    words: { 'away:3': 'FILIPELUIS' },
    // Atlético's red and white stripes, drawn over white in the kit template
    colors: { away: '#cb3524' },
  },
  {
    id: 'juventus-realmadrid-2017', region: 'evropa', date: '2017-06-03',
    competition: 'Meistaradeild Evrópu 2016/17', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Cardiff.',
    names: { home: 'Juventus', away: 'Real Madrid' }, icelandic: [],
    wiki: '2017 UEFA Champions League final', tm: { slug: 'real-madrid', id: 418 },
    words: { 'home:12': 'ALEXSANDRO' },
    // Juventus's black and white stripes, which the template draws over white like Real's shirt
    colors: { home: '#222222' },
  },
  {
    id: 'realmadrid-liverpool-2018', region: 'evropa', date: '2018-05-26',
    competition: 'Meistaradeild Evrópu 2017/18', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Kænugarði.',
    names: { home: 'Real Madrid', away: 'Liverpool' }, icelandic: [],
    wiki: '2018 UEFA Champions League final', tm: { slug: 'fc-liverpool', id: 31 },
  },
  {
    id: 'liverpool-realmadrid-2022', region: 'evropa', date: '2022-05-28',
    competition: 'Meistaradeild Evrópu 2021/22', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn á Stade de France.',
    names: { home: 'Liverpool', away: 'Real Madrid' }, icelandic: [],
    wiki: '2022 UEFA Champions League final', tm: { slug: 'fc-liverpool', id: 31 },
    words: { 'home:6': 'THIAGO', 'away:20': 'VINICIUS' },
  },
  {
    id: 'mancity-inter-2023', region: 'evropa', date: '2023-06-10',
    competition: 'Meistaradeild Evrópu 2022/23', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikurinn í Istanbúl.',
    names: { home: 'Manchester City', away: 'Inter' }, icelandic: [],
    wiki: '2023 UEFA Champions League final', tm: { slug: 'manchester-city', id: 281 },
  },
  {
    id: 'realmadrid-barcelona-2014', region: 'evropa', date: '2014-04-15',
    competition: 'Spænski bikarinn 2013/14', stage: 'Úrslitaleikur',
    blurb: 'El Clásico í úrslitaleik bikarsins í Valencia.',
    names: { home: 'Real Madrid', away: 'Barcelona' }, icelandic: [],
    wiki: '2014 Copa del Rey final', tm: { slug: 'real-madrid', id: 418 },
  },
  {
    id: 'thyskaland-argentina-2014', region: 'evropa', date: '2014-07-13',
    competition: 'HM 2014', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur HM á Maracanã í Rio de Janeiro.',
    names: { home: 'Þýskaland', away: 'Argentína' }, icelandic: [],
    wiki: '2014 FIFA World Cup final', tm: { slug: 'argentinien', id: 3437 },
  },
  {
    id: 'frakkland-kroatia-2018', region: 'evropa', date: '2018-07-15',
    competition: 'HM 2018', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur HM í Moskvu.',
    names: { home: 'Frakkland', away: 'Króatía' }, icelandic: [],
    wiki: '2018 FIFA World Cup final', tm: { slug: 'frankreich', id: 3377 },
  },
  {
    id: 'holland-spann-2010', region: 'evropa', date: '2010-07-11',
    competition: 'HM 2010', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur HM í Jóhannesarborg.',
    names: { home: 'Holland', away: 'Spánn' }, icelandic: [],
    wiki: '2010 FIFA World Cup final', tm: { slug: 'spanien', id: 3375 },
  },
  {
    id: 'portugal-frakkland-2016', region: 'evropa', date: '2016-07-10',
    competition: 'EM 2016', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur EM á Stade de France.',
    names: { home: 'Portúgal', away: 'Frakkland' }, icelandic: [],
    wiki: 'UEFA Euro 2016 final', tm: { slug: 'frankreich', id: 3377 },
    words: { 'home:10': 'JOAOMARIO' },
  },
  {
    id: 'italia-england-2021', region: 'evropa', date: '2021-07-11',
    competition: 'EM 2020', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur EM á Wembley, ári síðar en til stóð.',
    names: { home: 'Ítalía', away: 'England' }, icelandic: [],
    wiki: 'UEFA Euro 2020 final', tm: { slug: 'england', id: 3299 },
    words: { 'home:13': 'EMERSON' },
  },
  {
    id: 'spann-england-2024', region: 'evropa', date: '2024-07-14',
    competition: 'EM 2024', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur EM í Berlín.',
    names: { home: 'Spánn', away: 'England' }, icelandic: [],
    wiki: 'UEFA Euro 2024 final', tm: { slug: 'england', id: 3299 },
  },
  {
    id: 'mancity-manutd-2023', region: 'enska', date: '2023-06-03',
    competition: 'Enski bikarinn 2022/23', stage: 'Úrslitaleikur',
    blurb: 'Manchester-slagur í úrslitaleik enska bikarsins á Wembley.',
    names: { home: 'Manchester City', away: 'Manchester United' }, icelandic: [],
    wiki: '2023 FA Cup final', tm: { slug: 'manchester-city', id: 281 },
  },
  {
    id: 'mancity-manutd-2024', region: 'enska', date: '2024-05-25',
    competition: 'Enski bikarinn 2023/24', stage: 'Úrslitaleikur',
    blurb: 'Manchester-slagur í úrslitaleik enska bikarsins á Wembley.',
    names: { home: 'Manchester City', away: 'Manchester United' }, icelandic: [],
    wiki: '2024 FA Cup final', tm: { slug: 'manchester-city', id: 281 },
  },
  {
    id: 'manutd-newcastle-1999', region: 'enska', date: '1999-05-22',
    competition: 'Enski bikarinn 1998/99', stage: 'Úrslitaleikur',
    blurb: 'Úrslitaleikur enska bikarsins á gamla Wembley.',
    names: { home: 'Manchester United', away: 'Newcastle' }, icelandic: [],
    wiki: '1999 FA Cup final', tm: { slug: 'manchester-united', id: 985 },
  },
  {
    id: 'liverpool-arsenal-1989', region: 'enska', date: '1989-05-26',
    competition: 'Efsta deild Englands 1988/89', stage: 'Síðasti leikur tímabilsins',
    blurb: 'Síðasti leikur tímabilsins á Anfield. Titillinn var í húfi.',
    names: { home: 'Liverpool', away: 'Arsenal' }, icelandic: [],
    wiki: 'Liverpool 0–2 Arsenal (1989)', tm: { slug: 'fc-liverpool', id: 31 },
  },
]
