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
players('Ísland', 'andri-runar-bjarnason benony-andresson emil-atlason gardar-gunnlaugsson gudmundur-magnusson gylfi nokkvi-thorisson')
players('Argentína', 'aguero')
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
