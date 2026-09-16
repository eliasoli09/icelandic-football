/**
 * Where a player stands on the pitch, from the position a source gives. Lines
 * run from the goalkeeper (0) to the attack (5); lateral is -1 left, 1 right.
 */
export function wikiLine(code: string): { line: number; lateral: number } {
  const c = code.toUpperCase()
  const lateral = /^R/.test(c) ? 1 : /^L/.test(c) ? -1 : 0
  if (c === 'GK') return { line: 0, lateral: 0 }
  if (['SW', 'CB', 'RB', 'LB', 'RCB', 'LCB', 'DF'].includes(c)) return { line: 1, lateral }
  if (['DM', 'CDM', 'RWB', 'LWB'].includes(c)) return { line: 2, lateral }
  if (['CM', 'RM', 'LM', 'MF', 'RCM', 'LCM'].includes(c)) return { line: 3, lateral }
  if (['AM', 'CAM', 'RW', 'LW', 'RAM', 'LAM'].includes(c)) return { line: 4, lateral }
  if (['CF', 'ST', 'SS', 'FW', 'RF', 'LF'].includes(c)) return { line: 5, lateral }
  throw new Error(`óþekkt staða ${code}`)
}

const TM_LINE: Record<string, number> = { Goalkeeper: 0, Defenders: 1, Midfielders: 3, Forwards: 5 }

/** Transfermarkt's line for the match, refined by the player's usual position. */
export function tmLine(group: string, position = ''): { line: number; lateral: number } {
  const base = TM_LINE[group]
  if (base === undefined) throw new Error(`óþekkt lína ${group}`)
  const lateral = /^Right/.test(position) ? 1 : /^Left/.test(position) ? -1 : 0
  if (base === 3 && /Defensive Midfield/.test(position)) return { line: 2, lateral }
  if (base === 3 && /Attacking Midfield|Winger/.test(position)) return { line: 4, lateral }
  return { line: base, lateral }
}

/** Rows from attack down to goal, each left to right. */
export function rows<T extends { line: number; x: number }>(players: T[]): T[][] {
  const lines = [...new Set(players.map((p) => p.line))].sort((a, b) => b - a)
  return lines.map((line) => players.filter((p) => p.line === line).sort((a, b) => a.x - b.x))
}
