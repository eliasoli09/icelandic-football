import { fetchPage } from '../src/lib/ksi'
const SPAN = /<span class="(body-4 group-hover:underline[^"]*)">\s*([^<]+?)\s*<\/span>/g
const html = await fetchPage('https://www.ksi.is/oll-mot/mot?id=7025545&banner-tab=matches-and-results&page=1')
const chunks = html.split('grid-cols-[1fr_auto_1fr]')
console.log('chunks:', chunks.length)
for (let i = 1; i < chunks.length; i++) {
  SPAN.lastIndex = 0
  const s = [...chunks[i].matchAll(SPAN)].slice(0,2)
  const names = s.map(m=>m[2])
  console.log(i, JSON.stringify(names), '| lid-links:', (chunks[i].match(/mot\/lid\?id=/g)??[]).length)
  if (names.some(n => /Úrslitaleikur|Umferð/.test(n) || n === '.')) {
    console.log('   RAW:', chunks[i].slice(0, 900).replace(/\s+/g,' '))
  }
}
