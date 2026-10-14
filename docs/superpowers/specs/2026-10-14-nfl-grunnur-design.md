# NFL-hornið, verkefni 1: grunnur (gögn, vikan, staðan)

Dagsetning: 14. október 2026. Grein: `nfl` (worktree `/Users/elias/FH leikmenn/nfl-wt`).

## Samhengi og skipting

Elias vill NFL-horn á vefnum með sama innihaldi og fótboltinn: leiki, úrslit, stöðu,
spár og leiki. Verkinu er skipt í þrjú verkefni, hvert með eigin spec og áætlun:

1. **Grunnur** (þetta skjal): NFL-gögn inn, leikir vikunnar og úrslit, staðan.
2. **Spár**: Elo með forskoti í stigum, sigurlíkur í hverjum leik, hermun á
   úrslitakeppni og Super Bowl, mælt gegn Vegas-línum. Leikjasíða kemur hér.
3. **Leikir**: NFL-útgáfa af leik í leikjaherberginu.

NFL fær **eigið svæði á `/nfl`** og **eigin töflur**. Það fer ekki inn í `matches` eða
deildaskiptinn. Spákeðjan (`predict.ts`) byggir á Poisson-mörkum og 1X2 og á ekki við
NFL, og blöndun Elo-hópa hefur áður skemmt einkunnir (sjá Evrópukeppnirnar í
hvelfingunni).

## Orðaval

Öll NFL-hugtök eru á íslensku. Nöfn liðanna, AFC/NFC og Super Bowl standa óþýdd.
Orðasafnið er í hvelfingunni: `Besta spáin/NFL/Orðasafn.md`. Það ræður, og kóðinn
notar engin önnur orð. Helstu orðin í þessu verkefni:

| Enska | Á síðunni |
|---|---|
| conference / division | deild / riðill |
| regular season | deildarkeppni |
| Wild Card / Divisional / Conference Championship | umspil / 8 liða úrslit / undanúrslit |
| bye / seed | frí / sæti |
| division / conference record | í riðli / í deild |
| head-to-head | innbyrðis viðureignir |
| points for / against | skoruð / fengin stig |
| spread / total | forgjöf / heildarstig |
| overtime | framlenging ("framl.") |

Röðunarreglur (tiebreakers) fá **ekkert almennt heiti**. Síðan nefnir viðmiðið sem
réði, t.d. "raðað eftir innbyrðis viðureignum".

## 1. Gögn

**Heimild:** `https://github.com/nflverse/nfldata/raw/master/data/games.csv`, um 2,2 MB,
einn leikur í hverri röð frá 1999. Staðfest lifandi 14. okt 2026: 272 leikir á
tímabilinu 2026, þar af 79 spilaðir (vikur 1-5). Dálkar sem við notum: `game_id`, `season`,
`game_type`, `week`, `gameday`, `gametime`, `away_team`, `away_score`, `home_team`,
`home_score`, `location`, `overtime`, `away_moneyline`, `home_moneyline`, `spread_line`,
`total_line`, `div_game`, `roof`, `stadium`, `away_qb_name`, `home_qb_name`.

Riðlar, litir og merki liðanna eru ekki í skránni. Þau koma úr liðaskrá nflverse,
`https://github.com/nflverse/nflverse-data/releases/download/teams/teams_colors_logos.csv`
(staðfest 14. okt: 36 raðir, 32 lið auk sögulegu heitanna; riðill er á forminu
`"NFC West"` og er klofinn í `conference` + `division` við innlestur), og merkin eru vistuð í `web/public/nfl/` (gildra 26: ekki treysta
á utanaðkomandi myndaþjón).

**Tími:** `gameday` + `gametime` eru í austurtíma Bandaríkjanna. Umreiknað með
`America/New_York` (sumartími endar 1. nóv 2026) og geymt sem UTC. Ísland er á UTC
allt árið.

## 2. Töflur

Ein ný migration (`nfl_foundation`), sett upp gegnum Supabase og afrituð í
`supabase/migrations/`. Opinber lestur með RLS. Skrif aðeins gegnum RPC.

**`nfl_teams`**
- `abbr` text PK (t.d. `KC`, líka söguleg heiti eins og `OAK`, `SD`, `STL`)
- `franchise` text, núverandi skammstöfun félagsins (OAK → `LV`)
- `name` text, `conference` text (`AFC`/`NFC`), `division` text (`East`/`North`/`South`/`West`)
- `color`, `color2` text, `logo` text (slóð í `public/nfl/`)

**`nfl_games`**
- `game_id` text PK
- `season` int, `game_type` text (`REG`/`WC`/`DIV`/`CON`/`SB`), `week` int
- `kickoff` timestamptz (UTC)
- `away`, `home` text FK → `nfl_teams.abbr`
- `away_score`, `home_score` int null, `overtime` bool, `neutral` bool
- `spread_line`, `total_line` numeric, `away_ml`, `home_ml` int
- `div_game` bool, `stadium`, `roof`, `away_qb`, `home_qb` text
- `updated_at` timestamptz
- Vísir á `(season, week)`

**Skrif:** `rpc_upsert_nfl_teams(p_secret, p_rows jsonb)` og
`rpc_upsert_nfl_games(p_secret, p_rows jsonb)`. Bæði byrja á `assert_secret`, taka mest
500 raðir og eru ný föll, svo ekkert sem er til breytist (gildra 4). `rpc_upsert_nfl_games`
skrifar aldrei `null` yfir stig sem eru komin (`coalesce(excluded.x, nfl_games.x)`,
gildra 5).

## 3. Gagnaflæði

- **Eitt skipti:** `web/scripts/ingest-nfl.mts --all` les liðaskrána og alla
  leikjaskrána (um 7.300 leikir) í 500 raða skömmtum. Sagan er ekki sýnd í þessu verkefni
  en Elo í verkefni 2 þarf hana.
- **Daglega:** nýr cron `/api/cron/nfl` kl. `0 8 * * *` UTC. Hann sækir skrána, skrifar
  yfirstandandi tímabil og kallar á `revalidatePath('/nfl', 'layout')`. Hann er aðskilinn
  frá `/api/cron/ingest`, svo bilun í KSÍ-skröpunni fellir ekki NFL og öfugt.
- **Handvirkt:** `web/scripts/ingest-nfl.mts` (yfirstandandi tímabil) og svo `POST /api/refresh`.
- Sami lestrar- og skriftarkóði (`web/src/lib/nfl/ingest.ts`) er notaður bæði í cron og
  í skriftunni.

**Svar cron-sins** (vörn gegn þöglum bilunum, sbr. KSÍ-skröpuna sem skilaði
`newMatches: 0` í sex vikur): `{ season, games, newResults, warnings[] }`. Viðvaranir:
- leikur sem hófst fyrir meira en 18 klst. hefur engin stig;
- tímabilið hefur ekki 32 lið.

**Opið atriði, mælt eftir útgáfu:** hve fljótt nflverse birtir úrslit. Ef 08:00 UTC er of
snemmt færist cron-tíminn. Niðurstaðan fer í hvelfinguna.

## 4. Síðurnar

**Umgjörð:** `app/nfl/layout.tsx` setur `data-league="nfl"`. NFL fær rauðan áherslulit
(`--accent`, dökkt og ljóst þema) í `globals.css`, á sama hátt og Lengjudeildin.
Undirvalmynd: **Vikan | Staðan**. "NFL" bætist í `NAV` í `Nav.tsx` á eftir "Leikir".
Deildaskiptirinn er falinn á `/nfl/*`.

**`/nfl` - Vikan**
- Sjálfgefin vika: sú sem næsti óspilaði leikur er í. Ef enginn leikur er eftir á
  tímabilinu: síðasta vikan sem var spiluð. Fyrir fyrsta leik: vika 1.
- Flett með örvum ("← Vika 6 →"). Úrslitakeppnin birtist sem umspil, 8 liða úrslit,
  undanúrslit og Super Bowl. Valin vika er í slóðinni (`?vika=6`) svo hægt sé að deila
  henni.
- Leikir flokkaðir eftir **íslenskri dagsetningu** upphafstímans. Leikur sem hefst milli
  00:00 og 05:59 fær merkið "aðfaranótt", svo 00:15 á föstudegi sé ekki misskilið.
- Lína: **útilið @ heimalið** með merkjum.
  - Óspilaður: upphafstími, forgjöf ("DEN −2,5") og heildarstig ("40,5").
  - Spilaður: lokastaða, sigurliðið feitletrað, "framl." ef við á.
  - Hlutlaus völlur: nafn vallarins (t.d. "Wembley Stadium").
- Leikstjórnendur og stuðlar eru geymdir en ekki sýndir.

**`/nfl/stada` - Staðan**, rofi **Riðlar | Deild**:
- **Riðlar:** AFC og NFC hlið við hlið (hvor undir annarri á síma), fjórir riðlar
  hvor. Dálkar: S-T-J, sigurhlutfall, skoruð, fengin, mismunur, í riðli, runa.
- **Deild:** sæti 1-7 í hvorri deild og lína undir 7. sæti. Sigurvegarar riðlanna eru í
  sætum 1-4 og raðað sín á milli með sömu viðmiðum. Í sætum 5-7 eru bestu þrjú hin liðin.
- Lið sem eru jöfn að sigurhlutfalli fá stutta skýringu: "raðað eftir innbyrðis
  viðureignum", "raðað eftir árangri í riðli" o.s.frv.
- Neðst: "Röðunin er einfölduð útgáfa af reglum NFL." ásamt þekktum frávikum úr
  mælingunni (kafli 5).
- Merki fyrir "tryggt sæti í úrslitakeppni" og "úr leik" koma **ekki** í þessu verkefni.
  Til að ákvarða þau þarf að telja allar mögulegar niðurstöður, og hermunin í verkefni 2
  gerir það.

**Röðunarkjarni:** `web/src/lib/nfl/standings.ts`, hreint fall án gagnagrunns:
- inntak: leikir deildarkeppninnar (`REG`) og liðataflan;
- úttak: röð hvers riðils og hverrar deildar ásamt `reason` fyrir hvert sæti sem réðst
  af reglu;
- jafntefli gilda sem hálfur sigur;
- röð viðmiða eftir sigurhlutfall, eins og hjá NFL:
  - **sama riðli:** innbyrðis viðureignir → árangur í riðli → sameiginlegir mótherjar →
    árangur í deild → styrkur sigra → stigamismunur → stafróf;
  - **ólíkum riðlum:** innbyrðis viðureignir (ef allir hafa mæst) → árangur í deild →
    sameiginlegir mótherjar (minnst 4 leikir) → styrkur sigra → stigamismunur → stafróf.
  - Styrkur leikjadagskrár, stigaröðun og hlutkesti NFL eru ekki með; stigamismunur og
    stafróf koma í staðinn.
  - *Bætt við 14. okt eftir mælingu:* fyrsta útgáfan sleppti sameiginlegum mótherjum og
    styrk sigra og raðaði 2025 rangt á tveimur stöðum (NE/DEN í AFC-1, SF/LA í NFC-5/6).
- Þegar þrjú eða fleiri lið eru jöfn er hvert viðmið reiknað á hópinn í heild. Þegar
  eitt lið skilur sig frá byrjar röðunin upp á nýtt fyrir þau sem eftir eru, eins og hjá
  NFL.
- Verkefni 2 notar sama kjarna í hermuninni.

**Ekki í þessu verkefni:** leikjasíða (`/nfl/leikur/[id]`, kemur með spánum), liðasíður,
saga eldri tímabila á síðunum, lifandi staða í leikjum.

## 5. Prófanir

Vitest, í `web/test/nfl-*.test.ts`:
- **CSV-lestur:** hausinn er athugaður, tóm stig verða `null` og `""` reitir lesast rétt.
  Keyrt á **afriti af raunverulega tímabilinu 2025** (`web/test/fixtures/nfl-2025.csv`),
  ekki aðeins gervigögnum (gildra 8).
- **Tími:** 2026-10-15 20:15 ET → 2026-10-16 00:15 UTC; leikur 25. okt kl. 13:00 (EDT) →
  17:00 UTC; leikur 1. nóv kl. 13:00 (EST) → 18:00 UTC.
- **Val á viku:** fyrir tímabil, í miðri viku með bæði spiluðum og óspiluðum leikjum,
  eftir síðasta leik deildarkeppninnar og eftir Super Bowl.
- **Röðun:** tilbúið dæmi fyrir hvert viðmið, þar með talið jafntefli og þriggja liða
  jöfnuð.
- **Mæling gegn veruleikanum:** lokastaða 2025 reiknuð úr gögnunum og borin saman við
  opinberu sætin 1-7 í hvorri deild og röðina í hverjum riðli. Prófið festir
  niðurstöðuna. Hvert frávik er skráð á síðunni og í hvelfingunni, frekar en að prófið
  sé lagað að einfölduninni.

Auk þess `npx tsc --noEmit` og `npm run build`. Síðurnar eru skoðaðar í preview í
dökku og ljósu þema og í símabreidd.

## 6. Villur

- Niðurhal mistekst, eða haus CSV-skrárinnar er ekki sá sem búist er við: cron skilar
  villu og skrifar **ekkert**.
- Óþekkt skammstöfun liðs í leikjaskránni: hætt við alla keyrsluna (ekkert skrifað að
  hluta).
- Lestur sækir eitt tímabil í einu. Allt sem gæti farið yfir 1.000 raðir notar
  síðuskiptingu (gildra 1).
- Engin gögn fyrir valda viku eða tímabil: "Engir leikir fundust", ekki tómur skjár.

## 7. Útgáfa

1. Smíðað á greininni `nfl` í `/Users/elias/FH leikmenn/nfl-wt`. Í aðalvinnutrénu er
   óvistuð Byrjunarliðs-vinna og önnur lota gæti verið í gangi. Aðeins nefndar skrár
   eru stage-aðar.
2. Migration → `ingest-nfl.mts --all` keyrt héðan → síður prófaðar í preview.
3. Athuga Vercel-áskriftina. Á Hobby má hver cron keyra einu sinni á dag, sem dugar hér.
   Bæta `/api/cron/nfl` í `vercel.json`.
4. Áður en gefið er út: greinin byggir á `origin/main` (a86216a), sem inniheldur allt sem
   er í loftinu núna (Leiðin, Vallarleit). Ef `main` hefur færst þarf að sameina fyrst,
   annars tekur útgáfan eitthvað úr loftinu.
5. `npx vercel deploy --prod --yes --scope eliasoli09s-projects` úr `web/` (push gefur ekki
   út).
6. Hvelfingin: `NFL/Yfirlit.md` (heimild, töflur, cron, frávik röðunar, mæld tímatöf
   nflverse) og lína í `START HÉR.md`.
