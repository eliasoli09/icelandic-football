# NFL-hornið, verkefni 5: NFL-fréttir á íslensku

Dagsetning: 15. október 2026. Grein: `nfl-frettir` (worktree `/Users/elias/FH leikmenn/nfl-frettir-wt`).

## Ákvarðanir og rammi
- Elias vill fréttir af erlendum síðum á íslensku, skrifaðar af gervigreind.
- **Heilar greinar eru ekki þýddar eða birtar.** Fréttagreinar eru höfundarréttarvarðar og
  þýðing er eftirgerð. Birt er: íslensk fyrirsögn, 2-3 setninga samantekt í eigin orðum, og
  tengill á fréttina hjá útgefandanum. Sama snið og slúðursíðan (`/sludur`).
- **Efni:** NFL eingöngu.
- **Líkan:** Elias nefndi "GPT Sol 6.1"; heitið er óstaðfest. Kóðinn er tilbúinn fyrir
  hvaða þjónustu sem talar OpenAI-sniðið (`NEWS_LLM_URL`, `NEWS_LLM_KEY`, `NEWS_LLM_MODEL` í
  `.env.local`); Elias setur lykilinn sjálfur. Þangað til: handvirkt flæði gegnum ChatGPT
  með tilbúnum prompti.

## 1. Heimildir
RSS (gert til að birta fyrirsagnir og tengla annars staðar), staðfest 15. okt:
- ESPN `https://www.espn.com/espn/rss/nfl/news` (23 fréttir)
- ProFootballTalk `https://profootballtalk.nbcsports.com/feed/` (30)
- CBS Sports `https://www.cbssports.com/rss/headlines/nfl/` (36)
- Yahoo Sports `https://sports.yahoo.com/nfl/rss/` (50)

NFL.com hefur ekkert RSS. **Greinarnar sjálfar eru aldrei sóttar.** Líkanið fær aðeins
fyrirsögn og RSS-lýsingu, og lýsingin er geymd en aldrei birt.

## 2. Gögn
- Tafla `nfl_news`: `url` PK, `source`, `title` (upprunaleg), `description` (aðeins inntak
  fyrir líkanið, aldrei birt), `published_at`, `title_is`, `summary_is`, `teams text[]`,
  `model`, `summarized_at`, `created_at`.
- `rpc_insert_nfl_news` (bætir aðeins við nýjum, snertir aldrei samantekt sem er komin) og
  `rpc_set_nfl_news_summary` (setur íslenska textann á eina frétt).
- **Lið** greind úr fyrirsögn og lýsingu eftir **gælunafni liðsins** ("Chiefs", "49ers"),
  ekki borg: "New York" og "Los Angeles" eiga tvö lið hvor.

## 3. Samantektir
- `lib/nfl/news.ts`: `NEWS_INSTRUCTIONS` (ein uppspretta fyrir bæði sjálfvirka og handvirka
  flæðið), `buildPrompt`, `parseReply`, `validateSummary`.
- **Prófun á hverju svari:** fyrirsögn 3-14 orð, samantekt 15-80 orð, tengill sem passar við
  frétt sem var send, og **engir 8 orð í röð afritaðir** úr lýsingu eða fyrirsögn (eftir
  stöðlun). Svar sem fellur er ekki skrifað, og ástæðan er prentuð.
- **Sjálfvirkt:** ef `NEWS_LLM_*` eru til samantekur daglegi cron-inn allt að 20 nýjar fréttir
  í einu kalli (chat completions, JSON-svar).
- **Handvirkt:** `scripts/nfl-news-prompt.mts` skrifar tilbúinn prompt með fréttum sem vantar
  samantekt; `scripts/nfl-news-import.mts <skrá>` les JSON-svar ChatGPT, prófar og skrifar.
- `docs/nfl-frettir-chatgpt.md`: leiðbeiningar og prompturinn fyrir Elias. Próf tryggir að
  skjalið og `NEWS_INSTRUCTIONS` séu eins.

## 4. Síður
- Aðeins fréttir með íslenskri samantekt birtast, alltaf með "Heimild: <veita>" og tengli.
- **Vikan:** reitur "Fréttir" með sex nýjustu og tengli á allar.
- **`/nfl/frettir`:** allar fréttir, nýjast efst, sía eftir liði. Enginn nýr flipi.
- **Leikjasíða:** fréttir um liðin tvö (síðustu 7 daga).

## 5. Prófanir
`parseRss` á klipptum raunverulegum straumum (ESPN, PFT), `detectTeams`, `validateSummary`
(lengd, afritun, óþekktur tengill), `parseReply` (ógilt JSON), skjal = leiðbeiningar.

## 6. Útgáfa
Eins og áður: localhost fyrir Elias, ekkert deploy fyrr en "full send".
