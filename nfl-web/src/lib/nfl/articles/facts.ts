import { franchiseOf, type EloRow } from '../elo'
import type { Forecast } from '../forecast'
import { teamForm } from '../form'
import { modelSpreadLabel, spreadLabel, totalLabel } from '../format'
import type { SimTeam } from '../sim'
import { computeStandings, type WLT } from '../standings'
import { clock, dayLabel, isSmallHours } from '../time'
import { isPlayed, type NflGame, type NflTeam } from '../types'
import { weekLabel } from '../week'

/**
 * Fact packs: everything an article may say, already formatted the Icelandic
 * way, so a language model copies numbers instead of computing them. The
 * number check in writer.ts holds the text to these and nothing else.
 */

export interface GameStatLine {
  name: string
  team: string
  passing_yards: number; passing_tds: number; interceptions: number; completions: number; attempts: number
  rushing_yards: number; rushing_tds: number; carries: number
  receptions: number; receiving_yards: number; receiving_tds: number
  def_sacks: number; def_interceptions: number; tackles_solo: number; tackle_assists: number; forced_fumbles: number
}

export interface FactInput {
  games: NflGame[]
  teams: NflTeam[]
  elo: Pick<EloRow, 'game_id' | 'team' | 'elo_before' | 'elo_after' | 'p_win'>[]
  forecasts: Record<string, Forecast>
  sim: Record<string, Pick<SimTeam, 'p_playoffs' | 'p_div'>>
}

const record = (r: WLT) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`
const pct = (p: number) => Math.round(p * 100)
const when = (iso: string) => `${dayLabel(iso)}${isSmallHours(iso) ? ', aðfaranótt' : ''} kl. ${clock(iso)}`
const elo = (x: number) => Math.round(x)
const signed = (x: number) => { const r = Math.round(x); return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : '0' }

function names(teams: NflTeam[]) {
  const m = new Map(teams.map((t) => [t.abbr, t.name]))
  return (abbr: string) => m.get(abbr) ?? abbr
}

/** Round preview: every game of the round with the model, Vegas and form. */
export function previewFacts(input: FactInput, season: number, week: number) {
  const name = names(input.teams)
  const round = input.games.filter((g) => g.season === season && g.week === week).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const games = round.map((g) => {
    const f = input.forecasts[g.game_id]
    const formH = teamForm(g.home, g.kickoff, input.games, input.elo)
    const formA = teamForm(g.away, g.kickoff, input.games, input.elo)
    const qb = f?.newQb
    return {
      leikur: `${name(g.away)} @ ${name(g.home)}`,
      lid: { uti: g.away, heima: g.home },
      hvenaer: g.time_tbd ? `${dayLabel(g.kickoff)}, tími óákveðinn` : when(g.kickoff),
      ...(g.neutral && g.stadium ? { hlutlaus_vollur: g.stadium } : {}),
      likur_heimalids_pct: f ? pct(f.pHome) : null,
      likur_utilids_pct: f ? 100 - pct(f.pHome) : null,
      forgjof_likans: f?.spread != null ? modelSpreadLabel(g.home, g.away, f.spread) : null,
      forgjof_vegas: spreadLabel(g),
      heildarstig_vegas: g.total_line !== null ? totalLabel(g.total_line) : null,
      met: { [g.away]: record(formA.record), [g.home]: record(formH.record) },
      sidustu_fimm: { [g.away]: formA.last5.join(''), [g.home]: formH.last5.join('') },
      ...(qb?.home || qb?.away ? { nyr_leikstjornandi: [qb.away, qb.home].filter(Boolean).map((x) => `${x!.qb} í stað ${x!.usual}`) } : {}),
    }
  })
  const withP = round.filter((g) => input.forecasts[g.game_id])
  const fav = [...withP].sort((a, b) => Math.abs(input.forecasts[b.game_id].pHome - 0.5) - Math.abs(input.forecasts[a.game_id].pHome - 0.5))[0]
  const close = [...withP].sort((a, b) => Math.abs(input.forecasts[a.game_id].pHome - 0.5) - Math.abs(input.forecasts[b.game_id].pHome - 0.5))[0]
  const favSide = fav && (input.forecasts[fav.game_id].pHome >= 0.5 ? fav.home : fav.away)
  return {
    tegund: 'upphitun',
    umferd: weekLabel(round[0]?.game_type ?? 'REG', week),
    timabil: season,
    leikir: games,
    ...(fav ? { mest_sigurstranglegt: { lid: name(favSide), likur_pct: pct(Math.max(input.forecasts[fav.game_id].pHome, 1 - input.forecasts[fav.game_id].pHome)) } } : {}),
    ...(close ? { jafnasti_leikurinn: `${name(close.away)} @ ${name(close.home)}` } : {}),
  }
}

/** The three best lines of a side: passer, rusher, receiver, defender. */
function standouts(lines: GameStatLine[], team: string) {
  const own = lines.filter((l) => franchiseOf(l.team) === franchiseOf(team))
  const top = <K extends keyof GameStatLine>(k: K) => [...own].sort((a, b) => (b[k] as number) - (a[k] as number))[0]
  const out: Record<string, string> = {}
  const p = top('passing_yards')
  if (p && p.attempts > 0) out.sendandi = `${p.name}: ${p.completions}/${p.attempts}, ${p.passing_yards} jardar, ${p.passing_tds} snertimörk, ${p.interceptions} hleranir`
  const r = top('rushing_yards')
  if (r && r.carries > 0) out.hlaupari = `${r.name}: ${r.carries} hlaup, ${r.rushing_yards} jardar, ${r.rushing_tds} snertimörk`
  const c = top('receiving_yards')
  if (c && c.receptions > 0) out.utherji = `${c.name}: ${c.receptions} grip, ${c.receiving_yards} jardar, ${c.receiving_tds} snertimörk`
  const d = [...own].sort((a, b) => (b.def_sacks * 3 + b.def_interceptions * 4 + b.forced_fumbles * 3 + b.tackles_solo) - (a.def_sacks * 3 + a.def_interceptions * 4 + a.forced_fumbles * 3 + a.tackles_solo))[0]
  if (d && (d.def_sacks || d.def_interceptions || d.tackles_solo)) {
    out.varnarmadur = `${d.name}: ${d.tackles_solo + d.tackle_assists} tæklingar, ${d.def_sacks.toString().replace('.', ',')} fellur, ${d.def_interceptions} hleranir`
  }
  return out
}

/** After one game: the result, how surprising it was, what it did to Elo and the table. */
export function reportFacts(input: FactInput, gameId: string, lines: GameStatLine[]) {
  const name = names(input.teams)
  const g = input.games.find((x) => x.game_id === gameId)
  if (!g || !isPlayed(g)) throw new Error(`Leikur ${gameId} er ekki spilaður`)
  const homeWon = g.home_score! > g.away_score!
  const tie = g.home_score === g.away_score
  const winner = tie ? null : homeWon ? g.home : g.away
  const row = (abbr: string) => input.elo.find((r) => r.game_id === g.game_id && r.team === franchiseOf(abbr))
  const pWinner = winner ? row(winner)?.p_win ?? null : null
  const st = computeStandings(input.games.filter((x) => x.kickoff <= g.kickoff), input.teams.filter((t) => t.franchise === t.abbr))
  const side = (abbr: string) => {
    const r = row(abbr)
    const rec = st.records[abbr]
    return {
      lid: name(abbr),
      stig: abbr === g.home ? g.home_score : g.away_score,
      met_eftir_leik: rec ? record(rec) : null,
      elo_breyting: r ? signed(r.elo_after - r.elo_before) : null,
      elo_eftir: r ? elo(r.elo_after) : null,
      likur_urslitakeppni_pct: input.sim[abbr] ? pct(input.sim[abbr].p_playoffs) : null,
      lykilmenn: standouts(lines, abbr),
    }
  }
  return {
    tegund: 'umfjollun',
    umferd: weekLabel(g.game_type, g.week),
    timabil: g.season,
    leikur: `${name(g.away)} @ ${name(g.home)}`,
    urslit: `${g.away} ${g.away_score} - ${g.home_score} ${g.home}`,
    ...(g.overtime ? { framlenging: true } : {}),
    sigurvegari: winner ? name(winner) : 'jafntefli',
    ...(pWinner !== null ? { likur_sem_likanid_gaf_sigurvegaranum_pct: pct(pWinner), ovaent: pWinner < 0.4 } : {}),
    uti: side(g.away),
    heima: side(g.home),
    ...(lines.length ? {} : { athugasemd: 'Tölfræði leikmanna er ekki komin; nefndu enga leikmenn.' }),
  }
}

/** A finished round: results, surprises, Elo movers, division leaders, playoff odds. */
export function recapFacts(input: FactInput, season: number, week: number) {
  const name = names(input.teams)
  const round = input.games.filter((g) => g.season === season && g.week === week && isPlayed(g)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const results = round.map((g) => {
    const winner = g.home_score! > g.away_score! ? g.home : g.away_score! > g.home_score! ? g.away : null
    const p = winner ? input.elo.find((r) => r.game_id === g.game_id && r.team === franchiseOf(winner))?.p_win ?? null : null
    return { leikur: `${g.away} ${g.away_score} - ${g.home_score} ${g.home}`, sigurvegari: winner ? name(winner) : 'jafntefli', likur_sigurvegara_pct: p !== null ? pct(p) : null }
  })
  const surprises = results.filter((r) => r.likur_sigurvegara_pct !== null && r.likur_sigurvegara_pct < 40).sort((a, b) => a.likur_sigurvegara_pct! - b.likur_sigurvegara_pct!)
  const moves = round.flatMap((g) => input.elo.filter((r) => r.game_id === g.game_id)).map((r) => ({ lid: name(r.team), breyting: r.elo_after - r.elo_before }))
  moves.sort((a, b) => b.breyting - a.breyting)
  const clubs = input.teams.filter((t) => t.franchise === t.abbr)
  const st = computeStandings(input.games.filter((g) => g.season === season), clubs)
  const leaders = Object.entries(st.divisions).flatMap(([conf, divs]) => Object.entries(divs).map(([div, ranked]) => {
    const top = ranked[0]
    return { ridill: `${conf} ${div}`, efst: name(top.abbr), met: record(st.records[top.abbr]) }
  }))
  const odds = clubs.filter((t) => input.sim[t.abbr]).map((t) => ({ lid: name(t.abbr), likur_urslitakeppni_pct: pct(input.sim[t.abbr].p_playoffs) }))
    .sort((a, b) => b.likur_urslitakeppni_pct - a.likur_urslitakeppni_pct)
  return {
    tegund: 'vikan',
    umferd: weekLabel(round[0]?.game_type ?? 'REG', week),
    timabil: season,
    urslit: results,
    ovaentustu_urslitin: surprises.slice(0, 3),
    mest_haekkun_elo: moves.slice(0, 3).map((m) => ({ lid: m.lid, breyting: signed(m.breyting) })),
    mest_laekkun_elo: moves.slice(-3).reverse().map((m) => ({ lid: m.lid, breyting: signed(m.breyting) })),
    efst_i_ridlum: leaders,
    likur_urslitakeppni: odds,
  }
}

export type Facts = ReturnType<typeof previewFacts> | ReturnType<typeof reportFacts> | ReturnType<typeof recapFacts>
