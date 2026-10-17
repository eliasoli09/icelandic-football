# Meiðslalistinn

Elias bað um meiðslalista 17. okt 2026 svo meiddir leikmenn detti út af Veðmálunum.

- **Gögn:** nflverse `injuries_{season}.csv` (Out, Doubtful, Questionable) og
  `roster_weekly_{season}.csv` (RES: R01/R48 = IR, R04 = PUP, annað = varalisti; CUT).
  Nýjasta vika skýrslunnar, sameinuð varalista sömu viku; skýrslan vinnur ef leikmaður er á báðum.
- **Tafla:** `nfl_injury` (015), opin til lestrar, skrifuð aðeins með `rpc_replace_nfl_injuries`
  (CRON_SECRET), sem skiptir út heilli viku. Daglega cron-ið (`ingestNfl`) les hana inn.
- **Regla:** ef skýrslan er frá umferðinni gildir hún öll; ef hún er eldri gildir aðeins
  varalistinn (`availability`).
- **Veðmálin:** Frá, Ólíklegur og varalisti detta út; Óvíst fær merki.
- **Síður:** `/leikmenn/meidsli` (leikur fyrir leik í næstu umferð) og "Meiðsli" á leikjasíðu
  óspilaðs leiks.
- **Íslenska:** Out = Frá, Doubtful = Ólíklegur, Questionable = Óvíst, IR = á meiðslalista.
  Líkamshlutar þýddir í `injuries.ts`; óþekkt orð standa á ensku.
