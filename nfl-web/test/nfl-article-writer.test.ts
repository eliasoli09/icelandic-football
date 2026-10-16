import { describe, it, expect } from 'vitest'
import { buildArticlePrompt, checkArticle, parseArticleReply, unknownNumbers } from '../src/lib/nfl/articles/writer'

const facts = { urslit: 'DAL 20 - 24 PHI', likur_pct: 64, forgjof_vegas: 'PHI −8,5', met: '3-2', timabil: 2025 }
const body = (s: string) => `${s} ${'orð '.repeat(70)}`

describe('parseArticleReply', () => {
  it('les JSON með og án kóðagirðingar', () => {
    const json = '{"title": "Eagles unnu", "lede": "Stutt.", "body": "Meira."}'
    expect(parseArticleReply(json).title).toBe('Eagles unnu')
    expect(parseArticleReply('Hér er greinin:\n```json\n' + json + '\n```').body).toBe('Meira.')
  })
  it('hafnar ógildu svari', () => {
    expect(() => parseArticleReply('ekkert hér')).toThrow(/JSON/)
    expect(() => parseArticleReply('{"title": "x"}')).toThrow(/vantar/)
  })
})

describe('staðreyndavörn', () => {
  it('samþykkir tölur úr pakkanum í íslensku sniði', () => {
    expect(unknownNumbers({ title: 'Eagles 24, Cowboys 20', lede: 'Líkanið gaf 64% og Vegas −8,5.', body: 'Metið er 3-2 á tímabilinu 2025.' }, facts)).toEqual([])
  })
  it('hafnar tilbúinni tölu en leyfir litlar heiltölur', () => {
    expect(unknownNumbers({ title: 'x', lede: '3 snertimörk', body: 'Hurts kastaði 287 jördum á 71% sendinga.' }, facts)).toEqual(['287', '71'])
  })
  it('checkArticle tekur saman ástæðurnar', () => {
    expect(checkArticle({ title: 'Eagles unnu Cowboys', lede: 'x', body: body('Lokatölur 24-20.') }, facts)).toEqual([])
    const bad = checkArticle({ title: 'Eagles unnu', lede: 'x', body: 'Of stutt með 99 jördum.' }, facts)
    expect(bad).toContain('Meginmálið er of stutt')
    expect(bad.some((r) => r.includes('99'))).toBe(true)
  })
})

describe('buildArticlePrompt', () => {
  it('leiðbeiningar, lengd eftir tegund og pakkinn', () => {
    const p = buildArticlePrompt('umfjollun', facts)
    expect(p).toContain('Staðreyndapakki')
    expect(p).toContain('120-250 orð')
    expect(p).toContain('"likur_pct": 64')
  })
})
