import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, parseBlocks } from '../src/lib/nfl/articles/markdown'

describe('parseBlocks', () => {
  it('fyrirsagnir, efnisgreinar og listar', () => {
    expect(parseBlocks('## Leikur 1\nFyrsta lína\nönnur lína\n\n- a\n- b\nEftir lista')).toEqual([
      { type: 'h2', text: 'Leikur 1' },
      { type: 'p', text: 'Fyrsta lína önnur lína' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'p', text: 'Eftir lista' },
    ])
  })
})

describe('Markdown', () => {
  it('feitletrun verður strong og HTML verður texti', () => {
    const html = renderToStaticMarkup(<Markdown text={'**Eagles** unnu <script>alert(1)</script>'} />)
    expect(html).toContain('<strong>Eagles</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
