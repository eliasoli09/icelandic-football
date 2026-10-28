import { table } from './csv'

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download'
export const injuriesUrl = (season: number) => `${BASE}/injuries/injuries_${season}.csv`
export const rostersUrl = (season: number) => `${BASE}/weekly_rosters/roster_weekly_${season}.csv`

export type InjuryStatus = 'Out' | 'Doubtful' | 'Questionable' | 'IR' | 'PUP' | 'Reserve' | 'Cut'

export interface Injury {
  team: string
  player_id: string
  name: string
  position: string | null
  status: InjuryStatus
  injury: string | null
  practice: string | null
  source: 'report' | 'roster'
}
export interface InjuryWeek { season: number; week: number; game_type: string; rows: Injury[] }

export const STATUS_LABEL: Record<InjuryStatus, string> = {
  Out: 'Frá', Doubtful: 'Ólíklegur', Questionable: 'Óvíst', IR: 'Á meiðslalista', PUP: 'Á PUP-lista', Reserve: 'Á varalista', Cut: 'Látinn fara',
}
/** Worst first, for sorting. */
export const STATUS_ORDER: InjuryStatus[] = ['Out', 'Doubtful', 'Questionable', 'IR', 'PUP', 'Reserve', 'Cut']
/** Will not play: everything but Questionable. */
export const isUnavailable = (s: InjuryStatus) => s !== 'Questionable'

const REPORT: Record<string, InjuryStatus> = { Out: 'Out', Doubtful: 'Doubtful', Questionable: 'Questionable' }
/** Weekly roster reserve codes: R01 injured reserve, R48 IR designated to return, R04 physically unable to perform. */
function rosterStatus(status: string, code: string): InjuryStatus | null {
  if (status === 'CUT') return 'Cut'
  if (status !== 'RES') return null
  return code === 'R01' || code === 'R48' ? 'IR' : code === 'R04' ? 'PUP' : 'Reserve'
}

/**
 * The latest week of the season in the injury report, merged with that week's
 * roster reserve list. A player on both keeps the report's line, which names
 * the injury. A week with no report yet (before the first one) uses the roster's latest week.
 * With `week`, the newest week up to it instead, as if read on that day (Markaðurinn's history).
 */
export function parseInjuries(reportCsv: string, rosterCsv: string, season: number, week = Infinity): InjuryWeek | null {
  const report = table(reportCsv, ['season', 'game_type', 'team', 'week', 'gsis_id', 'position', 'full_name', 'report_primary_injury', 'report_secondary_injury', 'report_status', 'practice_status'])
    .filter((r) => Number(r.season) === season && r.gsis_id)
  const roster = table(rosterCsv, ['season', 'team', 'position', 'status', 'full_name', 'gsis_id', 'week', 'game_type', 'status_description_abbr'])
    .filter((r) => Number(r.season) === season && r.gsis_id)
  const upTo = (rows: Record<string, string>[]) => rows.map((r) => Number(r.week)).filter((w) => w <= week)
  const weeks = upTo(report).length ? upTo(report) : upTo(roster)
  if (!weeks.length) return null
  const at = Math.max(...weeks)
  const out = new Map<string, Injury>()
  let gameType = 'REG'
  for (const r of roster) {
    if (Number(r.week) !== at) continue
    gameType = r.game_type || gameType
    const status = rosterStatus(r.status, r.status_description_abbr)
    if (status) out.set(r.gsis_id, { team: r.team, player_id: r.gsis_id, name: r.full_name, position: r.position || null, status, injury: null, practice: null, source: 'roster' })
  }
  for (const r of report) {
    if (Number(r.week) !== at) continue
    gameType = r.game_type || gameType
    const status = REPORT[r.report_status]
    if (!status) continue
    const injury = [r.report_primary_injury, r.report_secondary_injury].filter(Boolean).join(', ') || null
    out.set(r.gsis_id, { team: r.team, player_id: r.gsis_id, name: r.full_name, position: r.position || null, status, injury, practice: r.practice_status || null, source: 'report' })
  }
  return { season, week: at, game_type: gameType, rows: [...out.values()] }
}

const BODY: Record<string, string> = {
  knee: 'hné', ankle: 'ökkli', hamstring: 'aftanlæri', concussion: 'heilahristingur', shoulder: 'öxl', groin: 'nári',
  calf: 'kálfi', foot: 'fótur', hip: 'mjöðm', back: 'bak', illness: 'veikindi', toe: 'tá', wrist: 'úlnliður', hand: 'hönd',
  elbow: 'olnbogi', quadricep: 'framlæri', quad: 'framlæri', neck: 'háls', chest: 'brjóstkassi', ribs: 'rifbein', rib: 'rifbein',
  thumb: 'þumall', finger: 'fingur', achilles: 'hásin', abdomen: 'kviður', oblique: 'síða', pectoral: 'brjóstvöðvi',
  heel: 'hæll', shin: 'sköflungur', forearm: 'framhandleggur', bicep: 'tvíhöfði', tricep: 'þríhöfði', glute: 'rassvöðvi',
  head: 'höfuð', eye: 'auga', jaw: 'kjálki', face: 'andlit', thigh: 'læri', 'lower leg': 'fótleggur', leg: 'fótleggur',
  'personal matter': 'persónulegar ástæður', 'not injury related - resting player': 'hvíld', 'not injury related': 'ekki meiðsli',
  fibula: 'sperrileggur', throat: 'háls', lung: 'lunga', 'not injury related - personal matter': 'persónulegar ástæður', 'not injury related - other': 'ekki meiðsli',
  arm: 'handleggur', biceps: 'tvíhöfði', triceps: 'þríhöfði', hamstrings: 'aftanlæri', spine: 'hryggur', stinger: 'taugaklemma',
}

/** The injury in Icelandic where we know the word; otherwise as reported. */
export function injuryLabel(injury: string | null): string | null {
  if (!injury) return null
  return injury.split(/,\s*/).map((part) => {
    const k = part.trim().toLowerCase()
    if (BODY[k]) return BODY[k]
    // "Right Knee", "Knee/Ankle"
    const words = k.replace(/^(right|left)\s+/, '').split('/').map((w) => BODY[w.trim()] ?? null)
    return words.every(Boolean) ? words.join('/') : part.trim()
  }).join(', ')
}

/**
 * Who is listed for a round. `dataWeek` is the newest week on file: if it is
 * the round's own week, the whole report counts; if it is older (the new
 * report is not out yet), only the reserve list does, since last week's Out
 * may well play.
 */
export function availability(rows: Pick<Injury, 'player_id' | 'status' | 'source'>[], dataWeek: number | null, roundWeek: number): Map<string, InjuryStatus> {
  const out = new Map<string, InjuryStatus>()
  if (dataWeek === null) return out
  for (const r of rows) if (dataWeek === roundWeek || r.source === 'roster') out.set(r.player_id, r.status)
  return out
}
