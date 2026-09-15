/**
 * Just enough of a wikitext reader to take tables off Wikipedia without
 * guessing: templates and links are matched by nesting, never by the next "|".
 *
 * Everything here is pure so it can be tested on small copies of the markup it
 * met in the wild.
 */

/** Index just past the "}}" or "]]" closing the bracket pair that opens at `start`. */
function closeOf(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; i++ }
    else if (two === '}}' || two === ']]') { depth--; i++; if (depth === 0) return i + 1 }
  }
  return text.length
}

/** Split on a separator only where it is not inside [[…]] or {{…}}. */
export function splitTop(text: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0, last = 0
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; i++; continue }
    if (two === '}}' || two === ']]') { depth = Math.max(0, depth - 1); i++; continue }
    if (depth === 0 && text.startsWith(sep, i)) {
      out.push(text.slice(last, i)); i += sep.length - 1; last = i + 1
    }
  }
  out.push(text.slice(last))
  return out
}

/** What a reader sees: link labels, template contents that are names, no markup. */
export function plain(text: string): string {
  let s = text
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // is.wikipedia's club template, {{Lið KR}}
    .replace(/\{\{\s*Lið\s+([^{}|]+?)\s*\}\}/g, '$1')
    .replace(/\{\{\s*(?:flagicon|fbaicon|fb|flag icon|#invoke:flag\|icon)\|[^{}]*\}\}/gi, '')
    .replace(/\{\{\s*(?:nowrap|nobr|small|sortname-display)\|([^{}]*)\}\}/gi, '$1')
    .replace(/\{\{\s*sdash\s*\}\}/gi, '')
  // links, innermost first, keeping the label
  for (let guard = 0; guard < 5 && /\[\[/.test(s); guard++) {
    s = s.replace(/\[\[(?:[^\[\]|]*\|)?([^\[\]|]*)\]\]/g, '$1')
  }
  return s
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The people or clubs sharing one cell, as <br> or a new line separates them. */
export function plainList(text: string): string[] {
  return text.split(/<br\s*\/?>|\n/i).map(plain).filter(Boolean)
}

// ── Sports table module ───────────────────────────────────────────────

export interface TableRow {
  code: string
  name: string
  w: number; d: number; l: number; gf: number; ga: number
  adjust: number
  pts: number
}

/** Named arguments of every {{#invoke:Sports table|…}} on a page, in page order. */
export function sportsTables(wt: string): Map<string, string>[] {
  const out: Map<string, string>[] = []
  const re = /\{\{\s*#invoke:\s*[Ss]ports table/g
  for (let m; (m = re.exec(wt));) {
    const end = closeOf(wt, m.index)
    // editors leave instructions in comments, even inside team_order
    const inner = wt.slice(m.index + 2, end - 2).replace(/<!--[\s\S]*?-->/g, '')
    const args = new Map<string, string>()
    for (const part of splitTop(inner, '|').slice(1)) {
      const eq = part.indexOf('=')
      if (eq < 0) continue
      args.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
    }
    out.push(args)
    re.lastIndex = end
  }
  return out
}

/**
 * The table in the order the module prints it, which is the official order —
 * head-to-head and deductions included, so it is not recomputed here.
 */
export function readSportsTable(args: Map<string, string>): TableRow[] {
  let order: string[]
  const listed = args.get('team_order')
  if (listed) order = listed.split(',').map((c) => c.trim()).filter(Boolean)
  else {
    order = [...args.keys()]
      .map((k) => k.match(/^team(\d+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((m) => args.get(m[0])!.trim())
  }
  return order.map((code) => {
    const num = (key: string, fallback?: number) => {
      const raw = args.get(`${key}_${code}`)
      if (raw === undefined || raw === '') {
        if (fallback !== undefined) return fallback
        throw new Error(`${key}_${code} vantar í töflu`)
      }
      const n = Number(plain(raw).replace('−', '-'))
      if (!Number.isFinite(n)) throw new Error(`${key}_${code} er ekki tala: ${raw}`)
      return n
    }
    const w = num('win'), d = num('draw'), l = num('loss')
    const adjust = num('adjust_points', 0)
    return {
      code, name: plain(args.get(`name_${code}`) ?? code),
      w, d, l, gf: num('gf'), ga: num('ga'), adjust, pts: 3 * w + d + adjust,
    }
  })
}

// ── wikitables ────────────────────────────────────────────────────────

export interface Cell { text: string; header: boolean }

/** The wikitable that follows `marker`, from "{|" to its own "|}". */
export function tableAfter(wt: string, marker: string | RegExp): string {
  const at = typeof marker === 'string' ? wt.indexOf(marker) : wt.search(marker)
  if (at < 0) throw new Error(`fann ekki "${marker}"`)
  const start = wt.indexOf('{|', at)
  if (start < 0) throw new Error(`engin tafla á eftir "${marker}"`)
  let depth = 0
  const lines = wt.slice(start).split('\n')
  let length = 0
  for (const line of lines) {
    length += line.length + 1
    if (/^\s*\{\|/.test(line)) depth++
    else if (/^\s*\|\}/.test(line) && --depth === 0) break
  }
  return wt.slice(start, start + length)
}

const ATTRS = /^\s*(?:[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'|]+)\s*)+$/i

/** Cell text with its attribute prefix (rowspan="3" | …) removed. */
function cellParts(raw: string): { text: string; rowspan: number } {
  const parts = splitTop(raw, '|')
  if (parts.length > 1 && ATTRS.test(parts[0])) {
    const span = parts[0].match(/rowspan\s*=\s*"?(\d+)/i)
    return { text: parts.slice(1).join('|'), rowspan: span ? Number(span[1]) : 1 }
  }
  return { text: raw, rowspan: 1 }
}

/**
 * Rows of a wikitable with rowspans filled in, so a tie spread over three rows
 * gives three complete rows. A cell's text keeps its markup; use plain() on it.
 */
export function wikitableRows(table: string): Cell[][] {
  const body = table.replace(/^\s*\{\|[^\n]*\n/, '').replace(/\n\s*\|\}\s*$/, '')
  const rawRows: { raw: string; header: boolean }[][] = [[]]
  for (const line of body.split('\n')) {
    if (/^\s*\|-/.test(line)) { rawRows.push([]); continue }
    if (/^\s*\|\+/.test(line)) continue
    const row = rawRows[rawRows.length - 1]
    const first = line.trimStart()[0]
    if (first === '|' || first === '!') {
      const header = first === '!'
      const content = line.trimStart().slice(1)
      for (const piece of splitTop(content, header ? '!!' : '||')) row.push({ raw: piece, header })
    } else if (row.length) {
      row[row.length - 1].raw += '\n' + line
    }
  }

  const pending = new Map<number, { cell: Cell; left: number }>()
  const out: Cell[][] = []
  for (const raw of rawRows) {
    if (!raw.length) continue
    const row: Cell[] = []
    const take = () => {
      for (let span; (span = pending.get(row.length));) {
        row.push(span.cell)
        if (--span.left === 0) pending.delete(row.length - 1)
      }
    }
    for (const { raw: text, header } of raw) {
      take()
      const { text: content, rowspan } = cellParts(text)
      const isRowHeader = header && /scope\s*=\s*"?row/i.test(text)
      const cell = { text: content.trim(), header: header && !isRowHeader }
      if (rowspan > 1) pending.set(row.length, { cell, left: rowspan - 1 })
      row.push(cell)
    }
    take()
    out.push(row)
  }
  // a row made only of spanned cells is not a row of its own
  return out.filter((r) => r.some((c) => c.text !== '' || c.header))
}

/** Data rows only, as plain text per column. */
export function dataRows(table: string): string[][] {
  return wikitableRows(table).filter((r) => !r.every((c) => c.header)).map((r) => r.map((c) => c.text))
}
