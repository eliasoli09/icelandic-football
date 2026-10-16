import { Fragment, type ReactNode } from 'react'

/**
 * The little markdown articles use: ## headings, - lists, **bold**, paragraphs.
 * Parsed into blocks and rendered as React elements, so text never becomes HTML.
 */

export type Block = { type: 'h2'; text: string } | { type: 'p'; text: string } | { type: 'ul'; items: string[] }

export function parseBlocks(md: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) { out.push({ type: 'p', text: para.join(' ') }); para = [] }
    if (list.length) { out.push({ type: 'ul', items: list }); list = [] }
  }
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const h = /^#{1,3}\s+(.*)$/.exec(line)
    const li = /^[-*]\s+(.*)$/.exec(line)
    if (h) { flush(); out.push({ type: 'h2', text: h[1] }) }
    else if (li) { if (para.length) { out.push({ type: 'p', text: para.join(' ') }); para = [] } list.push(li[1]) }
    else { if (list.length) { out.push({ type: 'ul', items: list }); list = [] } para.push(line) }
  }
  flush()
  return out
}

/** **bold** inside a line; everything else stays text. */
export function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="grid gap-4 leading-relaxed">
      {parseBlocks(text).map((b, i) =>
        b.type === 'h2' ? <h2 key={i} className="display text-xl font-extrabold mt-2">{inline(b.text)}</h2>
          : b.type === 'ul' ? <ul key={i} className="list-disc pl-5 grid gap-1.5">{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>
            : <p key={i}>{inline(b.text)}</p>)}
    </div>
  )
}
