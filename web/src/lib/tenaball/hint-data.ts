/**
 * Stable geographical / international football identities, shared across seasons.
 * Player nationality means the national team represented (not birthplace).
 * Season clubs come from each question's verified answer.detail; Iceland's
 * Golden Boot clubs are recorded separately below. Keep these out of generated
 * lists so scripts/topp10/build.mts cannot overwrite them.
 */
export const CLUB_HINTS: Record<string, { country: string; city: string }> = {}
const clubs = (country: string, rows: string) => {
  for (const row of rows.trim().split('\n')) {
    const [id, city] = row.split('|')
    CLUB_HINTS[id] = { country, city }
  }
}
clubs('Ísland', `afturelding|Mosfellsbær
breidablik|Kópavogur
fh|Hafnarfjörður
fram|Reykjavík
fylkir|Reykjavík
hk|Kópavogur
ia|Akranes
iba|Akureyri
ibv|Vestmannaeyjar
ka|Akureyri
keflavik|Reykjanesbær
kr|Reykjavík
leiknir|Reykjavík
stjarnan|Garðabær
thor|Akureyri
valur|Reykjavík
vestri|Ísafjörður
vikingur|Reykjavík`)
clubs('England', `arsenal|London
astonvilla|Birmingham
birmingham|Birmingham
blackburn|Blackburn
bournemouth|Bournemouth
brentford|London
brighton|Brighton og Hove
bristolcity|Bristol
burnley|Burnley
chelsea|London
coventry|Coventry
derby|Derby
everton|Liverpool
forest|Nottingham
fulham|London
hull|Kingston upon Hull
ipswich|Ipswich
leeds|Leeds
leicester|Leicester
liverpool|Liverpool
mancity|Manchester
manutd|Manchester
middlesbrough|Middlesbrough
millwall|London
newcastle|Newcastle upon Tyne
norwich|Norwich
palace|London
sheffutd|Sheffield
southampton|Southampton
stoke|Stoke-on-Trent
sunderland|Sunderland
tottenham|London
westbrom|West Bromwich
westham|London
wolves|Wolverhampton`)
clubs('Wales', `swansea|Swansea
wrexham|Wrexham`)
clubs('Spánn', `alaves|Vitoria-Gasteiz
athletic|Bilbao
atletico|Madrid
barcelona|Barcelona
betis|Sevilla
celta|Vigo
getafe|Getafe
girona|Girona
mallorca|Palma
osasuna|Pamplona
rayo|Madrid
realmadrid|Madrid
sociedad|San Sebastián
valencia|Valencia
villarreal|Vila-real`)
clubs('Þýskaland', `augsburg|Augsburg
bayern|München
bremen|Bremen
dortmund|Dortmund
frankfurt|Frankfurt am Main
freiburg|Freiburg im Breisgau
gladbach|Mönchengladbach
hamburg|Hamburg
heidenheim|Heidenheim an der Brenz
hoffenheim|Sinsheim
leipzig|Leipzig
leverkusen|Leverkusen
mainz|Mainz
stuttgart|Stuttgart
union|Berlín
wolfsburg|Wolfsburg`)
clubs('Ítalía', `atalanta|Bergamo
bologna|Bologna
como|Como
fiorentina|Flórens
inter|Mílanó
juventus|Tórínó
lazio|Róm
milan|Mílanó
napoli|Napólí
roma|Róm
torino|Tórínó
udinese|Udine`)
clubs('Frakkland', `brest|Brest
clermont|Clermont-Ferrand
lens|Lens
lille|Lille
lorient|Lorient
lyon|Lyon
marseille|Marseille
nice|Nice
psg|París
reims|Reims
rennes|Rennes
strasbourg|Strasbourg
toulouse|Toulouse`)
clubs('Mónakó', 'monaco|Mónakó')
clubs('Holland', `ajax|Amsterdam
feyenoord|Rotterdam
psv|Eindhoven`)
clubs('Portúgal', `benfica|Lissabon
porto|Porto`)
clubs('Skotland', 'celtic|Glasgow')
clubs('Rúmenía', 'steaua|Búkarest')
clubs('Serbía', 'redstar|Belgrad')

export const PLAYER_COUNTRIES: Record<string, string> = {}
const players = (country: string, ids: string) => {
  for (const id of ids.split(' ')) PLAYER_COUNTRIES[id] = country
}
players('England', 'alli bamford bowen callum-wilson calvert-lewin defoe foden gary-martin gibbs-white ings kane murray palmer rashford saka solanke sterling toney vardy watkins welbeck')
players('Ísland', 'andri-runar-bjarnason aron-gunnarsson benony-andresson birkir-bjarnason birkir-mar-saevarsson eidur emil-atlason gardar-gunnlaugsson gudmundur-magnusson gylfi hermann-hreidarsson johann-berg kari-arnason nokkvi-thorisson ragnar-sigurdsson runar-kristinsson')
players('Argentína', 'aguero messi')
players('Gabon', 'aubameyang')
players('Belgía', 'benteke de-bruyne hazard lukaku')
players('Portúgal', 'bruno-fernandes jota ronaldo')
players('Spánn', 'diego-costa llorente')
players('Þýskaland', 'gundogan')
players('Svíþjóð', 'gyokeres ibrahimovic isak')
players('Noregur', 'haaland king odegaard')
players('Brasilía', 'igor-thiago joao-pedro martinelli richarlison')
players('Mexíkó', 'jimenez')
players('Frakkland', 'kroupi lacazette martial mateta pogba')
players('Senegal', 'mane')
players('Serbía', 'mitrovic')
players('Danmörk', 'nikolaj-hansen patrick-pedersen')
players('Egyptaland', 'salah')
players('Síle', 'sanchez')
players('Gana', 'semenyo')
players('Suður-Kórea', 'son')
players('Skotland', 'steven-lennon')
players('Fílabeinsströndin', 'zaha')

/** Clubs in the Golden Boot years named in island-markakongar. */
players('Þýskaland', 'matthaus sammer')
players('Frakkland', 'papin zidane')
players('Holland', 'van-basten')
players('Ítalía', 'baggio cannavaro')
players('Búlgaría', 'stoichkov')
players('Líbería', 'weah')
players('Brasilía', 'ronaldo-nazario rivaldo ronaldinho kaka')
players('Portúgal', 'figo')
players('Tékkland', 'nedved')
players('Úkraína', 'shevchenko')


// Félög sem bættust við þegar hollenska og portúgalska deildin komu inn, ásamt
// eldri liðum úr tímabilum sem nú er spurt um.
clubs('England', `portsmouth|Portsmouth
bolton|Bolton
reading|Reading
wigan|Wigan
charlton|London
cardiff|Cardiff
lincolncity|Lincoln`)
clubs('Spánn', `elche|Elche
espanyol|Barcelona
levante|Valencia
deportivo|A Coruña
sevilla|Sevilla
granada|Granada`)
clubs('Ítalía', `cagliari|Cagliari
frosinone|Frosinone
genoa|Genúa
cremonese|Cremona
verona|Verona`)
clubs('Þýskaland', `koln|Köln`)
clubs('Frakkland', `nantes|Nantes
angers|Angers
auxerre|Auxerre
lehavre|Le Havre
lemans|Le Mans
metz|Metz`)
clubs('Holland', `az|Alkmaar
excelsior|Rotterdam
fortunasittard|Sittard
goahead|Deventer
groningen|Groningen
heerenveen|Heerenveen
heracles|Almelo
nacbreda|Breda
adodenhaag|Haag
cambuur|Leeuwarden
nec|Nijmegen
twente|Enschede
utrecht|Utrecht
spartarotterdam|Rotterdam`)
clubs('Portúgal', `sporting|Lissabon
braga|Braga
famalicao|Vila Nova de Famalicão
gilvicente|Barcelos
moreirense|Moreira de Cónegos
arouca|Arouca
vitoriaguimaraes|Guimarães
estoril|Estoril
santaclara|Ponta Delgada
casapia|Lissabon
farense|Faro
chaves|Chaves
boavista|Porto
academicoviseu|Viseu
alverca|Alverca do Ribatejo
estrela|Amadora`)

export const GOLDEN_BOOT_CLUBS: Record<string, string> = {
  'gardar-gunnlaugsson': 'ÍA',
  'andri-runar-bjarnason': 'Grindavík',
  'patrick-pedersen': 'Valur',
  'gary-martin': 'Valur / ÍBV',
  'steven-lennon': 'FH',
  'nikolaj-hansen': 'Víkingur R.',
  'nokkvi-thorisson': 'KA',
  'gudmundur-magnusson': 'Fram',
  'emil-atlason': 'Stjarnan',
  'benony-andresson': 'KR',
}

/**
 * Questions where the third hint cannot be a club of that season: what the
 * hint says, and what it says for each answer. A man with a hundred caps
 * played for many clubs, so his position is the honest hint; a Ballon d'Or
 * names the club he was at when he won it.
 *
 * Positions come from Transfermarkt's record internationals for Iceland and
 * the clubs from the winners table on en.wikipedia, the same sources the two
 * questions were verified against.
 */
export const OTHER_HINTS: Record<string, { label: string; values: Record<string, string> }> = {
  'island-landsleikir': {
    label: 'Staða',
    values: {
      'birkir-bjarnason': 'Miðjumaður',
      'aron-gunnarsson': 'Varnarsinnaður miðjumaður',
      'runar-kristinsson': 'Sóknarsinnaður miðjumaður',
      'birkir-mar-saevarsson': 'Hægri bakvörður',
      'johann-berg': 'Hægri kantmaður',
      'ragnar-sigurdsson': 'Miðvörður',
      'kari-arnason': 'Miðvörður',
      'hermann-hreidarsson': 'Vinstri bakvörður',
      'eidur': 'Framherji',
      'gylfi': 'Sóknarsinnaður miðjumaður',
    },
  },
  'evropa-gullknotturinn': {
    label: 'Félagið þegar hann vann',
    values: {
      matthaus: 'Inter',
      papin: 'Marseille',
      'van-basten': 'Milan',
      baggio: 'Juventus',
      stoichkov: 'Barcelona',
      weah: 'Milan',
      sammer: 'Borussia Dortmund',
      'ronaldo-nazario': 'Inter / Real Madrid',
      zidane: 'Juventus',
      rivaldo: 'Barcelona',
      figo: 'Real Madrid',
      owen: 'Liverpool',
      nedved: 'Juventus',
      shevchenko: 'Milan',
      ronaldinho: 'Barcelona',
      cannavaro: 'Real Madrid',
      kaka: 'Milan',
      ronaldo: 'Manchester United',
      messi: 'Barcelona',
    },
  },
}
