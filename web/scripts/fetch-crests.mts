/**
 * Give every club a crest.
 *
 * Icelandic clubs already carry theirs from comet.ksi.is. For the rest, the
 * soccer-dataset's team table maps its clubs to API-Football ids, whose crest
 * images are served publicly at media.api-sports.io.
 *
 * A missing id there returns a 678-byte placeholder with HTTP 200, so every
 * candidate is fetched and checked before it is stored — a placeholder is
 * worse than an honest blank.
 *
 * Needs scripts/export-backtest-data.mts to have produced team_crest_map.csv.
 * Usage: cd web && npx tsx scripts/fetch-crests.mts [--dry]
 */
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const DATA = '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/sd'
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const l of readFileSync(join(webDir, '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const dry = process.argv.includes('--dry')
const { db } = await import(join(webDir, 'src/lib/db.ts'))
const SECRET = process.env.CRON_SECRET!

/** sha1 of the image api-sports returns for an id it does not know */
const PLACEHOLDER = '0bb50cbded2d95b6'

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|ac|as|ss|us|afc|cd|ud|sv|vfb|vfl|tsg|bsc|rc|sk)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

// name -> api-football id, from the dataset's own mapping
const byName = new Map<string, number>()
for (const line of readFileSync(join(DATA, 'team_crest_map.csv'), 'utf-8').split('\n').slice(1)) {
  if (!line) continue
  const p = line.split(',')
  const id = Number(p[p.length - 1])
  if (!id) continue
  for (const n of [p[0], p[1]]) {
    const k = norm((n ?? '').replace(/^"|"$/g, ''))
    if (k && !byName.has(k)) byName.set(k, id)
  }
}

const { data: teams } = await db()
  .from('teams')
  .select('id, name, crest_url')
  .order('id')
const need = ((teams ?? []) as { id: number; name: string; crest_url: string | null }[])
  .filter((t) => !t.crest_url)
console.log(`lið án merkis: ${need.length}  (kortlagning: ${byName.size} nöfn)`)

const found: { id: number; crest_url: string }[] = []
const missing: string[] = []
let checked = 0

async function resolve(t: { id: number; name: string }) {
  const apiId = byName.get(norm(t.name))
  if (!apiId) { missing.push(t.name); return }
  const url = `https://media.api-sports.io/football/teams/${apiId}.png`
  try {
    const res = await fetch(url)
    if (!res.ok) { missing.push(t.name); return }
    const buf = Buffer.from(await res.arrayBuffer())
    const sha = createHash('sha1').update(buf).digest('hex').slice(0, 16)
    if (sha === PLACEHOLDER || buf.length < 1000) { missing.push(t.name); return }
    found.push({ id: t.id, crest_url: url })
  } catch {
    missing.push(t.name)
  } finally {
    if (++checked % 50 === 0) console.log(`  ${checked}/${need.length} …`)
  }
}

// modest concurrency — this is someone else's CDN
const QUEUE = 8
for (let i = 0; i < need.length; i += QUEUE) {
  await Promise.all(need.slice(i, i + QUEUE).map(resolve))
}

console.log(`\nmerki fundin: ${found.length}   ekkert merki: ${missing.length}`)
if (missing.length) console.log('án merkis:', missing.slice(0, 25).join(', ') + (missing.length > 25 ? ' …' : ''))

if (dry) { console.log('\n(þurrkeyrsla — ekkert skrifað)'); process.exit(0) }
for (let i = 0; i < found.length; i += 200) {
  const { error } = await db().rpc('rpc_set_team_meta', { p_secret: SECRET, p_rows: found.slice(i, i + 200) })
  if (error) throw error
}
console.log(`skrifuð ${found.length} merki`)
