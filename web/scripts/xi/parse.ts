/**
 * Readers for the three places a starting eleven is published: KSÍ match
 * reports, Transfermarkt line-up pages and Wikipedia match articles. Each
 * returns what the page says and nothing it had to guess; comparing them is
 * build.mts's job.
 */
import { closeOf, plain, splitTop } from '../topp10/wikitext'

export interface SourcePlayer {
  number: number
  name: string
  /** the short form a source prints, "R. Óskarsson" */
  short?: string
  /** a match position on Wikipedia ("RB"), a player's usual one on Transfermarkt ("Right-Back") */
  position?: string
  goalkeeper: boolean
  captain: boolean
  /** KSÍ's player id, which its match events refer to */
  ksiId?: number
  /** nationalities, as Transfermarkt's flags name them */
  nations?: string[]
}

export interface SourceGoal { name: string; side: 'home' | 'away'; ownGoal: boolean; ksiId?: number }

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const MONTHS_IS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// ── KSÍ ────────────────────────────────────────────────────────────────

export interface KsiReport {
  date: string
  competition: string
  home: string
  away: string
  score: [number, number]
  lineups: { home: SourcePlayer[]; away: SourcePlayer[] }
}

/** The report tab of a KSÍ match page (leikur?id=N&banner-tab=report). */
export function parseKsiReport(html: string): KsiReport {
  const score = html.match(/<h1[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/h1>/)
  if (!score) throw new Error('KSÍ: úrslit fundust ekki')
  const date = html.match(/<span[^>]*>\s*[A-ZÁÐÉÍÓÚÝÞÆÖa-záðéíóúýþæö]{3}\s+(\d{1,2})\.\s+([a-záéíóúýþæöð]+)\s+(\d{4})\s+\d{1,2}:\d{2}\s*<\/span>/)
  if (!date || MONTHS_IS.indexOf(date[2]) < 0) throw new Error('KSÍ: dagsetning fannst ekki')
  const competition = html.match(/<span[^>]*>([^<]{3,80}\s\/\s[^<]{1,40})<\/span>/)
  const teams = [...html.matchAll(/href="\/oll-mot\/mot\/lid\?id=\d+[^"]*"[^>]*>[\s\S]{0,600}?<span[^>]*>([^<]+)<\/span>/g)].map((m) => decode(m[1]).trim())
  if (teams.length < 2) throw new Error('KSÍ: liðin fundust ekki')

  const side = (panel: 'home' | 'away') => {
    const groups: SourcePlayer[][] = []
    for (const start of [...html.matchAll(new RegExp(`data-panel="${panel}"`, 'g'))].map((m) => m.index!)) {
      const rest = html.slice(start + 20)
      const end = rest.search(/data-panel="/)
      const block = end < 0 ? rest : rest.slice(0, end)
      const rows = [...block.matchAll(/leikmadur\?id=(\d+)"[^>]*>\s*<div[^>]*>\s*<span[^>]*>(\d+)<\/span>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>([^<]+)<\/span>/g)]
      if (!rows.length) continue
      groups.push(rows.map((r) => {
        const full = decode(r[3]).trim()
        return {
          number: Number(r[2]),
          name: full.replace(/\s*\((?:M|F)\)/g, '').trim(),
          short: decode(r[4]).trim(),
          goalkeeper: /\(M\)/.test(full),
          captain: /\(F\)/.test(full),
          ksiId: Number(r[1]),
        }
      }))
    }
    // the first group is the starting eleven, the second the substitutes
    if (!groups.length) throw new Error(`KSÍ: byrjunarlið ${panel} fannst ekki`)
    return groups[0]
  }

  return {
    date: iso(Number(date[3]), MONTHS_IS.indexOf(date[2]) + 1, Number(date[1])),
    competition: competition ? decode(competition[1]).trim() : '',
    home: teams[0], away: teams[1],
    score: [Number(score[1]), Number(score[2])],
    lineups: { home: side('home'), away: side('away') },
  }
}

// ── Transfermarkt ──────────────────────────────────────────────────────

/** Every match on a club's "fixtures by date" page, with its report id. */
export function parseTmFixtures(html: string): { id: number; date: string; text: string }[] {
  const out: { id: number; date: string; text: string }[] = []
  for (const row of html.split('<tr').slice(1)) {
    const id = row.match(/\/spielbericht\/index\/spielbericht\/(\d+)/)
    const d = text(row).match(/\b(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b/)
    if (!id || !d) continue
    const yy = Number(d[3])
    const year = d[3].length === 4 ? yy : yy > 50 ? 1900 + yy : 2000 + yy
    out.push({ id: Number(id[1]), date: iso(year, Number(d[2]), Number(d[1])), text: text(row) })
  }
  return out
}

export interface TmLineups { home: { team: string; players: SourcePlayer[] }; away: { team: string; players: SourcePlayer[] } }

/** The line-up tab (spielbericht/aufstellung/spielbericht/N). */
export function parseTmLineups(html: string): TmLineups {
  const starts = [...html.matchAll(/Starting Line-up/g)].map((m) => m.index!)
  if (starts.length !== 2) throw new Error(`Transfermarkt: ${starts.length} byrjunarlið á síðunni`)
  const read = (at: number) => {
    const before = html.slice(Math.max(0, at - 800), at)
    const team = [...before.matchAll(/<a title="([^"]+)" href="\/[^"]*\/startseite\/verein\//g)].pop()
    const rest = html.slice(at + 10)
    const ends = [rest.indexOf('Starting Line-up'), rest.indexOf('Substitutes')].filter((i) => i >= 0)
    const block = ends.length ? rest.slice(0, Math.min(...ends)) : rest.slice(0, 40000)
    const rows = block.split(/<td\s+class="zentriert rueckennummer/).slice(1)
    const players = rows.map((row) => {
      const number = row.match(/<div class="rn_nummer">\s*(\d+)\s*<\/div>/)
      const position = row.match(/^[^"]*"\s*title="([^"]*)"/)
      const name = row.match(/class="wichtig"[^>]*>([^<]+)<\/a>/)
      if (name && !number) throw new Error(`Transfermarkt: treyjunúmer vantar hjá ${decode(name[1]).trim()}`)
      if (!number || !name) throw new Error('Transfermarkt: ólesanleg röð í byrjunarliði')
      return {
        number: Number(number[1]),
        name: decode(name[1]).trim(),
        position: position ? decode(position[1]) : undefined,
        goalkeeper: position ? /goalkeeper/i.test(position[1]) : false,
        captain: /kapitaenicon/.test(row),
        nations: [...row.matchAll(/<img[^>]*title="([^"]+)"[^>]*class="flaggenrahmen"/g)].map((m) => decode(m[1])),
      }
    })
    return { team: team ? decode(team[1]) : '', players }
  }
  return { home: read(starts[0]), away: read(starts[1]) }
}

export interface TmReport {
  date: string; home: string; away: string
  /** after extra time where there was any, never including a shoot-out */
  score: [number, number]
  extraTime: boolean
  penalties?: [number, number]
  goals: SourceGoal[]
}

/** The overview tab (spielbericht/index/spielbericht/N). */
export function parseTmReport(html: string): TmReport {
  const title = html.match(/<title>\s*(.+?)\s+-\s+(.+?),\s*(\d{2})\/(\d{2})\/(\d{4})\s+-/)
  if (!title) throw new Error('Transfermarkt: titill ólesanlegur')
  const score = html.match(/sb-endstand">\s*(\d+):(\d+)/)
  if (!score) throw new Error('Transfermarkt: úrslit fundust ekki')
  // "on pens" and "AET" sit in their own element after the score
  const after = text(html.slice(score.index! + score[0].length, score.index! + score[0].length + 400)).split('(')[0]
  const onPens = /on pens/i.test(after)
  const goals: SourceGoal[] = []
  const at = html.indexOf('id="sb-tore"')
  if (at >= 0) {
    const rest = html.slice(at + 10)
    const next = rest.search(/id="sb-(?!tore)/)
    const block = next < 0 ? rest : rest.slice(0, next)
    for (const li of block.split(/<li class="sb-aktion-/).slice(1)) {
      const name = li.match(/class="wichtig"[^>]*>([^<]+)<\/a>/)
      if (!name) continue
      goals.push({ name: decode(name[1]).trim(), side: li.startsWith('heim') ? 'home' : 'away', ownGoal: /own-goal/i.test(li) })
    }
  }
  // after a shoot-out the headline adds the kicks to the goals, so the score is counted from the goals
  const counted: [number, number] = [goals.filter((g) => g.side === 'home').length, goals.filter((g) => g.side === 'away').length]
  const headline: [number, number] = [Number(score[1]), Number(score[2])]
  return {
    date: iso(Number(title[5]), Number(title[4]), Number(title[3])),
    home: decode(title[1]).trim(), away: decode(title[2]).trim(),
    score: onPens ? counted : headline,
    extraTime: onPens || /\bAET\b/.test(after),
    ...(onPens ? { penalties: [headline[0] - counted[0], headline[1] - counted[1]] as [number, number] } : {}),
    goals,
  }
}

// ── Wikipedia ──────────────────────────────────────────────────────────

export interface WikiMatch {
  date: string
  home: string
  away: string
  score: [number, number]
  extraTime: boolean
  penalties?: string
  goals: { name: string; side: 'home' | 'away'; count: number }[]
  lineups: { home: SourcePlayer[]; away: SourcePlayer[] }
  kits: { home?: string; away?: string }
}

function wikiDate(raw: string): string | null {
  const start = raw.match(/\{\{\s*[Ss]tart date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/)
  if (start) return iso(Number(start[1]), Number(start[2]), Number(start[3]))
  const p = plain(raw)
  const dmy = p.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (dmy && MONTHS_EN.includes(dmy[2].toLowerCase())) return iso(Number(dmy[3]), MONTHS_EN.indexOf(dmy[2].toLowerCase()) + 1, Number(dmy[1]))
  const mdy = p.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/)
  if (mdy && MONTHS_EN.includes(mdy[1].toLowerCase())) return iso(Number(mdy[3]), MONTHS_EN.indexOf(mdy[1].toLowerCase()) + 1, Number(mdy[2]))
  return null
}

/** A link's article title, which is the fullest form of a name, or the plain text. */
const fullName = (cell: string) => {
  const link = cell.match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/)
  return link ? link[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : plain(cell)
}
const shownName = (cell: string) => {
  const link = cell.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/)
  return link ? link[1].trim() : plain(cell)
}

const COUNTRY: Record<string, string> = {
  ENG: 'England', ISL: 'Iceland', ARG: 'Argentina', FRA: 'France', BRA: 'Brazil', GER: 'Germany', ESP: 'Spain', ITA: 'Italy',
  POR: 'Portugal', CRO: 'Croatia', NGA: 'Nigeria', NED: 'Netherlands', BEL: 'Belgium', SUI: 'Switzerland', AUT: 'Austria',
  HUN: 'Hungary', WAL: 'Wales', NIR: 'Northern Ireland', RUS: 'Russia', SWE: 'Sweden', POL: 'Poland', URU: 'Uruguay',
  COL: 'Colombia', MEX: 'Mexico', USA: 'United States', CHI: 'Chile', DEN: 'Denmark', IRL: 'Republic of Ireland', MAR: 'Morocco',
}

/** "{{fb-rt|BRA}}" and its relatives name a country by code. */
function teamName(raw: string): string {
  // a crest flag beside a club's name is not the team: {{#invoke:flag|fbaicon|ENG}}, {{fbaicon|ENG}}
  raw = raw.replace(/\{\{\s*(?:#invoke:\s*flag\s*\|\s*)?fbaicon\s*\|[^}]*\}\}/g, '')
  // a national team: {{fb|ISL}}, {{fb-rt|ENG}}, {{#invoke:flag|fb-rt|ESP}}, {{#invoke:flagg|main|unpre|avar=fb|ARG}}
  const code = raw.match(/\{\{\s*(?:fb(?:-rt)?|#invoke:\s*flag\s*\|\s*fb(?:-rt)?|#invoke:\s*flagg\s*\|[^}]*?avar=fb[^}|]*)\s*\|\s*([A-Z]{3})\s*(?:\|[^}]*)?\}\}/)
  if (code) {
    if (!COUNTRY[code[1]]) throw new Error(`Wikipedia: óþekktur landskóði ${code[1]}`)
    return COUNTRY[code[1]]
  }
  return plain(raw)
}

/**
 * The football box played on `date` in an article, with the line-ups printed
 * after it. Where a page has several matches that day, `pick` chooses by teams.
 */
export function parseWikiMatch(wt: string, date: string, pick?: (home: string, away: string) => boolean): WikiMatch {
  const boxes = [...wt.matchAll(/\{\{\s*(?:[Ff]ootball ?box(?:\s+collapsible)?\s*\||#invoke:\s*[Ff]ootball box\s*\|\s*main)/g)]
    .map((m) => ({ start: m.index!, end: closeOf(wt, m.index!) }))
  const read = boxes.map((b) => {
    const args = new Map<string, string>()
    for (const part of splitTop(wt.slice(b.start + 2, b.end - 2), '|').slice(1)) {
      const eq = part.indexOf('=')
      if (eq > 0) args.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
    }
    return { ...b, args, date: wikiDate(args.get('date') ?? '') }
  })
  const hits = read.filter((b) => b.date === date && (!pick || pick(teamName(b.args.get('team1') ?? ''), teamName(b.args.get('team2') ?? ''))))
  if (hits.length !== 1) throw new Error(`Wikipedia: ${hits.length} leikir ${date} á síðunni`)
  const box = hits[0]
  const score = plain(box.args.get('score') ?? '').match(/(\d+)\s*[–-]\s*(\d+)/)
  if (!score) throw new Error('Wikipedia: úrslit ólesanleg')

  const goals: WikiMatch['goals'] = []
  for (const [key, side] of [['goals1', 'home'], ['goals2', 'away']] as const) {
    // scorers are separated by line breaks, or simply follow the previous scorer's goal template
    for (const entry of (box.args.get(key) ?? '').split(/<br\s*\/?>|\n\*?|(?<=\}\})\s+(?=\[\[|[A-ZÀ-Þ])/i)) {
      const marks = [...entry.matchAll(/\{\{\s*goal\s*\|([^}]*)\}\}/gi)]
      const own = marks.filter((m) => /o\.?g\.?/i.test(m[1])).length
      const count = marks.reduce((n, m) => n + (m[1].split('|').filter((x) => /^\s*\d/.test(x)).length || 1), 0) - own
      const name = fullName(entry.replace(/\{\{[^}]*\}\}/g, ''))
      if (name && count > 0) goals.push({ name, side, count })
    }
  }

  // line-ups and kits sit between this box and the next one
  const nextBox = read.find((b) => b.start > box.end)
  const region = wt.slice(box.end, nextBox ? nextBox.start : undefined)
  const kits = [...region.matchAll(/\{\{\s*Football kit[\s\S]*?\|\s*body\s*=\s*([0-9A-Fa-f]{6})/g)].map((m) => `#${m[1].toLowerCase()}`)

  const teams: SourcePlayer[][] = [[], []]
  let team = 0, subs = false
  for (const line of region.split('\n')) {
    if (team > 1) break
    if (/Substitut(?:es|ions)/.test(line)) { subs = true; continue }
    if (subs && /^\s*\{\|/.test(line)) { team++; subs = false; continue }
    // the position is a bare code or wrapped in {{abbr|RB|Right-back}}
    const row = line.match(/^\|\s*(?:\{\{\s*abbr\s*\|\s*)?([A-Z]{2,3})(?:\s*\|[^}]*\}\})?\s*\|\|\s*'''\s*(\d+)\s*'''\s*\|\|(.*)$/)
    if (!row || subs) continue
    const cell = splitTop(row[3], '||')[0]
    teams[team].push({
      number: Number(row[2]),
      name: shownName(cell.replace(/\(\s*\[\[[^\]]*\|\s*c\s*\]\]\s*\)|\{\{[^}]*\}\}/g, '')),
      short: undefined,
      position: row[1],
      goalkeeper: row[1] === 'GK',
      captain: /\|\s*c\s*\]\]|\(c\)|\{\{\s*captain/i.test(cell),
    })
    // keep the article's full name too, to match other sources on
    const link = fullName(cell.replace(/\(\s*\[\[[^\]]*\|\s*c\s*\]\]\s*\)/g, ''))
    teams[team][teams[team].length - 1].short = link
  }

  return {
    date,
    home: teamName(box.args.get('team1') ?? ''), away: teamName(box.args.get('team2') ?? ''),
    score: [Number(score[1]), Number(score[2])],
    extraTime: /a\.?e\.?t|extra time/i.test(`${box.args.get('score') ?? ''} ${box.args.get('aet') ?? ''}`) || box.args.has('penaltyscore'),
    penalties: box.args.get('penaltyscore') ? plain(box.args.get('penaltyscore')!) : undefined,
    goals,
    lineups: { home: teams[0], away: teams[1] },
    kits: { home: kits[0], away: kits[1] },
  }
}

/**
 * The line-ups box on the overview tab groups each eleven by line for this
 * match: goalkeeper, defenders, midfielders, forwards.
 */
export function parseTmLines(html: string): { home: Map<string, string>; away: Map<string, string> } | null {
  const boxes = [...html.matchAll(/aufstellung-unterueberschrift-mannschaft/g)].map((m) => m.index!)
  if (boxes.length < 2) return null
  const read = (from: number, to?: number) => {
    const block = html.slice(from, to)
    const out = new Map<string, string>()
    for (const row of block.matchAll(/<td><b>(Goalkeeper|Defenders|Midfielders|Forwards)<\/b><\/td>\s*<td>([\s\S]*?)<\/td>/g)) {
      for (const a of row[2].matchAll(/<a title="([^"]+)"/g)) out.set(decode(a[1]).trim(), row[1])
    }
    return out
  }
  const home = read(boxes[0], boxes[1]), away = read(boxes[1], boxes[1] + 20000)
  return home.size === 11 && away.size === 11 ? { home, away } : null
}

/** Where each shirt stands in Transfermarkt's pitch graphic, in percent from the top and left. */
export function parseTmFormation(html: string): { home: Map<number, { top: number; left: number }>; away: Map<number, { top: number; left: number }> } | null {
  const boxes = [...html.matchAll(/aufstellung-unterueberschrift-mannschaft/g)].map((m) => m.index!)
  if (boxes.length < 2) return null
  const read = (from: number, to: number) => {
    const out = new Map<number, { top: number; left: number }>()
    for (const m of html.slice(from, to).matchAll(/formation-player-container"\s+style="top:\s*([\d.]+)%;\s*left:\s*([\d.]+)%;?"\s*>\s*<div class="tm-shirt-number[^"]*">\s*(\d+)\s*<\/div>/g)) {
      out.set(Number(m[3]), { top: Number(m[1]), left: Number(m[2]) })
    }
    return out
  }
  const home = read(boxes[0], boxes[1]), away = read(boxes[1], boxes[1] + 30000)
  return home.size === 11 && away.size === 11 ? { home, away } : null
}
