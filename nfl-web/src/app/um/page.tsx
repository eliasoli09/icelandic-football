import Link from 'next/link'
import { NFL_MODEL_REPORT } from '@/lib/nfl/report'
import { SITE_NAME } from '@/lib/site'

export const metadata = {
  title: 'Um síðuna',
  description: 'Hvað síðan er, hvaðan gögnin koma, hvernig spárnar verða til og hvernig greinarnar eru skrifaðar.',
}

const pct = (x: number) => (x * 100).toFixed(1).replace('.', ',')

export default function AboutPage() {
  return (
    <article className="grid gap-6 max-w-2xl leading-relaxed">
      <header className="grid gap-2">
        <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--accent)' }}>UM SÍÐUNA</p>
        <h2 className="display text-3xl font-extrabold tracking-tight">{SITE_NAME}</h2>
        <p className="text-lg">Íslensk síða um ameríska fótboltann: líkur fyrir hvern leik, staðan, úrslitakeppnin, leikmenn, spáleikur og greinar, allt á íslensku og íslenskum tíma.</p>
      </header>

      <section className="grid gap-2">
        <h3 className="display text-xl font-extrabold">Spárnar</h3>
        <p>
          Líkurnar koma úr Elo-líkani sem metur styrk hvers liðs út frá öllum leikjum frá 1999. Það var prófað á {NFL_MODEL_REPORT.games.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} leikjum
          {' '}{NFL_MODEL_REPORT.from}-{NFL_MODEL_REPORT.to} sem það hafði ekki séð: það hitti á sigurvegarann í {pct(NFL_MODEL_REPORT.modelAcc)}% leikja en Vegas í {pct(NFL_MODEL_REPORT.vegasAcc)}%.
          Vegas er því nákvæmara, og þess vegna sýnum við línur þess við hliðina.
        </p>
        <p>Staðan í úrslitakeppninni og líkur á sæti þar koma úr 10.000 hermunum á restinni af tímabilinu, á hverjum morgni.</p>
      </section>

      <section className="grid gap-2">
        <h3 className="display text-xl font-extrabold">Greinarnar</h3>
        <p>
          Upphitun, umfjöllun eftir leiki og vikan í hnotskurn eru skrifaðar með aðstoð gervigreindar úr okkar eigin gögnum:
          úrslitum, tölfræði og spám. Hver tala í texta frá gervigreind er borin saman við gögnin, og ekkert birtist fyrr en ritstjóri hefur lesið það yfir.
        </p>
        <p>Erlendar fréttir eru stuttar íslenskar samantektir með tengli á upprunalegu fréttina. Við birtum aldrei þýddar greinar annarra.</p>
      </section>

      <section className="grid gap-2">
        <h3 className="display text-xl font-extrabold">Gögnin</h3>
        <ul className="list-disc pl-5 grid gap-1">
          <li>Leikir, úrslit, Vegas-línur og leikmannatölfræði: <a className="underline" href="https://github.com/nflverse" rel="noopener noreferrer">nflverse</a>.</li>
          <li>Fréttir: fyrirsagnir úr fréttaveitum ESPN, ProFootballTalk, CBS Sports og Yahoo Sports.</li>
          <li>Saga verðlaunanna: Wikipedia.</li>
        </ul>
      </section>

      <p className="text-sm muted">
        Síðan er óháð og tengist hvorki NFL né liðunum. Hún notar sama aðgang og{' '}
        <a className="underline" href="https://islensk-fotbolti.vercel.app">íslenska fótboltasíðan</a>. <Link className="underline" href="/spa">Prófaðu spáleikinn</Link>.
      </p>
    </article>
  )
}
