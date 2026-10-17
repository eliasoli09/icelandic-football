# Veðmálin (/vedmal)

Ný síða á NFL-vefnum með seðlum vikunnar og fjórum listum, allt úr líkani
síðunnar og stuðlum veðbanka. Elias samþykkti hönnunina 17. okt 2026.

## Umferðin
Umferðin er sú sem næsti óhafni leikur tilheyrir. Aðeins leikir sem eru ekki
hafnir koma til greina, og aðeins þeir sem hafa stuðla (nflverse `home_ml`,
`away_ml`, `spread_line`, `total_line`).

## 1. Seðlar vikunnar
| Seðill | Markstuðull |
|---|---|
| Double Trouble | 2,0 |
| Sprengjan | 3,5 |
| Bomban | 5,0 |

- Hver leikur gefur tvo kosti: sigur heimaliðs eða útiliðs. Stuðull = moneyline
  breytt í evrópskan stuðul. Líkur = líkan síðunnar (`seasonForecasts().pHome`).
- Leitin fer í gegnum allar samsetningar með mest einum kosti úr hverjum leik,
  2 til 8 leggjum, og heildarstuðli á bilinu [mark, mark × 1,15]. Valinn er seðillinn
  með hæstu líkur samkvæmt líkaninu (margfeldi líkna, leikir taldir óháðir).
- Á seðlinum: leggirnir með stuðli, heildarstuðull, líkur líkansins og líkur
  veðbankans (margfeldi líkna þar sem álagið er dregið frá, `devig`).
- Seðlarnir mega deila leikjum.
- Ferill: sama aðferð keyrð á 2015-2025 með lokastuðlum og líkum líkansins fyrir
  leik. Birt: hve oft hver seðill gekk upp, meðallíkur líkansins og hvað 1.000 kr.
  á hvern seðil hefðu skilað. Tölurnar eru skrifaðar í `data/vedmal-backtest.json`.

## 2. Líklegustu snertimarksskorararnir
- λ = vænt snertimörk (hlaup + grip) í leiknum; líkur = 1 − e^(−λ).
- Grunnur á leik: snertimörk leikmannsins á tímabilinu dregin að snertimörkum
  sem notkun hans spáir (hlaup × r_h + skotmörk × r_s), með k leikjum af vægi.
  Síðasta tímabil telur hálft.
- Liðsþáttur: stig sem veðbankinn býst við frá liðinu (heildarstig/2 ± forgjöf/2)
  deilt með meðalstigum liðsins, dregið að meðaltali deildarinnar.
- r_h, r_s og k eru valin á 2016-2021 og mæld á 2022-2025: kvörðun í hólfum og
  log loss á móti einfaldri tíðni.
- Aðeins leikmenn sem spiluðu síðasta leik liðsins (engin meiðslagögn). 15 efstu.

## 3. Hlaupamestir
- Spáðir hlaupajardar = meðaltal leikmannsins (síðasta tímabil hálft) × varnarþáttur
  mótherjans (hlaupajardar sem hann gefur eftir, dregið að meðaltali deildarinnar).
- Mælt á 2022-2025 á móti meðaltali tímabilsins eingöngu (MAE). 10 efstu.

## 4. Markahæstu leikirnir
- Spáð heildarstig úr sókn og vörn liðanna (dregið að meðaltali deildarinnar),
  borið saman við línu Vegas á 2022-2025. Ef Vegas er nákvæmara er raðað eftir
  línu Vegas og okkar spá sýnd við hliðina, og síðan segir það hreint út.

## 5. Sigurstranglegustu
- Líkur líkansins á sigri, raðað frá hæstu, með líkum veðbankans við hliðina.

## Ábyrgð
- 18 ára aldurstakmark, "líkur, ekki loforð", Hjálparsími Rauða krossins 1717.
- Engir tenglar á veðmálasíður og engin nöfn veðbanka.

## Kóði
- `src/lib/nfl/vedmal.ts`: hreinar aðgerðir (stuðlar, seðlaleit, λ, hlaupaspá,
  heildarstig). Prófaðar í `test/nfl-vedmal.test.ts`.
- `scripts/nfl-vedmal-backtest.mts`: velur stuðla og skrifar ferilinn.
- `src/app/vedmal/page.tsx`, `revalidate = 300`. Nýr flipi "Veðmál" í `NflSubnav`.
- Engin ný tafla: allt reiknast úr `nfl_games`, `nfl_elo` og `nfl_player_weeks`.
