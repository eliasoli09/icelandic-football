import type { WhoPlayer } from './types'
import playersJson from './players.json'
import namesJson from './names.json'
import scheduleJson from './schedule.json'
import type { Schedule } from './game'
import { nameIndex } from './game'

/** Every player scripts/hver/build.mts found the same career for on Transfermarkt and Wikipedia. */
export const PLAYERS = playersJson as WhoPlayer[]
/** The names the guess box suggests: Icelandic footballers and foreigners who played here. */
export const NAMES = namesJson as string[]
export const NAME_INDEX = nameIndex(NAMES, PLAYERS)
/** Who is the daily player on each day, fixed in advance. */
export const SCHEDULE = scheduleJson as Schedule
