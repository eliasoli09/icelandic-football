import { db } from '../db'
import { availability } from './injuries'
import { completeRounds, marketRounds, marketWeek, NFL_MARKET } from './market'
import { nflInjuries, nflMarketInputs, nflMarketWeeks, nflSeasonGames, type InjuryList } from './queries'

const SECRET = () => process.env.CRON_SECRET!

export interface MarketIngestOpts {
  /** Rewrite every completed round, not only the missing, partial and newest ones. */
  all?: boolean
  /**
   * The injury list as it stood for a round: the newest week on file up to
   * `week`. Defaults to nfl_injury (the cron); the backfill passes nflverse's
   * history, since nfl_injury only keeps the weeks the cron has seen.
   */
  injuries?: (week: number) => Promise<InjuryList>
}

/**
 * Write a snapshot for every completed regular-season round that has none yet,
 * every completed round still missing some player lines, and the newest
 * completed round again so it picks up the latest injury report (every
 * completed round with `all`). See `completeRounds` for when a round counts.
 */
export async function ingestMarket(season: number, opts: MarketIngestOpts = {}): Promise<{ weeks: number[]; rows: number }> {
  const injuries = opts.injuries ?? ((w: number) => nflInjuries(season, w))
  const games = await nflSeasonGames(season)
  const inputs = await nflMarketInputs(season)
  const byWeek = new Map<number, Set<string>>()
  for (const l of inputs.lines) byWeek.set(l.week, (byWeek.get(l.week) ?? new Set()).add(l.game_id))
  const { complete, partial } = completeRounds(games.filter((g) => g.game_type === 'REG'), new Map([...byWeek].map(([w, s]) => [w, s.size])))
  const todo = marketRounds(complete, opts.all ? [] : await nflMarketWeeks(season), { all: opts.all, partial })
  const written: number[] = []
  let rows = 0
  for (const week of todo) {
    // the next round's report is what keeps a player out of the games still to come
    const inj = await injuries(week + 1)
    const rowsOut = marketWeek({
      season, week, lines: inputs.lines, prev: inputs.prev, players: inputs.players, games,
      injuries: availability(inj.rows, inj.week, week + 1), params: NFL_MARKET,
    })
    const { data, error } = await db().rpc('rpc_replace_nfl_market', { p_secret: SECRET(), p_season: season, p_week: week, p_rows: rowsOut })
    if (error) throw new Error(`rpc_replace_nfl_market ${week}: ${error.message} (written before it: ${written.length ? written.join(', ') : 'none'}, ${rows} rows)`)
    written.push(week)
    rows += Number(data)
  }
  return { weeks: written, rows }
}
