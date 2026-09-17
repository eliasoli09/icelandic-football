/**
 * Readers for the two careers "Hver er maðurinn?" compares: the Transfermarkt
 * transfer history and profile, and the infobox of the en.wikipedia article.
 * All pure, so each can be tested on a copy of the markup it met.
 */
import { closeOf, plain, splitTop } from '../topp10/wikitext'
import { normalise } from '../../src/lib/topp10/normalise'

// ── Wikipedia infobox ────────────────────────────────────────────────

/** The named parameters of {{Infobox football biography}}, or null without one. */
export function infobox(wt: string): Map<string, string> | null {
  const start = wt.search(/\{\{\s*Infobox (?:football|soccer) biography/i)
  if (start < 0) return null
  const body = wt.slice(start + 2, closeOf(wt, start) - 2)
  const params = new Map<string, string>()
  for (const part of splitTop(body, '|').slice(1)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    params.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).replace(/<!--[\s\S]*?-->/g, '').trim())
  }
  return params
}

export interface WikiSpell {
  from: number
  /** null while the spell is still going, "2025–" */
  to: number | null
  /** the link label, as a reader sees it */
  club: string
  /** the article the club links to */
  target: string | null
  loan: boolean
}

/** A year span as infoboxes write it: 2008–2010, 2008, 2025–, 2012–13. */
export function years(text: string): { from: number; to: number | null } | null {
  const t = plain(text).replace(/&ndash;|—|−|-/g, '–').replace(/\s+/g, '')
  let m = t.match(/^(\d{4})$/)
  if (m) return { from: +m[1], to: +m[1] }
  m = t.match(/^(\d{4})–$/)
  if (m) return { from: +m[1], to: null }
  m = t.match(/^(\d{4})–(\d{2}|\d{4})$/)
  if (m) {
    const to = m[2].length === 2 ? +(m[1].slice(0, 2) + m[2]) : +m[2]
    return to >= +m[1] ? { from: +m[1], to } : null
  }
  return null
}

/** Senior career rows, in the infobox's order. Throws on a row it cannot read. */
export function wikiCareer(params: Map<string, string>): WikiSpell[] {
  const spells: WikiSpell[] = []
  for (let i = 1; params.has(`clubs${i}`) || params.has(`years${i}`); i++) {
    const rawClub = params.get(`clubs${i}`) ?? ''
    const rawYears = params.get(`years${i}`) ?? ''
    if (!plain(rawClub) && !plain(rawYears)) continue
    const span = years(rawYears)
    if (!span) throw new Error(`ár í röð ${i} ólesanleg: "${rawYears}"`)
    const link = rawClub.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/)
    let club = plain(rawClub)
    const loan = /^(?:→|&rarr;|\{\{→\}\})/.test(rawClub.trim()) || /\(\s*loan\s*\)/i.test(club)
    club = club.replace(/^→\s*/, '').replace(/\(\s*loan\s*\)/i, '').replace(/\s+/g, ' ').trim()
    if (!club) throw new Error(`félag í röð ${i} ólesanlegt: "${rawClub}"`)
    spells.push({ ...span, club, target: link ? link[1].trim() : null, loan })
  }
  return spells
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** {{birth date and age|1989|9|8|df=y}} and its relatives, as yyyy-mm-dd. The month may be a word. */
export function wikiBirth(params: Map<string, string>): string | null {
  const raw = params.get('birth_date') ?? ''
  const t = raw.match(/\{\{\s*(?:birth[ _]date and age|birth[ _]date|bda|dob|birth-date and age)\s*\|([^{}]*)\}\}/i)
  if (!t) return null
  const parts = t[1].split('|').map((s) => s.trim()).filter((s) => !s.includes('='))
  if (parts.length < 3) return null
  const [y, m, d] = parts
  const month = /^\d+$/.test(m) ? +m : MONTHS.indexOf(m.toLowerCase()) + 1
  if (!/^\d{4}$/.test(y) || !month || !/^\d{1,2}$/.test(d)) return null
  return `${y}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`
}

export type Line = 'GK' | 'DF' | 'MF' | 'FW'

/** The lines a written position belongs to. A winger counts as midfield and attack. */
export function linesOf(text: string): Set<Line> {
  const t = text.toLowerCase()
  const out = new Set<Line>()
  // squad-list abbreviations
  for (const code of text.toUpperCase().match(/\b(?:GK|DF|MF|FW)\b/g) ?? []) out.add(code as Line)
  if (/goalkeeper|keeper/.test(t)) out.add('GK')
  if (/defender|back|sweeper|libero|defence/.test(t)) out.add('DF')
  if (/midfield|playmaker|winger|wing half|half-back|halfback|midfield/.test(t)) out.add('MF')
  if (/forward|striker|winger|attack|inside left|inside right|outside left|outside right/.test(t)) out.add('FW')
  if (/wing[- ]back/.test(t)) { out.delete('FW'); out.add('DF') }
  return out
}

/** Senior national teams in the infobox: no youth, B or Olympic sides. */
export function wikiNationalTeams(params: Map<string, string>): string[] {
  const teams: string[] = []
  for (const [key, value] of params) {
    if (!/^nationalteam\d+$/.test(key)) continue
    const team = plain(value)
    if (!team || isYouthTeam(team)) continue
    if (!teams.includes(team)) teams.push(team)
  }
  return teams
}

export const isYouthTeam = (name: string) =>
  /\bU-?\d{2}\b|under-?\s?\d{2}|\bB\b|olympic|amateur|youth|\bXI\b|league|universit/i.test(name)

// ── Transfermarkt ────────────────────────────────────────────────────

export interface TmClub { name: string; slug: string; id: string; iceland: boolean; special: boolean }
export interface TmMove { date: string; from: TmClub; to: TmClub; kind: 'loan' | 'end-of-loan' | 'transfer'; upcoming: boolean }

interface CeapiClub { isSpecial: boolean; href: string; clubName: string; countryFlag: string | null }
interface CeapiTransfer { dateUnformatted: string; from: CeapiClub; to: CeapiClub; fee: string; upcoming: boolean; futureTransfer: number }

const ICELAND_FLAG = /\/flagge\/[a-z]+\/73\.png/

function tmClub(c: CeapiClub): TmClub {
  const parts = c.href.split('/')
  return { name: c.clubName, slug: parts[1] ?? '', id: parts[4] ?? '', iceland: ICELAND_FLAG.test(c.countryFlag ?? ''), special: c.isSpecial }
}

/** The transfer history JSON, oldest move first. */
export function tmMoves(json: { transfers: CeapiTransfer[] }): TmMove[] {
  return json.transfers
    .map((t) => {
      const fee = plain(t.fee).toLowerCase()
      const kind = /end of loan/.test(fee) ? 'end-of-loan' as const : /loan/.test(fee) ? 'loan' as const : 'transfer' as const
      return { date: t.dateUnformatted, from: tmClub(t.from), to: tmClub(t.to), kind, upcoming: t.upcoming || t.futureTransfer === 1 }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

const YOUTH = /\b(?:U-?\d{2}|Yth\.?|Youth|Jgd\.?|Academy|Jun\.?|Res\.?|Reserves|II)(?=\s|$)/gi
export const isTmYouth = (name: string) => new RegExp(YOUTH.source, 'i').test(name)
/** "AZ Alkmaar U21" → "AZ Alkmaar" */
export const seniorName = (name: string) => name.replace(YOUTH, ' ').replace(/\s+/g, ' ').trim()

export interface TmSpell {
  /** the date he joined, or null where Transfermarkt shows him leaving a club it never shows him joining */
  from: string | null
  /** for an unknown start: the last move before it, so the spell began after this */
  after: string | null
  to: string | null
  club: TmClub
  loan: boolean
  /** a youth or reserve side: it may stand for the club on Wikipedia, or not appear there at all */
  optional: boolean
}

/**
 * Transfermarkt's moves as spells. A return from loan continues the parent
 * spell; "Without Club", "Career break" and "Retired" end one. Consecutive
 * loans to the same club from the same parent are one spell, as Wikipedia
 * writes a loan renewed each Icelandic season.
 */
export function tmSpells(moves: TmMove[]): TmSpell[] {
  const spells: TmSpell[] = []
  let parent: TmSpell | null = null
  let loan: TmSpell | null = null
  let loanParent: TmSpell | null = null
  let lastDate: string | null = null
  const close = (s: TmSpell | null, date: string) => { if (s && s.to === null) s.to = date }
  for (const move of moves.filter((m) => !m.upcoming)) {
    const { from, to } = move
    // leaving a club he was never shown joining: he was there before this date
    const atFrom = (loan && loan.club.slug === from.slug) || (parent && parent.club.slug === from.slug)
    if (!from.special && !atFrom && move.kind !== 'end-of-loan') {
      close(loan, move.date); loan = null
      close(parent, move.date)
      // the club his history starts from, never shown joining it: often a youth, college or amateur side
      parent = { from: null, after: lastDate, to: null, club: from, loan: false, optional: isTmYouth(from.name) || lastDate === null }
      spells.push(parent)
    }
    lastDate = move.date
    if (move.kind === 'end-of-loan') {
      close(loan, move.date); loan = null
      continue
    }
    if (to.special) {
      close(loan, move.date); loan = null
      close(parent, move.date); parent = null
      continue
    }
    if (move.kind === 'loan') {
      close(loan, move.date)
      const prev = spells.filter((s) => s.loan).pop()
      // renewed from the same parent, or carried over within weeks when he changed parent clubs mid-loan
      const renewed = prev && prev.club.slug === to.slug && loanParent === parent && spells[spells.length - 1] === prev
      const carried = prev && prev.club.slug === to.slug && prev.to && Date.parse(move.date) - Date.parse(prev.to) <= 60 * 86_400_000
      if (prev && (renewed || carried)) {
        prev.to = null; loan = prev
        continue
      }
      loan = { from: move.date, after: null, to: null, club: to, loan: true, optional: isTmYouth(to.name) }
      loanParent = parent
      spells.push(loan)
      continue
    }
    close(loan, move.date); loan = null
    if (parent && parent.club.slug === to.slug) continue
    close(parent, move.date)
    parent = { from: move.date, after: null, to: null, club: to, loan: false, optional: isTmYouth(to.name) }
    spells.push(parent)
  }
  return spells
}

export interface TmProfile {
  /** "Name in home country", else the headline name */
  name: string
  /** the name is the home-country spelling */
  home: boolean
  headline: string
  born: string | null
  position: string | null
  citizenship: string[]
  /** senior or youth side named as the player's international team */
  international: string | null
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim()

export function tmProfile(html: string): TmProfile {
  const h1 = html.match(/<h1 class="data-header__headline-wrapper">([\s\S]*?)<\/h1>/)
  if (!h1) throw new Error('prófíll Transfermarkt án fyrirsagnar')
  const headline = text(h1[1].replace(/<span class="data-header__shirt-number">[\s\S]*?<\/span>/, ''))
  const home = html.match(/Name in home country:<\/span>\s*<span[^>]*>([^<]+)<\/span>/)
  const born = html.match(/itemprop="birthDate"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})/)
  const position = html.match(/<li class="data-header__label">Position:\s*<span[^>]*>([^<]+)<\/span>/)
  const citizenship = html.match(/itemprop="nationality"[^>]*>([\s\S]*?)<\/span>/)
  const intl = html.match(/(?:Current international|Former international|National player):\s*<span[^>]*>([\s\S]*?)<\/span>/i)
  return {
    name: home ? text(home[1]) : headline,
    home: !!home,
    headline,
    born: born ? `${born[3]}-${born[2]}-${born[1]}` : null,
    position: position ? text(position[1]) : null,
    citizenship: citizenship ? [...citizenship[1].matchAll(/title="([^"]+)"/g)].map((m) => m[1]) : [],
    international: intl ? text(intl[1]) || null : null,
  }
}

/** Transfermarkt's main position in the lines it belongs to. */
export function tmLines(position: string): Set<Line> {
  const p = position.toLowerCase()
  if (p === 'goalkeeper') return new Set(['GK'])
  if (/back|defender|sweeper/.test(p)) return new Set(['DF'])
  if (/winger|left midfield|right midfield/.test(p)) return new Set(['MF', 'FW'])
  if (/midfield/.test(p)) return new Set(['MF'])
  if (/forward|striker|attack/.test(p)) return new Set(['FW'])
  return new Set()
}

// ── comparing ────────────────────────────────────────────────────────

/** Words that say what kind of club it is, not which. */
const GENERIC = new Set(['fc', 'afc', 'cf', 'ac', 'sc', 'sk', 'bk', 'if', 'fk', 'cd', 'ud', 'sd', 'ss', 'as', 'us', 'rc', 'tsg', 'vfb', 'vfl', 'sv', 'club', 'calcio', 'football', 'soccer', 'mens', 'men', 's', 'a', 'f', 'c', 'the', 'de', 'kfc', 'ks', 'nk', 'fotball', 'fotbal', 'fotbollsklubb', 'fodbold', 'knattspyrnufelagid', 'knattspyrnudeild', 'ungmennafelagid', 'ithrottabandalag', 'u', 'boldklub', 'bold', 'ik', 'ff', 'il', 'sportklub', 'team'])

/** Transfermarkt's short forms of whole words. */
const EXPAND: Record<string, string> = { utd: 'united', wed: 'wednesday', st: 'saint' }

function words(s: string): string[] {
  const raw = normalise(s.replace(/\(.*?\)/g, ' ')).split(' ').filter(Boolean)
  // N.E.C. is one word, not three
  const joined: string[] = []
  raw.forEach((w, i) => {
    if (w.length === 1 && i > 0 && raw[i - 1].length === 1) joined[joined.length - 1] += w
    else joined.push(w)
  })
  return joined.map((w) => EXPAND[w] ?? w).filter((w) => !GENERIC.has(w))
}

/**
 * One name's words found, in order, in the other's. A word may stand short for
 * a longer one only where it is plainly a short form: marked with a full stop
 * ("Heart of Midl."), part of a name of two words or more ("Sheff Wed", "Man
 * Utd"), or the same word with a genitive s ("Djurgården", "Djurgårdens IF").
 * So "Fram" never finds "Framherjar". At least one word must be whole or four
 * letters or more, so "T." alone never names a club.
 */
export function sameClubName(a: string, b: string): boolean {
  const x = words(a), y = words(b)
  if (!x.length || !y.length) return false
  const [short, long, shortText] = x.length <= y.length ? [x, y, a] : [y, x, b]
  const dotted = new Set(normalise(shortText.replace(/(\p{L}+)\./gu, '$1dot ')).split(' ').filter((w) => w.endsWith('dot')).map((w) => w.slice(0, -3)))
  let at = 0, anchored = false
  for (const w of short) {
    let found = -1
    for (let i = at; i < long.length; i++) {
      const prefix = long[i].startsWith(w) && (dotted.has(w) || short.length > 1 || long[i] === `${w}s`)
      if (long[i] === w || prefix) { found = i; break }
    }
    if (found < 0) return false
    if (long[found] === w || w.length >= 4) anchored = true
    at = found + 1
  }
  return anchored
}

export interface CareerRow { from: number; to: number | null; club: string; target: string | null; loan: boolean; iceland: boolean; tm: TmClub }

export interface Agreement { rows: CareerRow[]; problems: string[]; pairs: [string, string][] }

/**
 * The career both sources give. Every Wikipedia spell must meet a Transfermarkt
 * spell at a club of the same name, of the same kind (loan or not), starting
 * the same year or one either side (a registration date against a season), and
 * every Transfermarkt spell must be met. The years shown are Wikipedia's, the
 * season a spell covered, in order of those years; Transfermarkt's order decides ties.
 */
export function agreeCareers(wikiRows: WikiSpell[], tm: TmSpell[], same: (tm: TmClub, wiki: WikiSpell) => boolean): Agreement {
  const problems: string[] = []
  const pairs: [string, string][] = []
  // a loan renewed for a second season is one spell, whichever way it is written
  const wiki: WikiSpell[] = []
  for (const w of wikiRows) {
    const prev = wiki[wiki.length - 1]
    if (prev && prev.loan && w.loan && normalise(prev.club) === normalise(w.club) && prev.to !== null && w.from - prev.to <= 1) {
      wiki[wiki.length - 1] = { ...prev, to: w.to }
    } else wiki.push(w)
  }
  const year = (date: string) => +date.slice(0, 4)
  const fits = (t: TmSpell, w: WikiSpell) => {
    if (t.from) return Math.abs(year(t.from) - w.from) <= 1
    // the start is unknown: the spell must end when Transfermarkt's does and begin after the move before it
    if (t.to && (w.to === null || Math.abs(year(t.to) - w.to) > 1)) return false
    if (t.after && w.from < year(t.after) - 1) return false
    return true
  }
  const matched = new Map<WikiSpell, number>()
  const used = new Set<number>()
  // exact kind before either kind, a senior side before a youth side
  for (const [optional, anyKind] of [[false, false], [true, false], [false, true], [true, true]] as const) {
    for (const w of wiki) {
      if (matched.has(w)) continue
      let best = -1, bestGap = Infinity
      tm.forEach((t, i) => {
        if (used.has(i) || t.optional !== optional || (!anyKind && t.loan !== w.loan) || !same(t.club, w) || !fits(t, w)) return
        const gap = t.from ? Math.abs(year(t.from) - w.from) : 1
        if (gap < bestGap) { best = i; bestGap = gap }
      })
      if (best >= 0) { matched.set(w, best); used.add(best) }
    }
  }
  const rows: (CareerRow & { order: number })[] = []
  for (const w of wiki) {
    const i = matched.get(w)
    if (i === undefined) { problems.push(`Wikipedia ${w.from} ${w.club}${w.loan ? ' (lán)' : ''} finnst ekki á Transfermarkt`); continue }
    const t = tm[i]
    pairs.push([t.club.name, w.club])
    // a loan only one source calls a loan is shown as a plain spell
    rows.push({ from: w.from, to: w.to, club: w.club, target: w.target, loan: w.loan && t.loan, iceland: t.club.iceland, tm: t.club, order: i })
  }
  tm.forEach((t, i) => {
    if (!used.has(i) && !t.optional) problems.push(`Transfermarkt ${t.from ?? `fyrir ${t.to}`} ${t.club.name}${t.loan ? ' (lán)' : ''} finnst ekki á Wikipedia`)
  })
  const lastWiki = wiki.filter((w) => !w.loan).pop()
  const lastTm = tm.filter((t, i) => !t.loan && (used.has(i) || !t.optional)).pop()
  if (lastWiki && lastTm && (lastWiki.to === null) !== (lastTm.to === null)) {
    problems.push(`ósammála um hvort ${lastWiki.club} sé enn félag hans`)
  }
  rows.sort((a, b) => a.from - b.from || a.order - b.order)
  return { rows: rows.map(({ order: _order, ...r }) => r), problems, pairs }
}

// ── names ────────────────────────────────────────────────────────────

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
}

/**
 * The name Icelanders know a player by (Wikidata's label, middle names and
 * all, never the full legal name), each word spelt as the sources spell it:
 * "Jon Gudni Fjóluson" becomes "Jón Guðni Fjóluson". A word one letter off is
 * corrected only where Transfermarkt and Wikipedia both write it the same way.
 */
export function respell(known: string, home: string | null, title: string): string {
  const spellings = [...(home ? home.split(/\s+/) : []), ...title.split(/\s+/)]
  return known.split(/\s+/).map((word) => {
    const key = normalise(word)
    const same = spellings.find((w) => normalise(w) === key)
    if (same) return same
    if (!home || key.length < 6) return word
    const fromHome = home.split(/\s+/).find((w) => oneEditApart(normalise(w), key))
    const fromTitle = title.split(/\s+/).find((w) => oneEditApart(normalise(w), key))
    return fromHome && fromHome === fromTitle ? fromHome : word
  }).join(' ')
}

