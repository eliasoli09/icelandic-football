'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Compass, LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react'
import { distanceKm, type AtlasClub, type AtlasMatch } from '@/lib/atlas/geo'
import { filterClubs, filterMatches, type AtlasLeague } from './catalog'
import styles from './Atlas.module.css'

const AtlasScene = dynamic(() => import('./AtlasScene'), { ssr: false })

const leagueLabels = { all: 'Öll félög', besta: 'Besta deild', lengju: 'Lengjudeild' }

function matchDate(value: string | null): string {
  if (!value) return 'Dagsetning óákveðin'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${Number(day)}.${Number(month)}.${year}`
}

function Badge({ club, size = 36 }: { club: AtlasClub; size?: number }) {
  // These local crests are already small PNGs; their transparency is preserved.
  return <img src={club.badge} alt="" width={size} height={size} className={styles.badge} loading="lazy" />
}

export function AtlasView({ clubs, matches, fixtureMessage }: {
  clubs: AtlasClub[]
  matches: AtlasMatch[]
  fixtureMessage: string | null
}) {
  const [league, setLeague] = useState<AtlasLeague>('all')
  const [mode, setMode] = useState<'clubs' | 'matches'>('clubs')
  const [query, setQuery] = useState('')
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [onlyClub, setOnlyClub] = useState(false)
  const [sceneStatus, setSceneStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [cameraCommand, setCameraCommand] = useState({ type: 'reset' as 'reset' | 'in' | 'out' | 'capital', sequence: 0 })
  const catalogScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (catalogScrollRef.current) catalogScrollRef.current.scrollTop = 0
  }, [mode, league, query])

  const byId = useMemo(() => new Map(clubs.map(club => [club.id, club])), [clubs])
  const selectedClub = selectedClubId === null ? null : byId.get(selectedClubId) ?? null
  const selectedMatch = matches.find(match => match.id === selectedMatchId) ?? null
  const home = selectedMatch ? byId.get(selectedMatch.home_team) : undefined
  const away = selectedMatch ? byId.get(selectedMatch.away_team) : undefined
  const selection = useMemo(() => home && away ? [home, away] : selectedClub ? [selectedClub] : [], [home, away, selectedClub])
  const visibleIds = useMemo(() => (
    selection.length ? selection : clubs.filter(club => league === 'all' || club.league === league)
  ).map(club => club.id), [clubs, league, selection])
  const shownClubs = useMemo(() => filterClubs(clubs, league, query), [clubs, league, query])
  const shownMatches = useMemo(() => filterMatches(matches, clubs, league, query, onlyClub && selectedClub ? selectedClub.id : undefined), [matches, clubs, league, query, onlyClub, selectedClub])
  const km = home && away ? distanceKm(home, away) : null

  const chooseClub = useCallback((id: number) => {
    setSelectedClubId(id)
    setSelectedMatchId(null)
  }, [])

  function chooseMatch(match: AtlasMatch) {
    setSelectedMatchId(match.id)
    setSelectedClubId(current => onlyClub && (current === match.home_team || current === match.away_team) ? current : match.home_team)
  }

  function changeLeague(value: AtlasLeague) {
    setLeague(value)
    if (value !== 'all' && selectedClub?.league !== value) {
      setSelectedClubId(null)
      setSelectedMatchId(null)
      setOnlyClub(false)
    }
  }

  function showRegion(region: 'reset' | 'capital') {
    setSelectedClubId(null)
    setSelectedMatchId(null)
    setOnlyClub(false)
    setCameraCommand(command => ({ type: region, sequence: command.sequence + 1 }))
  }

  function reset() { showRegion('reset') }

  return (
    <section className={styles.atlas} aria-labelledby="atlas-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}><span /> FÓTBOLTAATLAS · ÁRGANGUR 2026</p>
          <h1 id="atlas-title">Heimavellir Íslands<span>.</span></h1>
          <p className={styles.subtitle}>24 félög. Eitt fótboltaland.</p>
        </div>
        <p className={styles.headingNote}>Frá heimavelli til heimavallar.<br /><span>Besta deild & Lengjudeild karla</span></p>
      </header>

      <div className={styles.atlasGrid}>
        <div className={styles.stage} aria-label="Gagnvirkt þrívítt Íslandskort">
          <img className={`${styles.poster} ${sceneStatus === 'ready' ? styles.posterHidden : ''}`} src="/atlas/preview.jpg" alt="Gamalt Íslandskort á viðarborði með merkjum íslenskra knattspyrnufélaga" />
          <AtlasScene clubs={clubs} selection={selection} visibleIds={visibleIds} onChooseClub={chooseClub} onStatus={setSceneStatus} cameraCommand={cameraCommand} />
          <div className={styles.mapTopline} aria-hidden="true"><span>ÍSLAND</span><span>64°–67° N</span></div>

          <div className={styles.regionControls}>
            <button type="button" onClick={() => showRegion('capital')} disabled={sceneStatus !== 'ready'} aria-label="Þysja inn á höfuðborgarsvæðið"><Search size={13} aria-hidden="true" />Höfuðborgarsvæðið</button>
            {selection.length > 0 && <button type="button" onClick={reset}><X size={13} aria-hidden="true" />Sýna öll lið</button>}
          </div>

          <div className={styles.mapControls} aria-label="Stjórna korti">
            <button type="button" onClick={() => setCameraCommand(command => ({ type: 'in', sequence: command.sequence + 1 }))} disabled={sceneStatus !== 'ready'} aria-label="Þysja inn" title="Þysja inn"><Plus size={18} /></button>
            <button type="button" onClick={() => setCameraCommand(command => ({ type: 'out', sequence: command.sequence + 1 }))} disabled={sceneStatus !== 'ready'} aria-label="Þysja út" title="Þysja út"><Minus size={18} /></button>
            <span />
            <button type="button" onClick={reset} aria-label="Sýna allt Ísland og hreinsa val" title="Sýna allt Ísland"><LocateFixed size={18} /></button>
          </div>

          {sceneStatus !== 'ready' && (
            <div className={styles.sceneNotice} role="status">
              <Compass size={22} aria-hidden="true" />
              <span>{sceneStatus === 'loading' ? 'Kortið er að opnast…' : 'Þrívíddarkortið er ekki tiltækt.'}</span>
              <small>{sceneStatus === 'loading' ? 'Félögin eru þegar aðgengileg í skránni.' : 'Veldu félag eða leik í skránni til að skoða upplýsingarnar.'}</small>
            </div>
          )}

          {home && away && km !== null ? (
            <div className={styles.routeCard} aria-live="polite">
              <div className={styles.routeTeams}><Badge club={home} size={25} /><span>{home.name}</span><span className={styles.routeDashes} style={{ background: `repeating-linear-gradient(90deg, ${home.color} 0 5px, transparent 5px 9px, ${away.color} 9px 14px, transparent 14px 18px)` }} /><span>{away.name}</span><Badge club={away} size={25} /></div>
              <div className={styles.distance}><strong>{km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} <span>km</span></strong><span>loftlína milli heimavalla</span></div>
            </div>
          ) : (
            <div className={styles.mapHint}><MapPin size={14} aria-hidden="true" /><span>{selectedClub ? `${selectedClub.name} · ${selectedClub.city}` : 'Veldu merki. Uppgötvaðu félagið.'}</span></div>
          )}
          <div className={styles.compass} aria-hidden="true"><span>N</span><Compass size={35} strokeWidth={1} /></div>
        </div>

        <aside className={styles.sidebar} aria-label="Félög og leikir">
          {selectedClub ? (
            <article className={styles.clubDetail} aria-label={`Upplýsingar um ${selectedClub.name}`}>
              <button type="button" className={styles.closeDetail} onClick={reset} aria-label="Loka upplýsingum um félag"><X size={16} /></button>
              <div className={styles.clubTitle}><Badge club={selectedClub} size={52} /><div><p className={styles.detailLeague}>{leagueLabels[selectedClub.league]} · 2026</p><h2>{selectedClub.name}</h2><p>{selectedClub.fullName}</p></div></div>
              <dl className={styles.facts}>
                <div><dt>HEIMABÆR</dt><dd>{selectedClub.city}</dd></div>
                <div><dt>STOFNAÐ</dt><dd>{selectedClub.founded ?? 'Óskráð'}</dd></div>
                <div><dt>HEIMAVÖLLUR</dt><dd>{selectedClub.stadium}</dd></div>
              </dl>
              <p className={styles.factText}>{selectedClub.fact}</p>
              <div className={styles.sourceLinks}>{selectedClub.sources.map((source, i) => <a key={source} href={source} target="_blank" rel="noreferrer">Heimild {selectedClub.sources.length > 1 ? i + 1 : ''}<ArrowUpRight size={11} aria-hidden="true" /></a>)}</div>
              {selectedMatch && home && away && (
                <div className={styles.matchDetail}>
                  <p><strong>{home.name} – {away.name}</strong><span>{matchDate(selectedMatch.date)}</span></p>
                  <p>Leikstaður: {selectedMatch.venue || 'Óskráður'}</p>
                  <small>Loftlínan tengir skráða heimavelli félaganna; leikstaður getur verið annar. Vegalengd á vegum er ekki sýnd.</small>
                  <div className={styles.pairButtons}>{[home, away].map(club => <button type="button" key={club.id} onClick={() => chooseClub(club.id)}><Badge club={club} size={20} />{club.name}<ArrowUpRight size={12} /></button>)}</div>
                </div>
              )}
              {!selectedMatch && <button type="button" className={styles.clubMatches} onClick={() => { setMode('matches'); setOnlyClub(true); setQuery('') }}>Skoða leiki {selectedClub.name}<ArrowDownLeft size={14} aria-hidden="true" /></button>}
            </article>
          ) : (
            <div className={styles.catalogIntro}><p className={styles.eyebrow}>VELLIRNIR & SÖGURNAR</p><h2>Fótboltinn á heima <br />um allt land.</h2><p>Finndu félag á kortinu eða veldu leik og fylgdu leiðinni milli heimavalla.</p></div>
          )}

          <div className={styles.catalog}>
            <div className={styles.catalogModes} aria-label="Velja skrá">
              <button type="button" aria-pressed={mode === 'clubs'} onClick={() => { setMode('clubs'); setQuery('') }}>Félög <span>{clubs.length}</span></button>
              <button type="button" aria-pressed={mode === 'matches'} onClick={() => { setMode('matches'); setQuery('') }}>Leikir <span>{matches.length}</span></button>
            </div>
            <div className={styles.leagueFilters} aria-label="Sía eftir deild">{(['all', 'besta', 'lengju'] as const).map(value => <button key={value} type="button" aria-pressed={league === value} onClick={() => changeLeague(value)}>{value === 'all' ? 'Öll' : leagueLabels[value]}</button>)}</div>
            <label className={styles.search}><Search size={15} aria-hidden="true" /><span className={styles.srOnly}>{mode === 'clubs' ? 'Leita að félagi, bæ eða velli' : 'Leita að leik, félagi eða dagsetningu'}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={mode === 'clubs' ? 'Félag, bær eða völlur…' : 'Félag, völlur eða 2026-06…'} /></label>
            {mode === 'matches' && selectedClub && <label className={styles.onlyClub}><input type="checkbox" checked={onlyClub} onChange={event => setOnlyClub(event.target.checked)} />Aðeins leikir {selectedClub.name}</label>}
            <div className={styles.catalogCount} aria-live="polite"><span>{mode === 'clubs' ? `${shownClubs.length} félög` : `${shownMatches.length} leikir`}</span><span>2026</span></div>
            <div ref={catalogScrollRef} className={styles.catalogScroll}>
              {fixtureMessage && <p className={styles.fixtureNotice} role="status">{fixtureMessage}</p>}
              {mode === 'clubs' ? (
                <ul className={styles.clubList}>{shownClubs.map(club => <li key={club.id}><button type="button" aria-pressed={selectedClubId === club.id} onClick={() => chooseClub(club.id)}><Badge club={club} /><span><strong>{club.name}</strong><small>{club.city}</small></span><i style={{ background: club.color }} aria-hidden="true" /><ArrowUpRight size={15} aria-hidden="true" /></button></li>)}</ul>
              ) : (
                <ul className={styles.matchList}>{shownMatches.map(match => {
                  const homeClub = byId.get(match.home_team)
                  const awayClub = byId.get(match.away_team)
                  if (!homeClub || !awayClub) return null
                  return <li key={match.id}><button type="button" aria-pressed={selectedMatchId === match.id} onClick={() => chooseMatch(match)}><span className={styles.fixtureDate}>{matchDate(match.date)}<span>{match.league === 'besta' ? 'Besta' : 'Lengju'}</span></span><span className={styles.fixtureTeams}><Badge club={homeClub} size={22} /><strong>{homeClub.name}</strong><span>–</span><strong>{awayClub.name}</strong><Badge club={awayClub} size={22} /></span></button></li>
                })}</ul>
              )}
              {(mode === 'clubs' ? shownClubs.length : shownMatches.length) === 0 && <p className={styles.empty}>Engar niðurstöður. Prófaðu aðra leit eða deild.</p>}
            </div>
          </div>
          <div className={styles.sidebarFoot}><span className={styles.legendDot} /> Heimavellir tímabilsins 2026</div>
        </aside>
      </div>
      <div className={styles.atlasFoot}><p>Dragðu til að snúa · Skrunaðu til að þysja · Veldu félag í skránni með lyklaborði</p><p>Kortlagning heimavalla · Loftlínuvegalengdir</p><p>Oddar pinna merkja heimavelli; merkjum er dreift þar sem þétt er.</p></div>
    </section>
  )
}
