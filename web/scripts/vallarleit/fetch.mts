/**
 * Fetches every club in Europe's top leagues with the coordinates of its home
 * ground, for Vallarleit (/vallarleit).
 *
 * Membership comes from the English Wikipedia article for the league's current
 * season (2026-27, or 2026 for leagues that play in the calendar year): its
 * "Stadiums and locations" table names each club and the ground it plays at
 * THIS season. Wikidata's own season items were tried first and abandoned -
 * most list no clubs, and the ones that do are often years old.
 *
 * Coordinates come from the stadium's article (Wikipedia GeoData), falling back
 * to the stadium's Wikidata item, then the club's home venue on Wikidata.
 * Every response is cached in ./cache so a rerun is offline and repeatable.
 *
 * Usage: cd web && npx tsx scripts/vallarleit/fetch.mts [--offline]
 * Then: npx tsx scripts/vallarleit/build.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import { LEAGUES } from '../../src/lib/vallarleit/leagues'

const here = dirname(fileURLToPath(import.meta.url))
const cacheDir = join(here, 'cache')
mkdirSync(cacheDir, { recursive: true })
const OFFLINE = process.argv.includes('--offline')
const UA = 'BestaSpain-Vallarleit/1.0 (https://islensk-fotbolti.vercel.app)'
const WP = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&'

async function cached(key: string, url: string): Promise<any> {
  const file = join(cacheDir, createHash('sha1').update(key).digest('hex').slice(0, 16) + '.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf-8'))
  if (OFFLINE) throw new Error('not cached: ' + key)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json, application/json' } })
      if (res.status === 429 || res.status >= 500) throw new Error(String(res.status))
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      const json = await res.json()
      writeFileSync(file, JSON.stringify(json))
      await new Promise((r) => setTimeout(r, 150))
      return json
    } catch (e) {
      if (attempt === 4) throw e
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const titleOf = (href?: string) => (href && href.startsWith('/wiki/') && !/^\/wiki\/(File|Help|Wikipedia|Template|Category):/.test(href) ? decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' ') : null)
const clean = (s: string) => s.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()

/** the season article that exists, newest first */
async function seasonArticle(base: string): Promise<string | null> {
  const canon = await cached('canon:' + base, WP + 'action=query&redirects=1&titles=' + encodeURIComponent(base))
  const names = [...new Set([base, canon.query.pages[0].title])]
  const candidates = [...names.flatMap((t) => [`2026–27 ${t}`, `2026 ${t}`, `2025–26 ${t}`, `2025 ${t}`]), ...names]
  const json = await cached('seasons:' + candidates.join('|'), WP + 'action=query&redirects=1&titles=' + encodeURIComponent(candidates.join('|')))
  const exists = new Map<string, string>()
  const redirects = new Map<string, string>((json.query.redirects ?? []).map((r: any) => [r.from, r.to]))
  const normalized = new Map<string, string>((json.query.normalized ?? []).map((r: any) => [r.from, r.to]))
  for (const p of json.query.pages) if (!p.missing) exists.set(p.title, p.title)
  for (const c of candidates) {
    const n = normalized.get(c) ?? c
    const t = redirects.get(n) ?? n
    if (exists.has(t)) return t
  }
  return null
}

/** expands rowspan/colspan so cell [r][c] is what a reader sees */
function grid($: cheerio.CheerioAPI, table: any) {
  const rows: any[][] = []
  $(table).find('tr').each((r, tr) => {
    rows[r] ??= []
    let c = 0
    $(tr).children('th,td').each((_, cell) => {
      while (rows[r][c]) c++
      const rs = Number($(cell).attr('rowspan') ?? 1) || 1
      const cs = Number($(cell).attr('colspan') ?? 1) || 1
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) {
        rows[r + i] ??= []
        rows[r + i][c + j] = cell
      }
      c += cs
    })
  })
  return rows
}

const TEAM = /^(team|club|klub|clubs|teams)\b/i
const GROUND = /(stadium|venue|ground|arena|home)/i
const link = ($: cheerio.CheerioAPI, cell: any) => {
  if (!cell) return null
  const a = $(cell).find('a').toArray().find((x) => titleOf($(x).attr('href')) && !$(x).find('img').length && !$(x).closest('sup').length)
  return a ? { title: titleOf($(a).attr('href'))!, text: clean($(a).text()) } : null
}

/**
 * The clubs of one season article. Membership is read from the league table
 * (Pos | Team | ... | Pts) when the season has one, because a stadium table
 * can list a second ground for a club or a club that has since folded; the
 * grounds come from either a Team/Stadium column table or the photo gallery
 * of grounds (a row of club names over a row of stadium names).
 */
async function clubsOf(article: string) {
  const json = await cached('parse:' + article, WP + 'action=parse&prop=text&redirects=1&page=' + encodeURIComponent(article))
  const $ = cheerio.load(json.parse.text)
  let members: { title: string; text: string }[] = []
  const ground = new Map<string, { title: string | null; text: string; capacity: number | null }>()
  const town = new Map<string, { title: string | null; text: string }>()
  const named = new Map<string, string>()
  $('table.wikitable').each((_, table) => {
    const g = grid($, table)
    if (g.length < 3) return
    const head = g.findIndex((row) => row.length && row.every((cell) => cell && cell.tagName === 'th'))
    if (head < 0) return
    const labels = g[head].map((cell) => clean($(cell).text()))
    const ti = labels.findIndex((l) => TEAM.test(l))
    // the league table: first one wins, later ones are split-round subsets
    if (!members.length && ti >= 0 && labels.some((l) => /^pos/i.test(l)) && labels.some((l) => /^pts/i.test(l))) {
      const seen = new Set<string>()
      for (const row of g.slice(head + 1)) {
        const t = row[ti] !== g[head][ti] ? link($, row[ti]) : null
        if (t && !seen.has(t.title)) { seen.add(t.title); members.push(t) }
      }
      return
    }
    if (ti >= 0) {
      const si = labels.findIndex((l, i) => i !== ti && GROUND.test(l) && !/manager|coach/i.test(l))
      const li = labels.findIndex((l) => /(location|city|town|place)/i.test(l))
      const ci = labels.findIndex((l) => /capacity/i.test(l))
      for (const row of g.slice(head + 1)) {
        if (row[ti] === g[head][ti]) continue
        const t = link($, row[ti])
        if (!t) continue
        named.set(t.title, t.text)
        if (si >= 0 && row[si] && !ground.has(t.title)) {
          const s = link($, row[si])
          const cap = ci >= 0 && row[ci] ? Number(clean($(row[ci]).text()).replace(/[^\d]/g, '').slice(0, 6)) || null : null
          ground.set(t.title, { title: s?.title ?? null, text: s?.text || clean($(row[si]).text()), capacity: cap })
        }
        if (li >= 0 && row[li] && !town.has(t.title)) {
          const l = link($, row[li])
          town.set(t.title, { title: l?.title ?? null, text: clean($(row[li]).text()) })
        }
      }
      return
    }
    // the gallery: a row of th club links, then a row of td grounds below it
    for (let r = 0; r + 1 < g.length; r++) {
      const top = g[r], below = g[r + 1]
      if (!top.length || !top.every((c) => c && c.tagName === 'th') || !below.some((c) => c && c.tagName === 'td')) continue
      top.forEach((cell, c) => {
        const t = link($, cell)
        const s = below[c] && below[c].tagName === 'td' ? link($, below[c]) : null
        if (t && s && !ground.has(t.title)) ground.set(t.title, { title: s.title, text: s.text, capacity: null })
        if (t) named.set(t.title, named.get(t.title) ?? t.text)
      })
    }
  })
  if (members.length < 6) members = [...named.entries()].map(([title, text]) => ({ title, text }))
  return members.map((m) => ({
    team: m.title,
    name: named.get(m.title) ?? m.text,
    stadium: ground.get(m.title)?.title ?? null,
    stadiumName: ground.get(m.title)?.text ?? null,
    capacity: ground.get(m.title)?.capacity ?? null,
    city: town.get(m.title)?.text ?? null,
    cityTitle: town.get(m.title)?.title ?? null,
  }))
}

/** title -> { resolved title, wikibase item, coordinates } */
async function pages(titles: string[]) {
  const info = new Map<string, { title: string; item?: string; lat?: number; lon?: number }>()
  for (const group of chunks([...new Set(titles)], 50)) {
    const json = await cached('pages:' + group.join('|'), WP + 'action=query&redirects=1&prop=pageprops|coordinates&ppprop=wikibase_item&colimit=max&titles=' + encodeURIComponent(group.join('|')))
    const hop = new Map<string, string>()
    for (const r of json.query.normalized ?? []) hop.set(r.from, r.to)
    for (const r of json.query.redirects ?? []) hop.set(r.from, r.to)
    const byTitle = new Map<string, any>(json.query.pages.map((p: any) => [p.title, p]))
    for (const t of group) {
      let x = t
      for (let i = 0; i < 3 && hop.has(x); i++) x = hop.get(x)!
      const p = byTitle.get(x)
      if (!p || p.missing) continue
      const c = p.coordinates?.[0]
      info.set(t, { title: p.title, item: p.pageprops?.wikibase_item, lat: c?.lat, lon: c?.lon })
    }
  }
  return info
}

const sparql = (q: string) => cached(q, 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q))
const val = (b: any, k: string) => b?.[k]?.value as string | undefined
const point = (wkt?: string) => {
  const m = wkt?.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/)
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null
}

/** coordinates of items (stadiums), straight from Wikidata */
async function itemCoords(items: string[]) {
  const out = new Map<string, { lat: number; lon: number }>()
  for (const group of chunks([...new Set(items)], 150)) {
    const json = await sparql(`SELECT ?i ?c WHERE { VALUES ?i { ${group.map((i) => 'wd:' + i).join(' ')} } ?i wdt:P625 ?c }`)
    for (const b of json.results.bindings) {
      const p = point(val(b, 'c'))
      if (p) out.set(val(b, 'i')!.split('/').pop()!, p)
    }
  }
  return out
}

/** per club: fame (sitelinks), short name, founding year, Icelandic label, current venue coords */
async function clubFacts(items: string[]) {
  const out = new Map<string, any>()
  for (const group of chunks([...new Set(items)], 40)) {
    const json = await sparql(`SELECT ?i ?links ?short ?is ?en ?inc ?vc ?vl WHERE {
      VALUES ?i { ${group.map((i) => 'wd:' + i).join(' ')} }
      OPTIONAL { ?i wikibase:sitelinks ?links }
      OPTIONAL { ?i wdt:P1813 ?short FILTER(lang(?short) = "en") }
      OPTIONAL { ?i rdfs:label ?is FILTER(lang(?is) = "is") }
      OPTIONAL { ?i rdfs:label ?en FILTER(lang(?en) = "en") }
      OPTIONAL { ?i wdt:P571 ?inc }
      OPTIONAL { ?i p:P115 ?st . ?st ps:P115 ?v . FILTER NOT EXISTS { ?st pq:P582 ?e } OPTIONAL { ?v wdt:P625 ?vc } OPTIONAL { ?v rdfs:label ?vl FILTER(lang(?vl) = "en") } }
    }`)
    for (const b of json.results.bindings) {
      const id = val(b, 'i')!.split('/').pop()!
      const o = out.get(id) ?? { links: 0 }
      o.links = Math.max(o.links, Number(val(b, 'links') ?? 0))
      o.short ??= val(b, 'short')
      o.is ??= val(b, 'is')
      o.en ??= val(b, 'en')
      o.founded ??= val(b, 'inc') ? Number(val(b, 'inc')!.slice(0, 4)) : undefined
      o.venue ??= point(val(b, 'vc')) ?? undefined
      o.venueName ??= val(b, 'vl')
      out.set(id, o)
    }
  }
  return out
}

const leagues: any[] = []
for (const lg of LEAGUES) {
  const article = await seasonArticle(lg.wiki)
  if (!article) { console.log(`!! ${lg.key}: no season article`); leagues.push({ ...lg, article: null, clubs: [] }); continue }
  const clubs = await clubsOf(article)
  const flag = clubs.length !== lg.size ? `   <-- expected ${lg.size}` : ''
  console.log(`${lg.key.padEnd(16)} ${article.padEnd(48)} ${String(clubs.length).padStart(3)}${flag}`)
  leagues.push({ ...lg, article, clubs })
}

const all = leagues.flatMap((l) => l.clubs)
const teamPages = await pages(all.map((c) => c.team))
const groundPages = await pages(all.filter((c) => c.stadium).map((c) => c.stadium))
const groundItems = [...groundPages.values()].map((p) => p.item).filter(Boolean) as string[]
const groundCoords = await itemCoords(groundItems)
const townPages = await pages(all.filter((c) => c.cityTitle).map((c) => c.cityTitle))
const facts = await clubFacts([...teamPages.values()].map((p) => p.item).filter(Boolean) as string[])

for (const l of leagues) for (const c of l.clubs) {
  const tp = teamPages.get(c.team)
  const gp = c.stadium ? groundPages.get(c.stadium) : undefined
  c.item = tp?.item
  c.teamTitle = tp?.title ?? c.team
  c.stadiumTitle = gp?.title ?? c.stadium
  const f = tp?.item ? facts.get(tp.item) : undefined
  Object.assign(c, { links: f?.links ?? 0, short: f?.short, is: f?.is, en: f?.en, founded: f?.founded, venueName: f?.venueName })
  if (gp?.lat != null) Object.assign(c, { lat: gp.lat, lon: gp.lon, coordFrom: 'stadium-article' })
  else if (gp?.item && groundCoords.get(gp.item)) Object.assign(c, groundCoords.get(gp.item), { coordFrom: 'stadium-wikidata' })
  else if (f?.venue) Object.assign(c, f.venue, { coordFrom: 'club-venue' })
  else if (tp?.lat != null) Object.assign(c, { lat: tp.lat, lon: tp.lon, coordFrom: 'club-article' })
  else if (c.cityTitle && townPages.get(c.cityTitle)?.lat != null) Object.assign(c, { lat: townPages.get(c.cityTitle)!.lat, lon: townPages.get(c.cityTitle)!.lon, coordFrom: 'town' })
}
writeFileSync(join(cacheDir, 'raw.json'), JSON.stringify(leagues, null, 1))
const missing = all.filter((c) => c.lat == null)
console.log(`\n${all.length} clubs, ${missing.length} without coordinates`)
for (const c of missing) console.log('  no coords:', c.team, '|', c.stadium ?? c.stadiumName, '|', c.city)
const approx = all.filter((c) => c.coordFrom === 'town' || c.coordFrom === 'club-article')
console.log(`${approx.length} placed by town or club article:`, approx.map((c) => c.name).join(', '))
console.log(`${all.filter((c) => !c.stadium && !c.stadiumName).length} without a named ground`)
