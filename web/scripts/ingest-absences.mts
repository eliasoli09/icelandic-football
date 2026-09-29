/**
 * Load who is unavailable, for the eight leagues Transfermarkt covers.
 *
 * Run the scrape first, which caches its pages and waits between requests:
 *   python3 scripts/lib/tm_absences.py absences.json
 * then point this at the file it wrote.
 *
 * Usage: cd web && npx tsx scripts/ingest-absences.mts <absences.json> [--dry]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { db } = await import(join(webDir, 'src/lib/db.ts'))

const file = process.argv[2]
const dry = process.argv.includes('--dry')
if (!file) throw new Error('vantar slóð á absences.json')

interface Absent { player_id: string; name: string; reason: string; since: string | null; until: string | null; value: number }
interface Club { league: string; slug: string; squad_size: number; squad_value: number; missing_value: number; missing_share: number; absent: Absent[] }
const data = JSON.parse(readFileSync(file, 'utf-8')) as { captured: string; clubs: Record<string, Club> }
const explicit = (JSON.parse(readFileSync(join(webDir, 'src/lib/data/transfermarktClubs.json'), 'utf-8')) as
  { clubs: Record<string, string> }).clubs

const teamId = new Map<string, number>()
{
  const { data: rows, error } = await db().from('teams').select('id, name')
  if (error) throw error
  for (const t of (rows ?? []) as { id: number; name: string }[]) teamId.set(t.name, t.id)
}
const inLeague = new Map<string, Set<string>>()
for (let from = 0; ; from += 1000) {
  const { data: rows, error } = await db().from('matches')
    .select('league, home_team, away_team').eq('season', 2026).range(from, from + 999)
  if (error) throw error
  if (!rows?.length) break
  const byId = new Map([...teamId].map(([n, i]) => [i, n]))
  for (const m of rows as { league: string; home_team: number; away_team: number }[]) {
    const s = inLeague.get(m.league) ?? new Set<string>()
    const h = byId.get(m.home_team), a = byId.get(m.away_team)
    if (h) s.add(h); if (a) s.add(a)
    inLeague.set(m.league, s)
  }
  if (rows.length < 1000) break
}

/** the slug, as our match history spells the club */
const normalise = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(fc|afc|cf|sc|ac|cfc|sk|fk|bk|if|ik|kv|as|ss|ssc|us|ud|cd|sv|vfb|vfl|rb|rc|aj|ogc|osc|sad|tsg|calcio|club|de|la|el|the|amp|hove|albion|city|united|town|wanderers|rovers|athletic|county|north|end)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()

const squads: Record<string, unknown>[] = []
const absent: Record<string, unknown>[] = []
const unresolved: string[] = []
const claimed = new Map<string, string>()

for (const [key, club] of Object.entries(data.clubs)) {
  const ours = [...(inLeague.get(club.league) ?? [])]
  const name = explicit[key] ?? ours.find((o) => normalise(o) === normalise(club.slug.replace(/-/g, ' ')))
  const id = name ? teamId.get(name) : undefined
  if (!name || id === undefined || !ours.includes(name)) { unresolved.push(key); continue }
  // two slugs landing on one club would silently merge two squads
  const slot = `${club.league}|${name}`
  if (claimed.has(slot)) throw new Error(`${slot} pörast við bæði ${claimed.get(slot)} og ${club.slug}`)
  claimed.set(slot, club.slug)

  squads.push({
    league: club.league, team_id: id, squad_size: club.squad_size,
    squad_value: club.squad_value, missing_value: club.missing_value,
    missing_share: club.missing_share, captured: data.captured,
  })
  // the page lists injuries and suspensions separately, so a player serving a
  // ban while injured appears twice; the longer absence is the one that matters
  const iso = (d: string | null) => {
    const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null
  }
  const longest = new Map<string, Record<string, unknown>>()
  for (const a of club.absent) {
    const row = {
      league: club.league, team_id: id, player_id: a.player_id, player: a.name,
      reason: a.reason, since: iso(a.since), until: iso(a.until), market_value: a.value,
      captured: data.captured,
    }
    const seen = longest.get(a.player_id)
    if (!seen) { longest.set(a.player_id, row); continue }
    const rank = (x: Record<string, unknown>) => (x.until ? String(x.until) : '9999-12-31')
    if (rank(row) > rank(seen)) longest.set(a.player_id, row)
  }
  absent.push(...longest.values())
}
if (unresolved.length) throw new Error(`félög sem pörast ekki: ${unresolved.join(', ')}`)

if (!dry) {
  const { error } = await db().rpc('rpc_replace_absences', {
    p_secret: process.env.CRON_SECRET!, p_squads: squads, p_absent: absent,
  })
  if (error) throw error
}
console.log(JSON.stringify({
  dry, captured: data.captured, clubs: squads.length, absent: absent.length,
  withReturnDate: absent.filter((a) => a.until).length,
}, null, 1))
