'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, RotateCcw, Share2, Trophy } from 'lucide-react'
import { CHAMPIONS, CURRENT, SIDES, europeLine, honoursLine } from '@/lib/bikar/data'
import {
  FORMATIONS, LINE_LABEL, ROUNDS, draftDone, drawOpponents, eligible, formationOf, newDraft, nextSide, offer,
  openSlots, outcome, pick, playMatch, rng, shareText, teamRating, type Draft, type MatchResult,
} from '@/lib/bikar/game'
import type { CupPlayer, CupSide, Line } from '@/lib/bikar/types'
import styles from './Bikar.module.css'

type Stage = 'setup' | 'draft' | 'ready' | 'cup'
/** 'saga': draft from the greatest sides; 'nutid': draft today's players against former champions */
type Mode = 'saga' | 'nutid'
const LINES: Line[] = ['FWD', 'MID', 'DEF', 'GK']
const bestKey = (mode: Mode) => mode === 'saga' ? 'bikar:best' : 'bikar:best:nutid'
const sideById = new Map([...SIDES, ...CURRENT].map((s) => [s.id, s]))
const POOLS: Record<Mode, { draft: CupSide[]; opponents: CupSide[] }> = {
  saga: { draft: SIDES, opponents: SIDES },
  nutid: { draft: CURRENT, opponents: CHAMPIONS },
}
/** Icelandic numbers ending in 1 (but not 11) take the singular: 21 leikur, 1 mark */
const count = (n: number, one: string, many: string) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`

export function BikarGame() {
  const [stage, setStage] = useState<Stage>('setup')
  const [hard, setHard] = useState(false)
  const [mode, setMode] = useState<Mode>('saga')
  const [seed, setSeed] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [current, setCurrent] = useState<CupSide | null>(null)
  const [opponents, setOpponents] = useState<CupSide[]>([])
  const [results, setResults] = useState<MatchResult[]>([])
  const [copied, setCopied] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const random = useMemo(() => rng(seed), [seed])

  useEffect(() => {
    setBest(null)
    try { const b = Number(localStorage.getItem(bestKey(mode))); if (Number.isFinite(b) && b > 0) setBest(b) } catch { /* no record */ }
  }, [mode])

  const start = (formation: string) => {
    const s = Math.floor(Math.random() * 2 ** 31)
    const r = rng(s)
    const d = newDraft(formation)
    const first = nextSide(d, POOLS[mode].draft, r)
    setSeed(s); setDraft(offer(d, first)); setCurrent(first); setResults([]); setCopied(false)
    setStage('draft')
  }

  const choose = (player: CupPlayer) => {
    if (!draft || !current) return
    const d = pick(draft, current, player)
    if (draftDone(d)) { setDraft(d); setCurrent(null); setStage('ready'); return }
    const next = nextSide(d, POOLS[mode].draft, random)
    setDraft(offer(d, next)); setCurrent(next)
  }

  const beginCup = () => { setOpponents(drawOpponents(POOLS[mode].opponents, random)); setResults([]); setStage('cup') }

  const playNext = () => {
    if (!draft) return
    const i = results.length
    const r = playMatch(ROUNDS[i], draft.picks.map((p) => p.player), opponents[i], random)
    const all = [...results, r]
    setResults(all)
    const reached = all.filter((x) => x.won).length
    try {
      if (reached > (best ?? 0)) { localStorage.setItem(bestKey(mode), String(reached)); setBest(reached) }
    } catch { /* not saved */ }
  }

  const share = async () => {
    if (!draft) return
    const body = shareText(results, draft.formation, teamRating(draft), `${location.origin}/bikar`, mode === 'nutid' ? 'Núverandi leikmenn gegn gömlu meisturunum' : null)
    if (navigator.share) { try { await navigator.share({ text: body }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(body); setCopied(true) } catch { /* blocked */ }
  }

  const over = results.length > 0 && (!results[results.length - 1].won || results.length === ROUNDS.length)

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <p className={styles.kicker}><Trophy size={13} aria-hidden /> BIKARKEPPNIN</p>
        <h1>Reyndu að verða bikarmeistari</h1>
        <p className={styles.subtitle}>Draftaðu ellefu menn og komdu þeim frá 32-liða úrslitum alla leið í úrslitaleikinn, úr bestu liðum sögunnar eða úr Bestu deildinni í dag gegn gömlu meisturunum.</p>
      </header>

      {stage === 'setup' && (
        <section aria-label="Uppstilling">
          <div className={styles.block}>
            <span className={styles.label}>Leikhamur</span>
            <div className={styles.toggle} role="group" aria-label="Leikhamur">
              <button aria-pressed={mode === 'saga'} onClick={() => setMode('saga')}><strong>Goðsagnir</strong><small>Draftaðu úr bestu liðum sögunnar og mættu þeim</small></button>
              <button aria-pressed={mode === 'nutid'} onClick={() => setMode('nutid')}><strong>Núverandi leikmenn</strong><small>Byggðu lið úr leikmönnum Bestu deildarinnar {CURRENT[0]?.year} og sigraðu gömlu Íslandsmeistarana</small></button>
            </div>
          </div>
          <div className={styles.block}>
            <span className={styles.label}>Erfiðleikastig</span>
            <div className={styles.toggle} role="group" aria-label="Erfiðleikastig">
              <button aria-pressed={!hard} onClick={() => setHard(false)}><strong>Venjulegt</strong><small>Einkunnir leikmanna sýnilegar</small></button>
              <button aria-pressed={hard} onClick={() => setHard(true)}><strong>Erfitt</strong><small>Einkunnir faldar, treystu þekkingunni</small></button>
            </div>
          </div>
          <div className={styles.block}>
            <span className={styles.label}>Veldu uppstillingu</span>
            <div className={styles.formations}>
              {FORMATIONS.map((f) => (
                <button key={f.id} className={styles.formation} onClick={() => start(f.id)}>
                  <strong>{f.id}</strong>
                  <span>{f.label}</span>
                  <small>{f.lines.DEF} VÖRN · {f.lines.MID} MIÐJA · {f.lines.FWD} SÓKN</small>
                </button>
              ))}
            </div>
          </div>
          {best !== null && <p className={styles.note}>Besti árangur í þessum vafra: {best === 5 ? 'bikarmeistari' : `${best} ${best === 1 ? 'sigur' : 'sigrar'}`}.</p>}
        </section>
      )}

      {stage === 'draft' && draft && current && (
        <div className={styles.draft}>
          <section className={styles.pickPanel} aria-label="Veldu leikmann">
            <p className={styles.round}>Val {draft.picks.length + 1} af 11</p>
            <h2>Veldu leikmann úr <span>{current.label} {current.year}</span></h2>
            {mode === 'saga' ? <p className={styles.meta}>{honoursLine(current)}</p> : <p className={styles.meta}>Besta deildin {current.year} · FIFA-einkunnir leikmanna</p>}
            {europeLine(current.europeTies) && <p className={styles.meta}>{europeLine(current.europeTies)}</p>}
            <div className={styles.cards}>
              {eligible(draft, current).map((p) => (
                <button key={p.id} className={styles.card} onClick={() => choose(p)}>
                  <span className={`${styles.pos} ${styles[p.line]}`}>{p.position}</span>
                  <strong className={styles.rating}>{hard ? '?' : p.rating}</strong>
                  <span className={styles.name}>{p.name}</span>
                  <small>{count(p.starts, 'leikur', 'leikir')} · {count(p.goals, 'mark', 'mörk')}</small>
                  {p.visir && <span className={styles.visir} title={`${p.visir}. sæti á lista Vísis yfir bestu leikmenn deildarinnar frá upphafi`}>VÍSIR #{p.visir}</span>}
                </button>
              ))}
            </div>
          </section>
          <Team draft={draft} hard={hard} />
        </div>
      )}

      {stage === 'ready' && draft && (
        <div className={styles.draft}>
          <section className={styles.pickPanel}>
            <h2>Liðið er klárt</h2>
            <p className={styles.meta}>Uppstilling {draft.formation} · styrkur {hard ? 'falinn' : teamRating(draft)}</p>
            <p className={styles.meta}>{mode === 'saga'
              ? 'Fimm leikir að bikarnum. Mótherjarnir verða sterkari í hverri umferð og í úrslitaleiknum bíður eitt af tveimur bestu liðum sögunnar.'
              : 'Fimm leikir gegn fyrrverandi Íslandsmeisturum, sterkari í hverri umferð. Í úrslitaleiknum bíður annað af tveimur bestu meistaraliðum sögunnar.'}</p>
            <button className={styles.primary} onClick={beginCup}>Hefja bikarkeppnina <ArrowRight size={16} aria-hidden /></button>
          </section>
          <Team draft={draft} hard={false} />
        </div>
      )}

      {stage === 'cup' && draft && (
        <div className={styles.draft}>
          <section className={styles.pickPanel} aria-label="Bikarkeppnin">
            <ol className={styles.bracket}>
              {ROUNDS.map((round, i) => {
                const opp = opponents[i]
                const r = results[i]
                const next = i === results.length && !over
                if (i > results.length || (i === results.length && over)) {
                  return <li key={round} className={styles.future}><span>{round}</span><span>?</span></li>
                }
                return (
                  <li key={round} className={r ? (r.won ? styles.won : styles.lost) : styles.next}>
                    <span>{round}</span>
                    <div className={styles.fixture}>
                      <strong>Þitt lið {r ? `${r.ours} - ${r.theirs}` : 'gegn'} {opp.label} {opp.year}</strong>
                      {r?.penalties && <small>Eftir framlengingu, {r.penalties[0]}-{r.penalties[1]} í vítaspyrnukeppni</small>}
                      {r && !r.penalties && r.extraTime && <small>Eftir framlengingu</small>}
                      {!r && <small>{honoursLine(opp)}{europeLine(opp.europeTies) ? ` · ${europeLine(opp.europeTies)}` : ''}</small>}
                      {r && r.goals.length > 0 && (
                        <ul className={styles.goals}>
                          {r.goals.map((g, k) => <li key={k} className={g.ours ? styles.ourGoal : undefined}>{g.minute}&apos; {g.scorer}</li>)}
                        </ul>
                      )}
                    </div>
                    {next && <button className={styles.primary} onClick={playNext}>Spila leik <ArrowRight size={16} aria-hidden /></button>}
                  </li>
                )
              })}
            </ol>
            {over && (
              <div className={styles.end} aria-live="polite">
                <strong>{outcome(results)}</strong>
                <div className={styles.actions}>
                  <button className={styles.primary} onClick={share}><Share2 size={15} aria-hidden /> {copied ? 'Afritað' : 'Deila'}</button>
                  <button className={styles.ghost} onClick={() => setStage('setup')}><RotateCcw size={15} aria-hidden /> Nýtt lið</button>
                </div>
              </div>
            )}
          </section>
          <Team draft={draft} hard={false} />
        </div>
      )}

      <p className={styles.sources}>
        Liðin eru meistarar efstu deildar 1986-2024 og lið sem komust í riðla- eða deildarkeppni í Evrópu. Þeim er raðað eftir stigum og markatölu á leik,
        forskoti á næsta lið, tvennu og Evrópugengi, og árangur hvers liðs er staðfestur úr leikskýrslum KSÍ og töflum ensku og íslensku Wikipedia.
        Leikmenn eru byrjunarliðsmenn úr leikskýrslum KSÍ, með stöðu frá Transfermarkt, og einkunnir sögulegu leikmannanna taka mið af lista Vísis yfir 60 bestu leikmenn deildarinnar frá upphafi, sem lyftir leikmanni hversu sterkt sem liðið hans var. Hver staða er metin á móti sínum líka, svo varnarmenn og markverðir standi jafnfætis sóknarmönnum. Núverandi leikmenn bera FIFA-einkunnir sínar af síðunni Leikmenn.
        Einkunnir og úrslit eru leikur, ekki staðreyndir.
      </p>
    </div>
  )
}

function Team({ draft, hard }: { draft: Draft; hard: boolean }) {
  const f = formationOf(draft)
  const open = openSlots(draft)
  return (
    <aside className={styles.team} aria-label="Liðið þitt">
      <div className={styles.teamHead}><strong>Liðið þitt</strong><span>{draft.picks.length}/11 · {f.id}</span></div>
      {LINES.map((line) => (
        <div key={line} className={styles.line}>
          <span className={styles.lineLabel}>{LINE_LABEL[line]}</span>
          {draft.picks.filter((p) => p.player.line === line).map((p) => {
            const side = sideById.get(p.side)
            return (
              <div key={p.player.id} className={styles.slot}>
                <span className={`${styles.pos} ${styles[line]}`}>{p.player.position}</span>
                <span className={styles.slotName}>{p.player.name}<small>{side?.label} {side?.year}</small></span>
                {!hard && <strong>{p.player.rating}</strong>}
              </div>
            )
          })}
          {Array.from({ length: open[line] }, (_, i) => <div key={i} className={`${styles.slot} ${styles.empty}`}>Autt</div>)}
        </div>
      ))}
    </aside>
  )
}
