# NFL-miðillinn, áfangi 1: efnisvélin og `/ritstjorn`

Dagsetning: 16. október 2026. Grein: `nfl-ritstjorn` (worktree `/Users/elias/FH leikmenn/nfl-ritstjorn-wt`).
Fyrsti af fjórum áföngum (vault `NFL/Yfirlit`, "Miðillinn"). Endar á opinberri kynningu.

## Ákvarðanir Eliasar
- **Drög + ritstjórn:** vélin skrifar drög úr gögnunum; ekkert birtist nema ritstjóri ýti á Birta.
- **Bæði:** handvirkt (prompt → ChatGPT → líma svar) virkar frá fyrsta degi; sjálfvirkt (API,
  `NEWS_LLM_URL/KEY/MODEL`) tekur við þegar lykill er settur.
- **Miðlungsmagn:** upphitun á umferð, stutt umfjöllun eftir hvern leik, vikan í hnotskurn.
  Um 18 drög á viku.

## 1. Greinategundir og tímasetning (`lib/nfl/articles/slots.ts`, hreint)
| Tegund | Slóð | Verður til |
|---|---|---|
| `upphitun` | `upphitun-<ár>-v<vika>` | 3 dögum fyrir fyrsta leik umferðar, þar til hann hefst |
| `umfjollun` | `umfjollun-<útilið>-<heimalið>-<ár>-v<vika>` (lágstafir) | leikur spilaður, upphaf innan 4 daga |
| `vikan` | `vikan-<ár>-v<vika>` | allir leikir umferðar spilaðir, síðasti innan 4 daga |
| `grein` | frjáls, úr fyrirsögn | ritstjóri býr til |

Úrslitakeppnin er með (umferðir eftir `week`, heiti eftir `game_type`).

## 2. Staðreyndapakkar (`lib/nfl/articles/facts.ts`, hrein föll)
Gildin eru tilbúin til birtingar (íslensk tímasetning, prósentur sem heiltölur, forgjöf sem "−2,5"),
svo málíkanið afritar tölur í stað þess að reikna.
- **Upphitun:** hver leikur: lið (fullt nafn), dagur og tími, líkur líkansins í %, forgjöf
  líkansins og Vegas, heildarstig Vegas, met beggja, síðustu fimm, nýr leikstjórnandi. Auk þess:
  mest sigurstranglega liðið, jafnasti leikurinn.
- **Umfjöllun:** úrslit, framlenging, sigurvegari, líkur sem líkanið gaf sigurvegaranum, óvænt ef
  undir 40%, met eftir leik, Elo-breyting beggja, líkur á úrslitakeppni (hermun), og lykilmenn úr
  `nfl_player_weeks`: besti sendandi, hlaupari, gripari og varnarmaður hvors liðs. Ef
  leikmannatölur eru ekki komnar er það sagt í pakkanum.
- **Vikan:** öll úrslit, óvæntustu sigrarnir, mest hækkun og lækkun í Elo í umferðinni, efsta lið
  hvers riðils, líkur á úrslitakeppni.

## 3. Skrifin (`lib/nfl/articles/writer.ts`)
- `ARTICLE_INSTRUCTIONS`: íslenska, orð úr orðasafninu (`NFL/Orðasafn`), aðeins staðreyndir úr
  pakkanum, engar tilvitnanir, lengdir eftir tegund. Svar á JSON: `{title, lede, body}`; `body` í
  einföldu markdown (`##`, `-`, `**`).
- `buildArticlePrompt(kind, facts)`, `parseArticleReply(text)`.
- **Staðreyndavörn** `checkNumbers(text, facts)`: hver tala í fyrirsögn, inngangi og meginmáli
  verður að finnast í pakkanum (eftir stöðlun á kommu og mínus); heiltölur 0-10 eru alltaf
  leyfðar. Annars er textanum hafnað og tölurnar sýndar.
- **Sjálfvirkt:** cron-inn fyllir drög án texta ef `NEWS_LLM_*` eru til (chat completions).
  Hafnaður texti er ekki vistaður; ástæðan fer í niðurstöðu cron-sins.
- **Handvirkt:** `/ritstjorn` sýnir "Afrita prompt" og "Líma svar"; sama vörn í vafranum.

## 4. Gögn (`supabase/migrations/012_nfl_article.sql`)
- `nfl_editor` (`user_id` → `auth.users`): hverjir eru ritstjórar. Fall `is_nfl_editor()`.
- `nfl_article`: `id`, `slug` einkvæmt, `kind`, `status` (`draft` | `published`), `title`,
  `lede`, `body`, `season`, `week`, `game_id`, `teams` text[], `facts` jsonb, `model`,
  `edited` (ritstjóri hefur breytt), `author`, `created_at`, `updated_at`, `published_at`.
- **RLS:** allir lesa birtar greinar; ritstjórar lesa og skrifa allt.
- **Cron:** `rpc_upsert_nfl_article_drafts(p_secret, p_rows)` bætir við drögum og uppfærir
  staðreyndir í drögum sem ritstjóri hefur ekki snert; `rpc_set_nfl_article_text(p_secret, p_slug,
  p_title, p_lede, p_body, p_model)` setur texta í ósnert drög. Hvorugt snertir birta grein.
- Elias er gerður ritstjóri (auðkenni hans úr `auth.users`).

## 5. Síður
- **`/ritstjorn`** (aðeins ritstjórar; aðrir sjá innskráningu eða "Þú ert ekki ritstjóri"): drög
  eftir tegund og stöðu, "Ný grein". **`/ritstjorn/[id]`:** fyrirsögn, inngangur, meginmál
  (ritill + forskoðun), staðreyndapakki, Afrita prompt / Líma svar, Vista, Birta, Taka úr birtingu.
- **`/nfl/greinar`:** birtar greinar, nýjast efst, sía eftir tegund.
- **`/nfl/grein/[slug]`:** greinin; Open Graph (`article`), JSON-LD `NewsArticle`; neðst:
  "Skrifað með aðstoð gervigreindar úr gögnum Besta spáarinnar og yfirlesið af ritstjórn" (nema
  frjáls grein).
- **Vikan:** reitur "Greinar" (þrjár nýjustu). **Leikjasíðan:** upphitun og umfjöllun um leikinn.
- Markdown birt með litlum eigin þýðanda (React-einingar, ekkert HTML úr texta).

## 6. Prófanir
- `slots`: hvenær hver tegund verður til og slóðir.
- `facts`: pakkar á 2025-gögnunum (fixture): óvænt úrslit, met, met eftir leik.
- `writer`: JSON með og án kóðagirðingar, staðreyndavörn hafnar tilbúinni tölu og samþykkir
  sniðnar tölur.
- `markdown`: fyrirsagnir, listar, feitletrun, HTML er texti.
- RLS á lifandi grunni (hermdir notendur, afturkallað): lesandi sér ekki drög, venjulegur
  notandi getur ekki skrifað, ritstjóri getur; cron-RPC snertir ekki birta grein.

## 7. Útgáfa
localhost fyrir Elias, ekkert deploy fyrr en "full send". Afrita `web/.vercel/project.json` í
nýja worktree-ið áður en gefið er út (Gildrur 34).
