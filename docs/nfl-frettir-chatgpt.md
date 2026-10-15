# NFL-fréttir á íslensku með ChatGPT

Vefurinn safnar NFL-fréttum (fyrirsögn, tengli og stuttri lýsingu) úr RSS-straumum ESPN,
ProFootballTalk, CBS Sports og Yahoo Sports. Á síðunni birtist aðeins íslensk fyrirsögn og
samantekt í eigin orðum, með heimild og tengli á fréttina. Greinarnar sjálfar eru aldrei
þýddar eða birtar, því þær eru höfundarréttarvarðar.

## Handvirkt, gegnum ChatGPT

1. Búðu til prompt með þeim fréttum sem vantar samantekt:

   ```bash
   cd web && npx tsx scripts/nfl-news-prompt.mts > ../nfl-prompt.txt
   ```

2. Opnaðu ChatGPT, veldu líkanið sem þú vilt nota, og límdu allt innihald `nfl-prompt.txt` inn.
3. Afritaðu svarið (JSON-fylkið) í skrá, t.d. `nfl-svar.json` í rót verkefnisins.
4. Lestu það inn:

   ```bash
   cd web && npx tsx scripts/nfl-news-import.mts ../nfl-svar.json
   ```

   Hvert svar er prófað áður en það er skrifað: lengd, rétt tengill, og engin 8 orð í röð
   afrituð úr upprunanum. Skriftan segir hvað var skrifað og hverju var hafnað, og af hverju.

## Sjálfvirkt

Þegar þú hefur lykil að þjónustu sem talar OpenAI-sniðið (chat completions), bættu þessu í
`web/.env.local` og í Vercel (Project Settings → Environment Variables):

```
NEWS_LLM_URL=https://api.openai.com/v1/chat/completions
NEWS_LLM_KEY=<lykillinn þinn>
NEWS_LLM_MODEL=<nákvæmt heiti líkansins>
```

Þá skrifar daglegi NFL-cron-inn samantektir sjálfur, allt að 20 í einu, með sömu prófunum.

## Leiðbeiningarnar sem líkanið fær

Þetta er nákvæmlega textinn sem fer fremst í promptinn (og í sjálfvirka kallið). Próf í
`web/test/nfl-news.test.ts` tryggir að hann sé sá sami og í `web/src/lib/nfl/news.ts`.

```
Þú skrifar stuttar íslenskar NFL-fréttir fyrir íslenska íþróttasíðu.
Fyrir hverja frétt hér að neðan færðu fyrirsögn og stutta lýsingu frá erlendum fréttamiðli.
Skrifaðu íslenska fyrirsögn og stutta samantekt UM fréttina, í eigin orðum.

Reglur:
1. Skrifaðu í eigin orðum. Þýddu ekki orðrétt og afritaðu aldrei 8 orð eða fleiri í röð úr textanum.
2. Fyrirsögn: 3-14 orð. Samantekt: 2-3 setningar, 15-80 orð.
3. Byggðu aðeins á fyrirsögninni og lýsingunni. Bættu engu við sem þar stendur ekki.
4. Nöfn liða og leikmanna haldast óbreytt (t.d. Kansas City Chiefs, Patrick Mahomes).
5. Notaðu þessi orð: leikstjórnandi (quarterback), snertimark (touchdown), vallarmark (field goal),
   hlerun (interception), fella (sack), nýliði (rookie), riðill (division), deild (AFC/NFC),
   úrslitakeppni (playoffs), umspil (Wild Card), undanúrslit (Conference Championship), jardar (yards).
6. Skrifaðu ekki "samkvæmt ESPN" eða nafn miðilsins; heimildin birtist sjálfkrafa við fréttina.
7. Skilaðu AÐEINS JSON-fylki, ein færsla á frétt, í sömu röð:
   [{"url": "<sami tengill og í fréttinni>", "title_is": "<íslensk fyrirsögn>", "summary_is": "<íslensk samantekt>"}]
```
