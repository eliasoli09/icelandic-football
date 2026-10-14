// Script- and test-only: reads Wikipedia HTML with cheerio (a dev dependency). Pages read the JSON.
import { load, type CheerioAPI } from 'cheerio'
import type { Award, AwardWinner } from './awards'

type Cell = { text: string; names: string[] }

const clean = (s: string) =>
  s.replace(/\[[^\]]*\]/g, '').replace(/\(\d+\)/g, '').replace(/[†*‡^§¤#]/g, '').replace(/\s+/g, ' ').trim()

/** Rows of a table as cells, rowspans expanded, footnote markers dropped. */
function grid($: CheerioAPI, table: Parameters<CheerioAPI>[0]): Cell[][] {
  const out: Cell[][] = []
  const carry = new Map<number, { cell: Cell; left: number }>()
  $(table).find('tr').each((_, tr) => {
    const row: Cell[] = []
    let col = 0
    const take = () => { while (carry.has(col)) { const c = carry.get(col)!; row.push(c.cell); if (--c.left === 0) carry.delete(col); col++ } }
    $(tr).children('th,td').each((_, el) => {
      take()
      const $el = $(el)
      $el.find('sup, style, .sortkey, .reference').remove()
      const names = $el.find('a[href^="/wiki/"]').map((_, a) => clean($(a).text())).get().filter(Boolean)
      const cell = { text: clean($el.text()), names }
      const span = Number($el.attr('rowspan') ?? 1)
      const width = Number($el.attr('colspan') ?? 1)
      for (let w = 0; w < width; w++) {
        row.push(cell)
        if (span > 1) carry.set(col, { cell, left: span - 1 })
        col++
      }
    })
    take()
    out.push(row)
  })
  return out
}

/** The players in a cell: one per link when several share it, else the cell text. */
function playersIn(c: Cell): string[] {
  return c.names.length > 1 ? c.names : [c.names[0] ?? c.text].filter(Boolean)
}

const yearOf = (s: string) => { const m = /^(\d{4})/.exec(s); return m ? Number(m[1]) : null }

/** An award's own page: the winners table is the one headed Season | Player. */
export function parseAwardPage(html: string, award: Award): Omit<AwardWinner, 'player_id'>[] {
  const $ = load(html)
  const table = $('table.wikitable').filter((_, t) => {
    const head = $(t).find('tr').first().text()
    return /Season/.test(head) && /Player/.test(head)
  }).first()
  const rows = grid($, table)
  const head = rows[0].map((c) => c.text)
  const at = (k: string) => head.findIndex((h) => h.startsWith(k))
  const [iS, iP, iPos, iT] = [at('Season'), at('Player'), at('Position'), at('Team')]
  const out: Omit<AwardWinner, 'player_id'>[] = []
  for (const r of rows.slice(1)) {
    const season = yearOf(r[iS]?.text ?? '')
    if (!season || !r[iP]) continue
    const names = playersIn(r[iP])
    for (const name of names) {
      out.push({ season, award, name, position: names.length === 1 && iPos >= 0 ? r[iPos]?.text || null : null, team: names.length === 1 && iT >= 0 ? r[iT]?.text || null : null })
    }
  }
  return out
}

/** The AP table on the rookie page: Season | Offensive (name, team, pos) | Defensive (name, team, pos). */
export function parseRookiePage(html: string): Omit<AwardWinner, 'player_id'>[] {
  const $ = load(html)
  const rows = grid($, $('table.wikitable').first())
  const out: Omit<AwardWinner, 'player_id'>[] = []
  for (const r of rows) {
    const season = yearOf(r[0]?.text ?? '')
    if (!season || r.length < 7) continue
    for (const [award, i] of [['OROY', 1], ['DROY', 4]] as const) {
      const names = playersIn(r[i])
      for (const name of names) out.push({ season, award, name, team: names.length === 1 ? r[i + 1].text || null : null, position: names.length === 1 ? r[i + 2].text || null : null })
    }
  }
  return out
}

const SEASON_AWARDS: [RegExp, Award][] = [
  [/^Most Valuable Player/, 'MVP'], [/^Offensive Player of the Year/, 'OPOY'], [/^Defensive Player of the Year/, 'DPOY'],
  [/^Offensive Rookie of the Year/, 'OROY'], [/^Defensive Rookie of the Year/, 'DROY'], [/^Comeback Player of the Year/, 'CPOY'],
]

/** A season page's "Award | Winner" table, where there is one; empty otherwise. */
export function parseSeasonPage(html: string, season: number): Omit<AwardWinner, 'player_id'>[] {
  const $ = load(html)
  const table = $('table.wikitable').filter((_, t) => /Award/.test($(t).find('tr').first().text()) && /Winner/.test($(t).find('tr').first().text())).first()
  if (!table.length) return []
  const out: Omit<AwardWinner, 'player_id'>[] = []
  for (const r of grid($, table).slice(1)) {
    const award = SEASON_AWARDS.find(([re]) => re.test(r[0]?.text ?? ''))?.[1]
    if (!award || !r[1]) continue
    for (const name of playersIn(r[1])) out.push({ season, award, name, position: r[2]?.text || null, team: r[3]?.text || null })
  }
  return out
}

/**
 * Lower case, no accents or punctuation, no Jr./Sr./II/III, single initials
 * joined: "Odell Beckham Jr." -> "odell beckham", "J. J. Watt" -> "jj watt".
 */
export function normName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['\u2019,]/g, '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/, '')
    .replace(/\b([a-z]) (?=[a-z]\b)/g, '$1')
}

export { OFFENCE_POSITIONS as OFFENCE } from './positions'
import { OFFENCE_POSITIONS as OFFENCE } from './positions'
export type Side = 'offence' | 'defence'

/**
 * Exact normalised match only (Gildrur 2). Namesakes in the same season are
 * told apart by side of the ball when exactly one fits; otherwise null.
 */
export function linkWinner(
  name: string,
  pool: { player_id: string; name: string; position?: string | null; rookie_season?: number | null }[],
  side?: Side,
  rookieSeason?: number,
): string | null {
  const n = normName(ALIASES[normName(name)] ?? name)
  let hits = pool.filter((p) => normName(p.name) === n)
  if (hits.length > 1 && side) hits = hits.filter((p) => (side === 'offence') === OFFENCE.has(p.position ?? ''))
  if (hits.length > 1 && rookieSeason) hits = hits.filter((p) => p.rookie_season === rookieSeason)
  return hits.length === 1 ? hits[0].player_id : null
}

/**
 * Wikipedia name -> the name nflverse uses, checked by hand one at a time
 * (14 Oct 2026). Never a general nickname rule: that is the fuzzy matching
 * Gildrur 2 warns about.
 */
export const ALIASES: Record<string, string> = {
  'michael vick': 'Mike Vick',
  'patrick surtain': 'Pat Surtain II',
}
