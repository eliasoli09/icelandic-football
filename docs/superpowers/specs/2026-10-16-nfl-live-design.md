# NFL-miðillinn, áfangi 3: bein lýsing

Dagsetning: 16. október 2026. Grein: `nfl-live`. App: `nfl-web/`.

## Ákvarðanir Eliasar
- Gagnaveita: **API-American-Football (api-sports.io)**, byrja á ókeypis áskrift (100 fyrirspurnir
  á dag). Elias stofnar aðganginn og setur `API_SPORTS_NFL_KEY` í Vercel og `.env.local`.
- ESPN-falið API ekki notað (ekki leyft á síðu með styrktaraðila).

## Gögn
- Slóð: `https://v1.american-football.api-sports.io`, haus `x-apisports-key`, NFL = deild 1.
- `/games?league=1&season=<ár>&date=<dagur að austurtíma>&timezone=America/New_York`: hver leikur
  `{ game: { id, week, date, status: { short, long, timer } }, teams: { home, away: { id, name } },
  scores: { home, away: { quarter_1..4, overtime, total } } }`. Staðfest með `nfl-live-check.mts`
  þegar lykill er kominn (skjölunin er lokuð án lykils).
- `/games/events?id=<id>`: atvik (leikhluti, mínúta, lið, leikmaður, tegund, lýsing, staða).
- **Kvóti:** engin fyrirspurn nema leikur sé í gangi samkvæmt dagskránni okkar (frá upphafi til
  4,5 klst. eftir). Skyndiminni á þjóninum (`NFL_LIVE_INTERVAL`, sjálfgefið 480 s) svo í mesta lagi
  ein fyrirspurn á bili óháð fjölda lesenda. Atvik aðeins ef `NFL_LIVE_EVENTS=1` (Pro).
- Ekkert vistað í gagnagrunni; lokastaðan kemur úr nflverse morguninn eftir eins og áður.

## Líkur í beinni (`lib/nfl/live.ts`)
Stern (1991): lokamunur ~ N(núv. munur + forgjöf·f, 13,45²·f), f = hlutfall leiktíma eftir.
Forgjöf = forgjöf Elo-líkansins fyrir leik. Í leikslok 1 / ½ / 0.

## Síður
- `/api/nfl/live`: `{ enabled, games: [...] }`; `enabled: false` ef lykil vantar.
- Leikjasíðan: reitur í beinni (staða, leikhluti, klukka, líkur, atvik), uppfærist sjálfur.
- Forsíða og Leikir: stika "Í beinni" þegar leikur er í gangi.
- Bilun hjá veitunni eða enginn lykill: ekkert birtist, allt annað óbreytt.

## Prófanir
Þáttari á dæmi, pörun liða, tími eftir, líkur í beinni (byrjun = fyrir leik, rétt átt, 1 í lok),
glugginn sem ræður hvort fyrirspurn fer út. Útgáfa: localhost, svo "full send".
