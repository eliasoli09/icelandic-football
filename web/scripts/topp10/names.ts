/**
 * Every spelling of a club or player that a Topp 10 source uses, tied to one
 * identity. Sources are matched against these exactly after normalising; a
 * name that is not here stops its list instead of being guessed at.
 *
 * `names` are spellings found in the sources and also accepted as answers.
 * `extra` are what people type that no source uses.
 */
export interface Entity {
  id: string
  label: string
  names: string[]
  extra?: string[]
  /** for a hint, after "Félag frá" */
  country?: string
}

const club = (id: string, label: string, names: string[] = [], extra: string[] = [], country?: string): Entity =>
  ({ id, label, names, extra, country })

export const CLUBS: Entity[] = [
  // Ísland
  club('kr', 'KR', [], ['Knattspyrnufélag Reykjavíkur']),
  club('valur', 'Valur'),
  club('fram', 'Fram'),
  club('ia', 'ÍA', [], ['Akranes', 'Skaginn']),
  club('fh', 'FH', [], ['Fimleikafélag Hafnarfjarðar']),
  club('vikingur', 'Víkingur R.', ['Víkingur', 'Víkingur Reykjavík'], ['Víkingur Reykjavik']),
  club('keflavik', 'Keflavík'),
  club('ibv', 'ÍBV', [], ['Eyjamenn']),
  club('breidablik', 'Breiðablik', [], ['Blikar']),
  club('ka', 'KA'),
  club('stjarnan', 'Stjarnan'),
  club('fylkir', 'Fylkir'),
  club('hk', 'HK'),
  club('vestri', 'Vestri'),
  club('afturelding', 'Afturelding'),

  // England
  club('arsenal', 'Arsenal', [], [], 'Englandi'),
  club('astonvilla', 'Aston Villa', [], ['Villa'], 'Englandi'),
  club('bournemouth', 'Bournemouth', [], ['AFC Bournemouth']),
  club('brentford', 'Brentford'),
  club('brighton', 'Brighton & Hove Albion', ['Brighton'], ['Brighton and Hove Albion']),
  club('burnley', 'Burnley'),
  club('chelsea', 'Chelsea', ['Chelsea FC'], [], 'Englandi'),
  club('palace', 'Crystal Palace', [], ['Palace']),
  club('everton', 'Everton'),
  club('fulham', 'Fulham'),
  club('ipswich', 'Ipswich Town', ['Ipswich']),
  club('leicester', 'Leicester City', ['Leicester']),
  club('liverpool', 'Liverpool', ['Liverpool FC'], [], 'Englandi'),
  club('luton', 'Luton Town', ['Luton']),
  club('mancity', 'Manchester City', ['Man City'], [], 'Englandi'),
  club('manutd', 'Manchester United', ['Man United'], ['Man Utd'], 'Englandi'),
  club('newcastle', 'Newcastle United', ['Newcastle']),
  club('forest', 'Nottingham Forest', ["Nott'm Forest"], ['Forest'], 'Englandi'),
  club('sheffutd', 'Sheffield United', [], ['Sheffield Utd']),
  club('southampton', 'Southampton'),
  club('tottenham', 'Tottenham Hotspur', ['Tottenham'], ['Spurs'], 'Englandi'),
  club('westham', 'West Ham United', ['West Ham']),
  club('wolves', 'Wolverhampton Wanderers', ['Wolves']),
  club('leeds', 'Leeds United', ['Leeds']),
  club('sunderland', 'Sunderland'),
  club('birmingham', 'Birmingham City', ['Birmingham']),
  club('blackburn', 'Blackburn Rovers', ['Blackburn']),
  club('bolton', 'Bolton Wanderers', ['Bolton']),
  club('hull', 'Hull City', ['Hull']),
  club('portsmouth', 'Portsmouth'),
  club('stoke', 'Stoke City', ['Stoke']),
  club('wigan', 'Wigan Athletic', ['Wigan']),

  // Evrópa
  club('realmadrid', 'Real Madrid', [], [], 'Spáni'),
  club('milan', 'AC Milan', ['Milan'], [], 'Ítalíu'),
  club('bayern', 'Bayern München', ['Bayern Munich'], ['Bayern', 'FC Bayern'], 'Þýskalandi'),
  club('barcelona', 'Barcelona', ['FC Barcelona'], ['Barça'], 'Spáni'),
  club('ajax', 'Ajax', ['Ajax Amsterdam', 'Ajax FC'], [], 'Hollandi'),
  club('inter', 'Inter', ['Inter Milan'], ['Internazionale', 'Inter Mílanó'], 'Ítalíu'),
  club('juventus', 'Juventus', [], ['Juve'], 'Ítalíu'),
  club('benfica', 'Benfica', [], [], 'Portúgal'),
  club('psg', 'Paris Saint-Germain', [], ['PSG', 'Paris SG'], 'Frakklandi'),
  club('porto', 'Porto', ['FC Porto'], [], 'Portúgal'),
  club('dortmund', 'Borussia Dortmund', [], ['Dortmund'], 'Þýskalandi'),
  club('celtic', 'Celtic', ['Glasgow Celtic'], [], 'Skotlandi'),
  club('hamburg', 'Hamburger SV', ['Hamburg'], ['HSV'], 'Þýskalandi'),
  club('feyenoord', 'Feyenoord', [], [], 'Hollandi'),
  club('psv', 'PSV Eindhoven', [], ['PSV'], 'Hollandi'),
  club('redstar', 'Rauða stjarnan', ['Red Star Belgrade', 'Rauða stjarnan Belgrad'], ['Crvena zvezda'], 'Serbíu'),
  club('steaua', 'Steaua Búkarest', ['FCSB', 'Steaua București', 'Steaua Bucharest'], ['Steaua'], 'Rúmeníu'),
  club('marseille', 'Marseille', ['Olympique de Marseille'], [], 'Frakklandi'),
  club('atletico', 'Atlético Madrid', [], ['Atlético'], 'Spáni'),
  club('sevilla', 'Sevilla', ['Sevilla FC'], [], 'Spáni'),
  club('villarreal', 'Villarreal', ['Villarreal CF', 'Villareal CF'], [], 'Spáni'),
  club('frankfurt', 'Eintracht Frankfurt', [], ['Frankfurt', 'Eintracht'], 'Þýskalandi'),
  club('atalanta', 'Atalanta', ['Atalanta BC'], [], 'Ítalíu'),
]

const person = (id: string, label: string, names: string[] = [], extra: string[] = []): Entity =>
  ({ id, label, names, extra })

export const PEOPLE: Entity[] = [
  // Besta deild
  person('gardar-gunnlaugsson', 'Garðar Gunnlaugsson'),
  person('andri-runar-bjarnason', 'Andri Rúnar Bjarnason'),
  person('patrick-pedersen', 'Patrick Pedersen', ['Patrik Pedersen']),
  person('gary-martin', 'Gary Martin'),
  person('steven-lennon', 'Steven Lennon'),
  person('nikolaj-hansen', 'Nikolaj Hansen'),
  person('nokkvi-thorisson', 'Nökkvi Þeyr Þórisson', ['Nökkvi Þórisson']),
  person('gudmundur-magnusson', 'Guðmundur Magnússon'),
  person('emil-atlason', 'Emil Atlason'),
  person('benony-andresson', 'Benoný Breki Andrésson'),

  // Premier League — FPL spells some players out in full
  person('haaland', 'Erling Haaland', [], ['Erling Braut Haaland']),
  person('palmer', 'Cole Palmer'),
  person('isak', 'Alexander Isak'),
  person('foden', 'Phil Foden'),
  person('solanke', 'Dominic Solanke'),
  person('watkins', 'Ollie Watkins'),
  person('salah', 'Mohamed Salah', [], ['Mo Salah']),
  person('son', 'Son Heung-min', [], ['Son', 'Heung-min Son']),
  person('bowen', 'Jarrod Bowen'),
  person('mateta', 'Jean-Philippe Mateta'),
  person('saka', 'Bukayo Saka'),
  person('mbeumo', 'Bryan Mbeumo'),
  person('wood', 'Chris Wood'),
  person('wissa', 'Yoane Wissa'),
  person('cunha', 'Matheus Cunha', ['Matheus Santos Carneiro Da Cunha']),
  person('strand-larsen', 'Jørgen Strand Larsen', [], ['Strand Larsen']),
  person('igor-thiago', 'Igor Thiago', ['Igor Thiago Nascimento Rodrigues']),
  person('semenyo', 'Antoine Semenyo'),
  person('gibbs-white', 'Morgan Gibbs-White'),
  person('joao-pedro', 'João Pedro', ['João Pedro Junqueira de Jesus']),
  person('calvert-lewin', 'Dominic Calvert-Lewin'),
  person('gyokeres', 'Viktor Gyökeres'),
  person('kroupi', 'Eli Junior Kroupi', ['Junior Kroupi']),
  person('welbeck', 'Danny Welbeck'),

  // Meistaradeildin
  person('ronaldo', 'Cristiano Ronaldo', [], ['CR7']),
  person('messi', 'Lionel Messi'),
  person('lewandowski', 'Robert Lewandowski'),
  person('benzema', 'Karim Benzema'),
  person('mbappe', 'Kylian Mbappé'),
  person('raul', 'Raúl', [], ['Raúl González']),
  person('muller', 'Thomas Müller'),
  person('van-nistelrooy', 'Ruud van Nistelrooy', [], ['Van Nistelrooy']),
  person('kane', 'Harry Kane'),
  person('henry', 'Thierry Henry'),
]
