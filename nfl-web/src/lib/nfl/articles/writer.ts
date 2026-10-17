import type { ArticleKind } from './slots'

/**
 * One set of instructions for both routes: the cron calls a model with it, and
 * /ritstjorn hands it to an editor to paste into ChatGPT. The number check
 * below holds every reply to the fact pack.
 */

const LENGTH: Record<Exclude<ArticleKind, 'grein'>, string> = {
  upphitun: '350-600 orð. Inngangur um umferðina, svo ## kafli fyrir hvern leik (2-3 setningar hver).',
  umfjollun: '120-250 orð. Hvað gerðist, hvort það kom á óvart, lykilmenn og hvað það þýðir fyrir stöðuna.',
  vikan: '250-450 orð. ## kaflar: Óvæntustu úrslitin, Hverjir hækkuðu og lækkuðu, Baráttan um úrslitakeppnina.',
}

export const ARTICLE_INSTRUCTIONS = `Þú ert íþróttablaðamaður á íslenskum NFL-miðli. Skrifaðu grein á vandaðri íslensku úr staðreyndapakkanum hér að neðan.

Reglur:
1. Notaðu AÐEINS staðreyndir úr pakkanum. Bættu engu við: engin meiðsli, tilvitnanir, saga eða tölur sem þar standa ekki.
2. Hver tala í greininni verður að standa í pakkanum, eins og hún er skrifuð þar (t.d. 64%, −2,5, 3-2). Reiknaðu ekkert nýtt.
3. Nöfn liða og leikmanna haldast óbreytt. Tímar eru íslenskir; skrifaðu þá eins og í pakkanum.
4. Orðaval: leikstjórnandi (quarterback), snertimark (touchdown), vallarmark (field goal), aukastig (extra point),
   sjálfsmark (safety), útherji (wide receiver), innherji (tight end), hlerun (interception), fella (sack), grip (reception), jardar (yards), forgjöf (spread),
   heildarstig (total), riðill (division), deild (AFC/NFC), deildarkeppni (regular season), úrslitakeppni (playoffs),
   umspil (Wild Card), 8 liða úrslit (Divisional), undanúrslit (Conference Championship), framlenging (overtime),
   nýliði (rookie). "Líkanið" er Elo-spálíkan síðunnar; "Vegas" eru veðbankarnir.
5. Lifandi, skýr blaðamennska, en engar ýkjur. Ekkert "samkvæmt gögnum" eða "pakkinn segir".
6. Meginmál í einföldu markdown: ## fyrir millifyrirsagnir, - fyrir lista, **feitletrun** sparlega. Ekkert annað.
7. Skilaðu AÐEINS JSON: {"title": "<fyrirsögn, 4-12 orð>", "lede": "<inngangur, 1-2 setningar>", "body": "<meginmál>"}`

export function buildArticlePrompt(kind: Exclude<ArticleKind, 'grein'>, facts: unknown): string {
  return `${ARTICLE_INSTRUCTIONS}\n\nLengd: ${LENGTH[kind]}\n\nStaðreyndapakki:\n${JSON.stringify(facts, null, 2)}\n`
}

export interface ArticleText { title: string; lede: string; body: string }

/** The JSON object out of a model reply, with or without a code fence. */
export function parseArticleReply(text: string): ArticleText {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  let data: unknown
  try { data = JSON.parse(raw) } catch { throw new Error('Ekkert gilt JSON í svarinu') }
  const d = data as Record<string, unknown>
  if (typeof d?.title !== 'string' || typeof d?.lede !== 'string' || typeof d?.body !== 'string') throw new Error('Svarið vantar title, lede eða body')
  return { title: d.title.trim(), lede: d.lede.trim(), body: d.body.trim() }
}

/** "−2,5", "-2.5" and "2,5" all mean 2.5; "3-2" is two numbers, 3 and 2. */
function numbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => String(Number(n.replace(',', '.'))))
}

/**
 * Numbers in the text that are not in the facts. Whole numbers up to ten are
 * always allowed (counts like "3 snertimörk" read naturally).
 */
export function unknownNumbers(text: ArticleText, facts: unknown): string[] {
  const known = new Set(numbers(JSON.stringify(facts)))
  const seen = new Set<string>()
  for (const n of numbers(`${text.title}\n${text.lede}\n${text.body}`)) {
    if (Number.isInteger(Number(n)) && Number(n) <= 10) continue
    if (!known.has(n)) seen.add(n)
  }
  return [...seen]
}

/** Reasons to reject a reply; empty when it may be saved. */
export function checkArticle(text: ArticleText, facts: unknown): string[] {
  const out: string[] = []
  if (!text.title || text.title.split(/\s+/).length > 16) out.push('Fyrirsögnin vantar eða er of löng')
  if (!text.body || text.body.split(/\s+/).length < 60) out.push('Meginmálið er of stutt')
  const bad = unknownNumbers(text, facts)
  if (bad.length) out.push(`Tölur sem standa ekki í staðreyndapakkanum: ${bad.join(', ')}`)
  return out
}
