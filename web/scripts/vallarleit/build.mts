/**
 * Turns cache/raw.json (from fetch.mts) into the game's club list,
 * src/lib/vallarleit/clubs.json, and checks it.
 *
 * Usage: cd web && npx tsx scripts/vallarleit/build.mts
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { LEAGUES } from '../../src/lib/vallarleit/leagues'
import { distanceM } from '../../src/lib/vallarleit/geo'
import type { VClub } from '../../src/lib/vallarleit/types'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = join(here, '..', '..')
const raw: any[] = JSON.parse(readFileSync(join(here, 'cache', 'raw.json'), 'utf-8'))

/**
 * Clubs Wikipedia gives no coordinates for, placed by hand at their ground's
 * town (checked on OpenStreetMap, 9 Oct 2026). Marked approximate in the data.
 */
const BY_HAND: Record<string, [number, number]> = {
  'FK Tukums 2000': [56.9667, 23.1556],
  'Ogre United': [56.8162, 24.6045],
  'KF Malisheva': [42.4829, 20.7459],
  'KF Dukagjini': [42.6208, 20.5779],
  'FK Skopje': [41.9926, 21.4832],
  'FC Samgurali Tsqaltubo': [42.3265, 42.5986],
  'FC Spaeri': [41.7195, 44.7655],
}

const stripTitle = (t: string) => t
  .replace(/\s*\((?:football club|football|soccer|club|sports club)[^)]*\)$/i, '')
  .replace(/\s*\([^)]*\)$/, '')
/** "U.S. Avellino 1912" -> "Avellino", "Servette FC" -> "Servette" */
const bare = (s: string) => {
  const out = s
    .replace(/^(?:(?:U\.?S\.?|S\.?S\.?C?\.?|A\.?C\.?|U\.?C\.?|LR|F\.?C\.?|PFC|SSD|ACF)\s+)+/, '')
    .replace(/(?:\s+(?:F\.?C\.?|C\.?F\.?|Calcio|1912|1913|1919))+$/, '')
    .trim()
  return out.length >= 3 ? out : s
}
const tidy = (s?: string | null) => (s ?? '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const clubs: VClub[] = []
const seen = new Set<string>()
const issues: string[] = []
for (const lg of raw) {
  for (const c of lg.clubs) {
    if (seen.has(c.teamTitle)) { issues.push(`twice: ${c.teamTitle} (${lg.key})`); continue }
    seen.add(c.teamTitle)
    let lat = c.lat, lon = c.lon, approx = c.coordFrom === 'town' || c.coordFrom === 'club-article'
    if (lat == null && BY_HAND[c.team]) { [lat, lon] = BY_HAND[c.team]; approx = true }
    if (lat == null) { issues.push(`no coordinates: ${c.team}`); continue }
    const full = stripTitle(c.teamTitle)
    // a league table can carry three-letter codes (Serie B: "PAL", "JST")
    const name = bare(/^[\p{Lu}0-9]{2,4}$/u.test(c.name) ? (c.en ?? full) : c.name)
    const aliases = [...new Set([full, c.en, c.short, c.is, c.team].filter((a): a is string => !!a && a !== name))]
    let id = slug(name)
    if (clubs.some((x) => x.id === id)) id = slug(`${name}-${lg.key}`)
    clubs.push({
      id,
      name,
      aliases,
      league: lg.key,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      stadium: tidy(c.stadiumName) || tidy(c.venueName) || null,
      city: tidy(c.city) || null,
      fame: c.links ?? 0,
      ...(approx ? { approx: true } : {}),
    })
  }
}

// two clubs may not share a name on screen: Slavia (Prague, Sofia), Radnik
const count = new Map<string, number>()
for (const c of clubs) count.set(c.name, (count.get(c.name) ?? 0) + 1)
for (const c of clubs) if (count.get(c.name)! > 1) {
  const full = c.aliases.find((a) => a.startsWith(c.name) && a !== c.name && !/\b(F\.?C|club)\b/i.test(a.slice(c.name.length)))
  const town = c.city?.split(/[,(]/)[0].trim()
  const better = full ?? (town && !c.name.includes(town) ? `${c.name} ${town}` : null)
  if (better) { c.aliases = [...new Set([c.name, ...c.aliases.filter((a) => a !== better)])]; c.name = better }
  else issues.push(`ambiguous name: ${c.name} (${c.league})`)
}

// sanity: every league present, nothing far outside its own country
const byLeague = new Map<string, VClub[]>()
for (const c of clubs) byLeague.set(c.league, [...(byLeague.get(c.league) ?? []), c])
for (const lg of LEAGUES) {
  const list = byLeague.get(lg.key) ?? []
  if (list.length < 8) issues.push(`only ${list.length} clubs in ${lg.key}`)
}
const VAST = new Set(['russia', 'kazakhstan', 'turkey', 'ukraine', 'norway', 'primeira', 'laliga2', 'sweden'])
for (const [key, list] of byLeague) {
  const mid = { lat: [...list].sort((a, b) => a.lat - b.lat)[list.length >> 1].lat, lon: [...list].sort((a, b) => a.lon - b.lon)[list.length >> 1].lon }
  for (const c of list) {
    const km = distanceM(mid, c) / 1000
    if (km > (VAST.has(key) ? 2600 : 900)) issues.push(`far from its league: ${c.name} (${key}) ${Math.round(km)} km`)
  }
}

writeFileSync(join(webDir, 'src/lib/vallarleit/clubs.json'), JSON.stringify(clubs))
console.log(`${clubs.length} clubs in ${byLeague.size} leagues, ${clubs.filter((c) => c.approx).length} placed approximately`)
console.log(issues.length ? issues.join('\n') : 'no issues')
