# Stjórnborðið (/stjornbord)

Second screen fyrir NFL-sunnudaga. Elias samþykkti hönnunina 17. okt 2026.

## Ákvarðanir Eliasar
- Fantasy-lið: velja leikmenn sjálfur, eða skjáskot af liðinu sem Claude les.
- Rauntímagögn: aðeins api-sports (engin óopinber ESPN-gögn).
- Vistun: á tækinu strax, samstillt við aðganginn ef innskráður.
- Hápunktar: YouTube-myndbönd NFL, spiluð á síðunni.

## Gögn
- **Skor og atburðir:** núverandi `/api/nfl/live` (óbreytt, nema kvótinn).
- **Tölfræði í leik:** nýtt `/api/nfl/live/stats`. Fyrir hvern leik í gangi eða nýlokinn:
  `/games/statistics/players?id=` (leikmenn beggja liða) og `/games/statistics/teams?id=`
  (rauða svæðið: `red_zone.made_att`). Tvær fyrirspurnir á leik í hverri umferð.
- **Kvóti:** 7.000 á dag skiptast: `NFL_LIVE_BUDGET` (4.500) fyrir skor og atburði,
  `NFL_STATS_BUDGET` (2.500) fyrir tölfræði. `planInterval` fær kostnað á umferð
  (fast + á leik). Tölfræði uppfærist í fyrsta lagi á 60 s fresti.
- **Leikmenn:** api-sports hefur sín eigin auðkenni; leikmenn eru paraðir við `nfl_players`
  eftir nafni (staðlað: lágstafir, án greinarmerkja og Jr./III) og liði.
- **Hápunktar:** YouTube RSS opinberu NFL-rásarinnar, skyndiminni 10 mín, síað eftir liðum
  í titlinum. Spilað með youtube-nocookie.

## Fantasy-stig
Staðlað: 1 á hverja 25 sendingajarda, 4 á snertimarkssendingu, −2 á hlerun, 1 á hverja 10
hlaupa-/gripjarda, 6 á snertimark, −2 á tapaðan bolta, 2 á tveggja stiga breytingu.
PPR +1 á grip, hálft PPR +0,5. Spá fyrir þá sem eiga eftir að spila: meðalstig í leik á
tímabilinu.

## Veðmálatrackerinn
Leggir: sigur liðs, snertimark leikmanns, leikmaður yfir X jördum (sendingar, hlaup, grip).
Staða hvers leggs: vinnur / tapar / óráðið, úr skori og tölfræði í beinni. Seðlar koma með
"Fylgjast með" á Veðmálunum eða eru búnir til í stjórnborðinu.

## Einingar
Leikir í beinni, Rauða svæðið (ferðir og snertimörk, jöfnustu leikirnir í lokin, RedZone á
Sýn Sport 3), Stigaveitan, Fantasy, Veðmál, Hápunktar, Liðið mitt, Í sjónvarpinu núna,
Spáleikurinn, Niðurtalning. Hver eining getur verið mjó eða breið; röðun með drætti
(örvar á síma).

## Geymsla
- `localStorage` `nfl:stjornbord` (uppsetning, fantasy-lið, seðlar).
- Tafla `nfl_dashboard` (016): ein röð á notanda, RLS: aðeins eigandinn les og skrifar.
- Skjáskot: aðeins innskráðir, 10 á dag (`nfl_fantasy_shot`, kvóti í RLS-reglu).
