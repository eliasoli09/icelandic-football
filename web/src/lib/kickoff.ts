const weekdays = ['sun.', 'mán.', 'þri.', 'mið.', 'fim.', 'fös.', 'lau.']
const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maí', 'jún.', 'júl.', 'ágú.', 'sep.', 'okt.', 'nóv.', 'des.']

/** Stable Icelandic UTC labels, including browsers without Icelandic ICU data. */
export function formatKickoff(value: string | null): string {
  if (!value) return 'Óráðið'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Óráðið'
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${weekdays[date.getUTCDay()]}, ${date.getUTCDate()}. ${months[date.getUTCMonth()]}, ${hour}:${minute}`
}
