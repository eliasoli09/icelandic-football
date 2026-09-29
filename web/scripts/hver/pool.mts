/**
 * Who can be a "Hver er maðurinn?" answer, and which names the guess box
 * suggests. Wikidata links each footballer to his Transfermarkt id and his
 * Wikipedia article, so the two sources the builder compares are found by
 * identifier rather than by searching for a name.
 *
 * - every Icelandic male footballer with a Transfermarkt id (answers need an
 *   en.wikipedia article as well; the rest are names to guess with)
 * - every foreign male footballer Wikidata lists at an Icelandic club
 *
 * Usage: cd web && npx tsx scripts/hver/pool.mts   (writes scripts/hver/pool.json)
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const UA = 'BestaSpain-Leikir/1.0 (https://islensk-fotbolti.vercel.app; checks player quiz answers)'

export interface PoolPlayer {
  /** Wikidata item */
  qid: string
  /** Icelandic label, else English */
  label: string
  enLabel: string | null
  tm: string
  enwiki: string | null
  /** number of Wikipedia editions with an article, a plain measure of fame */
  sitelinks: number
  icelandic: boolean
}

const ICELAND = `
SELECT ?p ?isLabel ?enLabel ?tm ?enwiki ?links WHERE {
  ?p wdt:P106 wd:Q937857; wdt:P27 wd:Q189; wdt:P21 wd:Q6581097; wdt:P2446 ?tm; wikibase:sitelinks ?links.
  OPTIONAL { ?p rdfs:label ?isLabel FILTER(LANG(?isLabel) = "is") }
  OPTIONAL { ?p rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?enwiki schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
}`

const FOREIGN = `
SELECT DISTINCT ?p ?isLabel ?enLabel ?tm ?enwiki ?links WHERE {
  ?club wdt:P31/wdt:P279* wd:Q476028; wdt:P17 wd:Q189.
  ?p wdt:P54 ?club; wdt:P106 wd:Q937857; wdt:P21 wd:Q6581097; wdt:P2446 ?tm; wikibase:sitelinks ?links.
  FILTER NOT EXISTS { ?p wdt:P27 wd:Q189 }
  OPTIONAL { ?p rdfs:label ?isLabel FILTER(LANG(?isLabel) = "is") }
  OPTIONAL { ?p rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?enwiki schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
}`

type Binding = Record<string, { value: string } | undefined>

async function sparql(query: string): Promise<Binding[]> {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query }),
  })
  if (!res.ok) throw new Error(`Wikidata svaraði ${res.status}`)
  return (await res.json()).results.bindings
}

const players = new Map<string, PoolPlayer>()
for (const [query, icelandic] of [[ICELAND, true], [FOREIGN, false]] as const) {
  for (const b of await sparql(query)) {
    const qid = b.p!.value.split('/').pop()!
    const enLabel = b.enLabel?.value ?? null
    const label = b.isLabel?.value ?? enLabel
    if (!label || players.has(qid)) continue
    const enwiki = b.enwiki ? decodeURIComponent(b.enwiki.value.split('/wiki/')[1]).replace(/_/g, ' ') : null
    players.set(qid, { qid, label, enLabel, tm: b.tm!.value, enwiki, sitelinks: Number(b.links!.value), icelandic })
  }
  await new Promise((r) => setTimeout(r, 1500))
}

const list = [...players.values()].sort((a, b) => b.sitelinks - a.sitelinks || a.qid.localeCompare(b.qid))
writeFileSync(join(here, 'pool.json'), JSON.stringify(list, null, 1) + '\n')
console.log(`${list.length} leikmenn: ${list.filter((p) => p.icelandic).length} íslenskir, ${list.filter((p) => !p.icelandic).length} erlendir`)
