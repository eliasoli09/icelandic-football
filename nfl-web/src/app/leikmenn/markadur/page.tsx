import { PlayersSwitch } from '@/components/Nfl/PlayersSwitch'
import { MarketView } from '@/components/Nfl/MarketView'
import { MARKET_POSITIONS, REPLACEMENT } from '@/lib/nfl/market'
import { buildMarketView, forClient } from '@/lib/nfl/marketView'
import { nflCurrentSeason, nflMarket, nflTeams } from '@/lib/nfl/queries'

// cached like the other player pages; `?p=` is read in the browser so the page itself stays cacheable
export const revalidate = 300
export const metadata = {
  title: 'Markaðurinn',
  description: 'Hvað er hver fantasy-leikmaður í NFL virði? Verðmæti umferð eftir umferð, hverjir hækka og lækka, og skiptireiknir.',
}

export default async function MarketPage() {
  const season = await nflCurrentSeason().catch(() => null)
  if (!season) return <p className="muted">Engir leikir fundust.</p>
  let failed = false
  const [rows, teams] = await Promise.all([
    nflMarket(season).catch((e) => { console.error('Markaðurinn: nflMarket brást', e); failed = true; return [] }),
    nflTeams().catch(() => []),
  ])
  // shaped on the server: the browser gets the newest board, ranks per round and the movers, never the raw rows
  const view = forClient(buildMarketView(rows))
  const last = view.weeks[view.weeks.length - 1]
  return (
    <div className="grid gap-6">
      <PlayersSwitch active="markadur" />
      <header className="grid gap-1">
        <h1 className="display text-3xl font-extrabold">Markaðurinn</h1>
        <p className="muted text-sm">
          Hvað hver sóknarmaður er virði í fantasy (hálft stig fyrir grip, 12 liða deild).{last ? ` Staðan eftir ${last}. umferð tímabilsins ${season}.` : ''}
        </p>
      </header>
      {failed
        ? <p className="muted">Markaðurinn er ekki tiltækur í augnablikinu.</p>
        : view.board.length
          ? <MarketView view={view} teams={teams.map(({ abbr, color, color2 }) => ({ abbr, color, color2 }))} />
          : <p className="muted">Markaðurinn opnar eftir fyrstu umferð.</p>}
      <section className="card p-4 text-sm grid gap-2">
        <h2 className="display font-extrabold">Hvernig verðið er reiknað</h2>
        <p className="max-w-prose">
          Verðmæti leikmanns er spá í leik (meðaltal þessa tímabils og þess síðasta, dregið að meðaltali stöðunnar) mínus
          varamannsstig stöðunnar ({MARKET_POSITIONS.map((p) => `${p} nr. ${REPLACEMENT[p]}`).join(', ')}), sinnum leikir eftir. Meiðsli taka leiki af.
          Þetta er mat síðunnar úr tölfræði, ekki verð sem fólk borgar í skiptum. Spáin var prófuð á tímabilunum 2022-2025:
          hún skeikaði að meðaltali um 2,3 stig í leik, á móti 2,6 stigum fyrir meðaltal tímabilsins til þessa.
        </p>
        <p className="muted text-xs">
          Gögn: <a className="underline" href="https://github.com/nflverse" rel="noopener noreferrer">nflverse</a> (CC BY 4.0).
        </p>
      </section>
    </div>
  )
}
