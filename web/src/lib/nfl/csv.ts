import { easternToUtcIso } from './time'
import { FRANCHISE, type Conference, type Division, type GameType, type NflGame, type NflTeam } from './types'

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Rows as objects. A missing column or a ragged row throws: half a file must never be written. */
export function table(text: string, required: readonly string[]): Record<string, string>[] {
  const [head, ...body] = parseCsv(text)
  const missing = required.filter((c) => !head.includes(c))
  if (missing.length) throw new Error(`nflverse: dálk vantar í CSV: ${missing.join(', ')}`)
  return body
    .filter((r) => !(r.length === 1 && r[0] === ''))
    .map((r, i) => {
      if (r.length !== head.length) throw new Error(`nflverse: lína ${i + 2} hefur ${r.length} reiti, ekki ${head.length}`)
      return Object.fromEntries(head.map((h, j) => [h, r[j]]))
    })
}

const GAME_COLUMNS = [
  'game_id', 'season', 'game_type', 'week', 'gameday', 'gametime', 'away_team', 'away_score',
  'home_team', 'home_score', 'location', 'overtime', 'away_moneyline', 'home_moneyline',
  'spread_line', 'total_line', 'div_game', 'roof', 'stadium', 'away_qb_name', 'home_qb_name',
  'away_qb_id', 'home_qb_id',
] as const
const TEAM_COLUMNS = ['team_abbr', 'team_name', 'team_conf', 'team_division', 'team_color', 'team_color2'] as const
const GAME_TYPES = new Set<GameType>(['REG', 'WC', 'DIV', 'CON', 'SB'])

const num = (s: string): number | null => {
  if (s === '' || s === 'NA') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const text = (s: string): string | null => (s === '' || s === 'NA' ? null : s)

export function parseGames(csv: string): NflGame[] {
  return table(csv, GAME_COLUMNS).map((r) => {
    if (!GAME_TYPES.has(r.game_type as GameType)) throw new Error(`nflverse: óþekkt leikjategund ${r.game_type} (${r.game_id})`)
    const tbd = r.gametime === ''
    return {
      game_id: r.game_id,
      season: Number(r.season),
      game_type: r.game_type as GameType,
      week: Number(r.week),
      // no time yet (late-season flex): keep the date, flag the time
      kickoff: easternToUtcIso(r.gameday, tbd ? '12:00' : r.gametime),
      time_tbd: tbd,
      away: r.away_team,
      home: r.home_team,
      away_score: num(r.away_score),
      home_score: num(r.home_score),
      overtime: r.overtime === '1',
      neutral: r.location === 'Neutral',
      spread_line: num(r.spread_line),
      total_line: num(r.total_line),
      away_ml: num(r.away_moneyline),
      home_ml: num(r.home_moneyline),
      div_game: r.div_game === '1',
      stadium: text(r.stadium),
      roof: text(r.roof),
      away_qb: text(r.away_qb_name),
      home_qb: text(r.home_qb_name),
      away_qb_id: text(r.away_qb_id),
      home_qb_id: text(r.home_qb_id),
    }
  })
}

export function parseTeams(csv: string): NflTeam[] {
  return table(csv, TEAM_COLUMNS).map((r) => {
    const franchise = FRANCHISE[r.team_abbr] ?? r.team_abbr
    const [conference, division] = r.team_division.split(' ') as [Conference, Division]
    return {
      abbr: r.team_abbr,
      franchise,
      name: r.team_name,
      conference: (r.team_conf || conference) as Conference,
      division,
      color: r.team_color,
      color2: r.team_color2,
      logo: `/nfl/${franchise}.png`,
    }
  })
}
