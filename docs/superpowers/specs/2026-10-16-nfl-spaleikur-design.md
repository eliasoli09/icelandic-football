# NFL-hornið, verkefni 3: spáleikurinn

Dagsetning: 16. október 2026. Grein: `nfl-spa` (worktree `/Users/elias/FH leikmenn/nfl-spa-wt`).

## Ákvarðanir Eliasar
- **Spáform:** sigurvegari í hverjum leik, 1 stig fyrir réttan.
- **Einkadeildir:** með boðstengli, strax í fyrstu útgáfu.
- **Tilgangur:** að verða fastur viðkomustaður íslenskra NFL-áhugamanna. Styrktaraðili er
  næsta verkefni (sér spec), og leikurinn er hannaður svo línan "í boði X" og vikuverðlaun
  passi inn í hann.
- **Myndefni:** ChatGPT býr til grafík. Síðan sýnir hana þegar skrárnar eru komnar á réttan stað
  (sjá 6) og lítur vel út án hennar.

## 1. Reglur
- **Spáin:** í hverjum leik er valið annað liðið. Hægt er að breyta spá fram að upphafi leiks;
  þá læsist hún. Hver leikur læsist sér.
- **Stig:** réttur sigurvegari gefur 1 stig, jafntefli ½, rangt 0. Leikur án spár gefur 0.
- **Bráðabani:** heildarstig í síðasta leik umferðarinnar (eftir upphafstíma). Hann læsist við
  upphaf þess leiks. Innan umferðar sker minnstur munur á bráðabana og raunverulegu heildarstigi
  úr. Á tímabilstöflunni ræður samanlagður fjöldi stiga; jafnir deila sæti.
- **Úrslitakeppnin** er með. Hver umferð er "vika" eins og í gögnunum (`week` 19-22).
- **Læsing á óvissum tíma:** leikir með `time_tbd` hafa bráðabirgðatíma kl. 12 að austurtíma, sem
  er fyrr en raunverulegur tími. Þeir læsast því fyrr frekar en of seint.
- **Spár annarra** sjást aðeins eftir upphaf leiksins (gagnagrunnurinn ræður því, ekki síðan).
- **Líkanið** er keppandi á öllum töflum. Það velur alltaf liðið með `p_win > 0,5` í `nfl_elo`
  (líkur fyrir leik) og hefur engan bráðabana. Val þess fyrir óhafinn leik er falið á
  spáleiknum, til að fólk spái sjálft, en líkurnar eru áfram á Vikunni.

## 2. Gögn (`supabase/migrations/011_nfl_pick.sql`; 010 er `nfl_game_qb` á greininni `nfl-qb`)
Notendur eru þeir sömu og á stigatöflunni (`game_user`, Supabase Auth með netfangi). Skrif koma
úr vafranum sem innskráður notandi; RLS leyfir aðeins eigin línur. Sama aðferð og `game_result`.

- **`nfl_pick`** (`player` → `game_user`, `game_id` → `nfl_games`, `pick` text, `updated_at`),
  lykill (player, game_id).
  - **Lestur:** eigin línur alltaf; annarra aðeins ef `nfl_games.kickoff <= now()`.
  - **Bæta við, breyta, eyða:** eigin línur, aðeins ef leikurinn er óhafinn
    (`kickoff > now()`, engin úrslit) og `pick` er annað liðanna.
- **`nfl_tiebreak`** (`player`, `season`, `week`, `total` int 0-150), lykill (player, season,
  week). Skrif leyfð meðan síðasti leikur umferðarinnar er óhafinn. Lestur annarra eftir upphaf
  hans.
- **`nfl_league`** (`id` uuid, `name` 2-40 stafir, `code` einkvæmur, `owner`, `created_at`) og
  **`nfl_league_member`** (`league`, `player`, `joined_at`).
  - Deild og meðlimir sjást aðeins meðlimum. Aðild er könnuð með security-definer fallinu
    `is_nfl_league_member(league)`, því stefna sem les eigin töflu endurkvæmt fellur í Postgres.
  - **Kóðinn:** 10 hex-stafir úr `gen_random_uuid()` (dulmálsslembið).
  - **Stofna:** `rpc_create_nfl_league(p_name)` (security definer, `auth.uid()`) býr til deildina,
    setur stofnandann inn og skilar kóðanum. Hámark 10 deildir á notanda.
  - **Ganga í:** `rpc_join_nfl_league(p_code)` setur `auth.uid()` inn og skilar id og nafni.
    Rangur kóði gefur villu; deild tekur í mesta lagi 500.
  - **Hætta:** meðlimur má eyða eigin aðild.
- **`nfl_pick_points`** (sýn, `security_invoker`): ein lína á spá í spiluðum leik, með `season`,
  `week`, `points`. RLS á `nfl_pick` gildir, og spár í spiluðum leikjum eru allar sýnilegar.

## 3. Reikningur (`lib/nfl/pickem.ts`, hrein föll)
- `pickPoints(pick, game)`: 1, ½ eða 0.
- `modelPicks(games, elo)`: val líkansins í hverjum leik.
- `weekBoard(...)` og `seasonBoard(...)`: raðaðar töflur úr stigum, bráðabana og nöfnum, með
  líkaninu sem línu `{ id: 'model', name: 'Líkanið' }`. Jafnir fá sama sæti.
- `pickWeek(games, now)`: umferðin sem spáð er í: sú fyrsta sem á óhafinn leik.

## 4. Síður
- **`/nfl/spa`** (flipinn "Spáleikur"):
  - Haus: titill og stutt lýsing; staða mín í vikunni og á tímabilinu.
  - **Leikir umferðarinnar:** hver með tveimur liðshnöppum, upphafstíma og læsingu. Eftir upphaf:
    rétt/rangt, hlutfall þeirra sem völdu hvort lið og val líkansins.
  - **Bráðabani** neðst; vikuval (fyrri umferðir til að skoða).
  - **Töflur:** Vikan | Tímabilið, sía Allir | hver deild mín. Mín lína auðkennd.
  - **Deildirnar mínar:** stofna, afrita boðstengil, hætta.
  - **Ekki innskráð(ur):** hægt að velja; valið geymist í `localStorage` og vistast við
    innskráningu ef leikurinn er óhafinn. Innskráning með sama formi og stigataflan (`SignIn` er
    flutt í sameiginlega skrá).
- **`/nfl/spa/deild/[kodi]`:** "Þér er boðið í <deild>" (nafn sést ekki fyrir innskráningu, því
  deildir eru lokaðar): skrá inn, ganga í, fara á spáleikinn með deildina valda.
- **Valmyndin:** "Spáleikur" kemur í stað "Styrkleiki" (fimm flipar á 375 px). `/nfl/stada` og
  `/nfl/styrkleiki` fá rofa **Staðan | Styrkleiki**, og flipinn "Staðan" er virkur á báðum.
- **Vikan:** reitur efst, "Spáðu í leiki vikunnar", með fjölda óhafinna leikja og tengli.

## 5. Villur og jaðrar
- Vistun sem RLS hafnar (leikur hófst á meðan) sýnir "Leikurinn er hafinn" og les stöðuna aftur.
- Lestur sem bregst skilur valið eftir í tækinu, aldrei tóma síðu.
- Notandi án nafns (`game_user`) velur nafn fyrst, eins og á stigatöflunni.

## 6. Myndefni frá ChatGPT
Valfrjálst. Rofinn `ART` í `app/nfl/spa/page.tsx` er settur á `true` þegar skráin er komin. Athugun á diski með reiknaðri slóð braut Turbopack-smíðina:
- `web/public/nfl/spaleikur/hero.webp`: borði efst á `/nfl/spa`, 1600×500, efnið helst í miðju
  (klipptur á síma).
- `web/public/nfl/spaleikur/og.png`: deilimynd (Open Graph), 1200×630.
Engin NFL-merki eða vörumerki deildarinnar á myndunum (vörumerkjavernd).

## 7. Prófanir
- **`pickem`:** stig (rétt, rangt, jafntefli, óspilað), bráðabani sker úr, jöfn sæti, líkanið
  velur sigurstranglegra liðið, `pickWeek` í miðri umferð og milli umferða.
- **RLS á lifandi grunni** með hermdum notendum (`set_config('request.jwt.claims', ...)`), eins og
  með stigatöfluna:
  - ekki hægt að spá eða breyta eftir upphaf
  - ekki hægt að skrifa fyrir annan
  - spár annarra ósýnilegar fyrir upphaf
  - deild ósýnileg utan hennar
  - rangur kóði hafnað
  Prófunargögnum eytt á eftir.

## 8. Fyrir útgáfu (Elias)
Staðfestingarpóstur Supabase er á og innbyggði pósturinn er hraðatakmarkaður. Elias slekkur á
"Confirm email" í Supabase (Authentication > Providers > Email) eða setur upp eigin SMTP. Annars
komast fáir inn ef margir skrá sig í einu.

## 9. Útgáfa
Eins og áður: localhost fyrir Elias, ekkert deploy fyrr en "full send".
