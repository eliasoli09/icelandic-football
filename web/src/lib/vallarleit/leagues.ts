/**
 * The leagues in Vallarleit: the top division of every UEFA association that
 * runs one (Liechtenstein's clubs play in Switzerland), plus the second tier of
 * the big five. That is more than "the top 50 leagues in Europe" under any
 * ranking - coefficient or strength - so none of them can be missing.
 *
 * `wiki` is the English Wikipedia title; the Wikidata item is read from it.
 * `size` is the expected number of clubs this season, used only as a sanity
 * check on the season Wikidata returns.
 */
export interface LeagueDef {
  key: string
  name: string
  country: string
  /** Icelandic country name, shown in the game */
  land: string
  iso: string
  wiki: string
  size: number
  tier: 1 | 2
  top5?: true
}

export const LEAGUES: LeagueDef[] = [
  { key: 'premier', name: 'Premier League', country: 'England', land: 'England', iso: 'gb-eng', wiki: 'Premier League', size: 20, tier: 1, top5: true },
  { key: 'laliga', name: 'La Liga', country: 'Spain', land: 'Spánn', iso: 'es', wiki: 'La Liga', size: 20, tier: 1, top5: true },
  { key: 'seriea', name: 'Serie A', country: 'Italy', land: 'Ítalía', iso: 'it', wiki: 'Serie A', size: 20, tier: 1, top5: true },
  { key: 'bundesliga', name: 'Bundesliga', country: 'Germany', land: 'Þýskaland', iso: 'de', wiki: 'Bundesliga', size: 18, tier: 1, top5: true },
  { key: 'ligue1', name: 'Ligue 1', country: 'France', land: 'Frakkland', iso: 'fr', wiki: 'Ligue 1', size: 18, tier: 1, top5: true },
  { key: 'championship', name: 'Championship', country: 'England', land: 'England', iso: 'gb-eng', wiki: 'EFL Championship', size: 24, tier: 2 },
  { key: 'laliga2', name: 'Segunda División', country: 'Spain', land: 'Spánn', iso: 'es', wiki: 'Segunda División', size: 22, tier: 2 },
  { key: 'serieb', name: 'Serie B', country: 'Italy', land: 'Ítalía', iso: 'it', wiki: 'Serie B', size: 20, tier: 2 },
  { key: 'bundesliga2', name: '2. Bundesliga', country: 'Germany', land: 'Þýskaland', iso: 'de', wiki: '2. Bundesliga', size: 18, tier: 2 },
  { key: 'ligue2', name: 'Ligue 2', country: 'France', land: 'Frakkland', iso: 'fr', wiki: 'Ligue 2', size: 18, tier: 2 },
  { key: 'eredivisie', name: 'Eredivisie', country: 'Netherlands', land: 'Holland', iso: 'nl', wiki: 'Eredivisie', size: 18, tier: 1 },
  { key: 'primeira', name: 'Primeira Liga', country: 'Portugal', land: 'Portúgal', iso: 'pt', wiki: 'Primeira Liga', size: 18, tier: 1 },
  { key: 'belgium', name: 'Pro League', country: 'Belgium', land: 'Belgía', iso: 'be', wiki: 'Belgian Pro League', size: 16, tier: 1 },
  { key: 'czechia', name: 'Chance Liga', country: 'Czech Republic', land: 'Tékkland', iso: 'cz', wiki: 'Czech First League', size: 16, tier: 1 },
  { key: 'turkey', name: 'Süper Lig', country: 'Turkey', land: 'Tyrkland', iso: 'tr', wiki: 'Süper Lig', size: 18, tier: 1 },
  { key: 'greece', name: 'Super League', country: 'Greece', land: 'Grikkland', iso: 'gr', wiki: 'Super League Greece', size: 14, tier: 1 },
  { key: 'poland', name: 'Ekstraklasa', country: 'Poland', land: 'Pólland', iso: 'pl', wiki: 'Ekstraklasa', size: 18, tier: 1 },
  { key: 'denmark', name: 'Superliga', country: 'Denmark', land: 'Danmörk', iso: 'dk', wiki: 'Danish Superliga', size: 12, tier: 1 },
  { key: 'norway', name: 'Eliteserien', country: 'Norway', land: 'Noregur', iso: 'no', wiki: 'Eliteserien', size: 16, tier: 1 },
  { key: 'austria', name: 'Bundesliga', country: 'Austria', land: 'Austurríki', iso: 'at', wiki: 'Austrian Football Bundesliga', size: 12, tier: 1 },
  { key: 'switzerland', name: 'Super League', country: 'Switzerland', land: 'Sviss', iso: 'ch', wiki: 'Swiss Super League', size: 12, tier: 1 },
  { key: 'scotland', name: 'Premiership', country: 'Scotland', land: 'Skotland', iso: 'gb-sct', wiki: 'Scottish Premiership', size: 12, tier: 1 },
  { key: 'sweden', name: 'Allsvenskan', country: 'Sweden', land: 'Svíþjóð', iso: 'se', wiki: 'Allsvenskan', size: 16, tier: 1 },
  { key: 'israel', name: 'Ligat HaAl', country: 'Israel', land: 'Ísrael', iso: 'il', wiki: 'Israeli Premier League', size: 14, tier: 1 },
  { key: 'cyprus', name: 'First Division', country: 'Cyprus', land: 'Kýpur', iso: 'cy', wiki: 'Cypriot First Division', size: 14, tier: 1 },
  { key: 'croatia', name: 'HNL', country: 'Croatia', land: 'Króatía', iso: 'hr', wiki: 'Croatian Football League', size: 10, tier: 1 },
  { key: 'serbia', name: 'SuperLiga', country: 'Serbia', land: 'Serbía', iso: 'rs', wiki: 'Serbian SuperLiga', size: 16, tier: 1 },
  { key: 'hungary', name: 'NB I', country: 'Hungary', land: 'Ungverjaland', iso: 'hu', wiki: 'Nemzeti Bajnokság I', size: 12, tier: 1 },
  { key: 'ukraine', name: 'Premier League', country: 'Ukraine', land: 'Úkraína', iso: 'ua', wiki: 'Ukrainian Premier League', size: 16, tier: 1 },
  { key: 'slovenia', name: 'PrvaLiga', country: 'Slovenia', land: 'Slóvenía', iso: 'si', wiki: 'Slovenian PrvaLiga', size: 10, tier: 1 },
  { key: 'romania', name: 'Superliga', country: 'Romania', land: 'Rúmenía', iso: 'ro', wiki: 'Liga I', size: 16, tier: 1 },
  { key: 'slovakia', name: 'Niké liga', country: 'Slovakia', land: 'Slóvakía', iso: 'sk', wiki: 'Slovak First Football League', size: 12, tier: 1 },
  { key: 'bulgaria', name: 'efbet Liga', country: 'Bulgaria', land: 'Búlgaría', iso: 'bg', wiki: 'First Professional Football League (Bulgaria)', size: 16, tier: 1 },
  { key: 'azerbaijan', name: 'Premyer Liqa', country: 'Azerbaijan', land: 'Aserbaísjan', iso: 'az', wiki: 'Azerbaijan Premier League', size: 12, tier: 1 },
  { key: 'kazakhstan', name: 'Premier League', country: 'Kazakhstan', land: 'Kasakstan', iso: 'kz', wiki: 'Kazakhstan Premier League', size: 14, tier: 1 },
  { key: 'russia', name: 'Premier League', country: 'Russia', land: 'Rússland', iso: 'ru', wiki: 'Russian Premier League', size: 16, tier: 1 },
  { key: 'moldova', name: 'Super Liga', country: 'Moldova', land: 'Moldóva', iso: 'md', wiki: 'Moldovan Super Liga', size: 8, tier: 1 },
  { key: 'ireland', name: 'Premier Division', country: 'Ireland', land: 'Írland', iso: 'ie', wiki: 'League of Ireland Premier Division', size: 10, tier: 1 },
  { key: 'bosnia', name: 'Premijer liga', country: 'Bosnia and Herzegovina', land: 'Bosnía', iso: 'ba', wiki: 'Premier League of Bosnia and Herzegovina', size: 10, tier: 1 },
  { key: 'iceland', name: 'Besta deild', country: 'Iceland', land: 'Ísland', iso: 'is', wiki: 'Besta deild karla', size: 12, tier: 1 },
  { key: 'finland', name: 'Veikkausliiga', country: 'Finland', land: 'Finnland', iso: 'fi', wiki: 'Veikkausliiga', size: 12, tier: 1 },
  { key: 'armenia', name: 'Premier League', country: 'Armenia', land: 'Armenía', iso: 'am', wiki: 'Armenian Premier League', size: 10, tier: 1 },
  { key: 'lithuania', name: 'A Lyga', country: 'Lithuania', land: 'Litháen', iso: 'lt', wiki: 'A Lyga', size: 10, tier: 1 },
  { key: 'latvia', name: 'Virslīga', country: 'Latvia', land: 'Lettland', iso: 'lv', wiki: 'Latvian Higher League', size: 10, tier: 1 },
  { key: 'kosovo', name: 'Superliga', country: 'Kosovo', land: 'Kósovó', iso: 'xk', wiki: 'Football Superleague of Kosovo', size: 10, tier: 1 },
  { key: 'northmacedonia', name: 'Prva Liga', country: 'North Macedonia', land: 'Norður-Makedónía', iso: 'mk', wiki: 'Macedonian First Football League', size: 12, tier: 1 },
  { key: 'malta', name: 'Premier League', country: 'Malta', land: 'Malta', iso: 'mt', wiki: 'Maltese Premier League', size: 12, tier: 1 },
  { key: 'faroe', name: 'Betri deildin', country: 'Faroe Islands', land: 'Færeyjar', iso: 'fo', wiki: 'Faroe Islands Premier League', size: 10, tier: 1 },
  { key: 'albania', name: 'Kategoria Superiore', country: 'Albania', land: 'Albanía', iso: 'al', wiki: 'Kategoria Superiore', size: 10, tier: 1 },
  { key: 'georgia', name: 'Erovnuli Liga', country: 'Georgia', land: 'Georgía', iso: 'ge', wiki: 'Erovnuli Liga', size: 10, tier: 1 },
  { key: 'belarus', name: 'Vysshaya Liga', country: 'Belarus', land: 'Hvíta-Rússland', iso: 'by', wiki: 'Belarusian Premier League', size: 16, tier: 1 },
  { key: 'luxembourg', name: 'National Division', country: 'Luxembourg', land: 'Lúxemborg', iso: 'lu', wiki: 'Luxembourg National Division', size: 16, tier: 1 },
  { key: 'montenegro', name: 'Prva CFL', country: 'Montenegro', land: 'Svartfjallaland', iso: 'me', wiki: 'Montenegrin First League', size: 10, tier: 1 },
  { key: 'northernireland', name: 'NIFL Premiership', country: 'Northern Ireland', land: 'Norður-Írland', iso: 'gb-nir', wiki: 'NIFL Premiership', size: 12, tier: 1 },
  { key: 'wales', name: 'Cymru Premier', country: 'Wales', land: 'Wales', iso: 'gb-wls', wiki: 'Cymru Premier', size: 12, tier: 1 },
  { key: 'estonia', name: 'Meistriliiga', country: 'Estonia', land: 'Eistland', iso: 'ee', wiki: 'Meistriliiga', size: 10, tier: 1 },
  { key: 'andorra', name: 'Primera Divisió', country: 'Andorra', land: 'Andorra', iso: 'ad', wiki: 'Primera Divisió', size: 10, tier: 1 },
  { key: 'gibraltar', name: 'Football League', country: 'Gibraltar', land: 'Gíbraltar', iso: 'gi', wiki: 'Gibraltar Football League', size: 11, tier: 1 },
  { key: 'sanmarino', name: 'Campionato', country: 'San Marino', land: 'San Marínó', iso: 'sm', wiki: 'Campionato Sammarinese di Calcio', size: 16, tier: 1 },
]
