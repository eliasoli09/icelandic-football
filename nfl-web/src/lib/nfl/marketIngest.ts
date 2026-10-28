import { db } from '../db'
import { availability } from './injuries'
import { marketWeek, NFL_MARKET } from './market'
import { nflInjuries, nflMarketInputs, nflMarketWeeks, nflSeasonGames } from './queries'
import { enoughForWeek } from './stars'
import { isPlayed } from './types'

const SECRET = () => process.env.CRON_SECRET!

/**
 * Write a snapshot for every completed regular-season round that has none yet
 * (or every completed round with `all`). A round is complete when all its games
 * are played and most of them have player lines (nflverse can lag a day).
 */
export async function ingestMarket(season: number, opts: { all?: boolean } = {}): Promise<{ weeks: number[]; rows: number }> {
  const games = await nflSeasonGames(season)
  const reg = games.filter((g) => g.game_type === 'REG')
  const inputs = await nflMarketInputs(season)
  const lineGames = (w: number) => new Set(inputs.lines.filter((l) => l.week === w).map((l) => l.game_id)).size
  const complete = [...new Set(reg.map((g) => g.week))].sort((a, b) => a - b).filter((w) => {
    const wk = reg.filter((g) => g.week === w)
    return wk.every(isPlayed) && enoughForWeek(lineGames(w), wk.length)
  })
  const have = new Set(opts.all ? [] : await nflMarketWeeks(season))
  const todo = complete.filter((w) => !have.has(w))
  let rows = 0
  for (const week of todo) {
    // the next round's report is what keeps a player out of the games still to come
    const inj = await nflInjuries(season, week + 1)
    const rowsOut = marketWeek({
      season, week, lines: inputs.lines, prev: inputs.prev, players: inputs.players, games,
      injuries: availability(inj.rows, inj.week, week + 1), params: NFL_MARKET,
    })
    const { data, error } = await db().rpc('rpc_replace_nfl_market', { p_secret: SECRET(), p_season: season, p_week: week, p_rows: rowsOut })
    if (error) throw new Error(`rpc_replace_nfl_market ${week}: ${error.message}`)
    rows += Number(data)
  }
  return { weeks: todo, rows }
}
