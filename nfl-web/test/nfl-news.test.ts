import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildPrompt, detectTeams, NEWS_INSTRUCTIONS, parseReply, parseRss, validateSummary, MAX_DESCRIPTION } from '../src/lib/nfl/news'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'nfl-news', f), 'utf-8')
const teams = [
  { abbr: 'KC', name: 'Kansas City Chiefs' }, { abbr: 'NYG', name: 'New York Giants' }, { abbr: 'NYJ', name: 'New York Jets' },
  { abbr: 'JAX', name: 'Jacksonville Jaguars' }, { abbr: 'SF', name: 'San Francisco 49ers' }, { abbr: 'PHI', name: 'Philadelphia Eagles' },
]

describe('parseRss', () => {
  const espn = parseRss(fx('espn.xml'), 'ESPN')
  const pft = parseRss(fx('pft.xml'), 'ProFootballTalk')
  it('fyrirsögn, tengill, dagsetning og lýsing úr hverri frétt', () => {
    expect(espn).toHaveLength(3)
    expect(pft).toHaveLength(3)
    for (const n of [...espn, ...pft]) {
      expect(n.url).toMatch(/^https:\/\//)
      expect(n.title.length).toBeGreaterThan(10)
      expect(n.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(n.title).not.toMatch(/CDATA|<|&amp;/)
    }
  })
  it('aldrei heila greinin: aðeins lýsing, án HTML, klippt', () => {
    for (const n of pft) {
      expect(n.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
      expect(n.description).not.toMatch(/<[a-z]/i)
    }
    const raw = fx('pft.xml')
    const full = /<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(raw)![1]
    expect(full.length).toBeGreaterThan(pft[0].description.length * 2)
  })
})

describe('detectTeams', () => {
  it('eftir gælunafni, ekki borg', () => {
    expect(detectTeams('Chiefs edge Jaguars as 49ers rest', teams).sort()).toEqual(['JAX', 'KC', 'SF'])
    expect(detectTeams('New York hosts a big game', teams)).toEqual([])
    expect(detectTeams('Giants and Jets both lose', teams).sort()).toEqual(['NYG', 'NYJ'])
  })
})

describe('validateSummary', () => {
  const item = { url: 'https://x.test/a', title: 'Jaguars are first team since the merger not to allow a 40-yard rusher', description: 'The Jaguars have been stout against the run all season long and nobody has broken a long one yet.' }
  const ok = { url: 'https://x.test/a', title_is: 'Jaguars stöðva hlaupin', summary_is: 'Varnarlína Jacksonville hefur haldið öllum hlaupurum í skefjum í fyrstu fimm leikjunum. Ekkert lið hefur náð því síðan deildirnar sameinuðust, og það sést í stigatöflunni.' }
  it('góð samantekt stenst', () => {
    expect(validateSummary(ok, item)).toEqual([])
  })
  it('of löng eða of stutt', () => {
    expect(validateSummary({ ...ok, summary_is: 'Of stutt.' }, item).join()).toMatch(/orð/)
    expect(validateSummary({ ...ok, title_is: 'Já' }, item).join()).toMatch(/Fyrirsögn/)
  })
  it('hafnar 8 orðum í röð úr upprunanum', () => {
    const copied = { ...ok, summary_is: 'Fréttin segir: The Jaguars have been stout against the run all season long, sem er merkilegt fyrir lið sem var veikt í fyrra.' }
    expect(validateSummary(copied, item).join()).toMatch(/afrit/)
  })
  it('hafnar tengli sem var ekki sendur', () => {
    expect(validateSummary({ ...ok, url: 'https://y.test/b' }, item).join()).toMatch(/tengil/)
  })
})

describe('parseReply og prompt', () => {
  it('les JSON, líka innan kóðablokkar', () => {
    const r = parseReply('Hér er svarið:\n```json\n[{"url":"https://x.test/a","title_is":"T","summary_is":"S"}]\n```')
    expect(r).toEqual([{ url: 'https://x.test/a', title_is: 'T', summary_is: 'S' }])
    expect(() => parseReply('ekkert json hér')).toThrow(/JSON/)
  })
  it('prompturinn inniheldur leiðbeiningarnar og fréttirnar', () => {
    const p = buildPrompt([{ url: 'https://x.test/a', title: 'Hello', description: 'World', source: 'ESPN' }])
    expect(p).toContain(NEWS_INSTRUCTIONS)
    expect(p).toContain('https://x.test/a')
  })
  it('ChatGPT-skjalið geymir sömu leiðbeiningar og kóðinn', () => {
    const doc = readFileSync(join(__dirname, '..', '..', 'docs', 'nfl-frettir-chatgpt.md'), 'utf-8')
    expect(doc).toContain(NEWS_INSTRUCTIONS)
  })
})
