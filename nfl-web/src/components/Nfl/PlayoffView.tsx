'use client'

import { useMemo, useState } from 'react'
import { MarkBadge, MARK_LEGEND } from './MarkBadge'
import { NflLogo } from './NflLogo'
import { probCell, type Bracket, type ConfBracket, type Slot } from '@/lib/nfl/bracket'
import type { Mark } from '@/lib/nfl/clinch'
import type { SimTeam } from '@/lib/nfl/sim'
import { clock, dayLabel } from '@/lib/nfl/time'
import { CONFERENCES, type Conference, type NflTeam } from '@/lib/nfl/types'

type View = 'idag' | 'liklegast'
type Ctx = { byAbbr: Map<string, NflTeam>; marks: Record<string, Mark | null> }

export function PlayoffView({ season, teams, sim, marks, today, likely, runAt, sims, sentence }: {
  season: number; teams: NflTeam[]; sim: Record<string, SimTeam>; marks: Record<string, Mark | null>
  today: Bracket; likely: Bracket; runAt: string; sims: number; sentence: string
}) {
  const byAbbr = useMemo(() => new Map(teams.map((t) => [t.abbr, t])), [teams])
  const [view, setView] = useState<View>('idag')
  const ctx: Ctx = { byAbbr, marks }
  const b = view === 'idag' ? today : likely

  return (
    <section className="grid gap-6">
      <h1 className="display text-3xl font-extrabold -mb-3">Úrslitakeppnin</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm muted max-w-xl">
          {view === 'idag'
            ? 'Svona liti úrslitakeppnin út ef deildarkeppninni lyki í dag. Talan er líkur liðsins á að komast í úrslitakeppnina.'
            : 'Líklegasta niðurstaðan úr hermuninni, þar sem sigurstranglegra liðið vinnur hvern leik. Við sætin í fríi og umspili eru líkurnar á einmitt því sæti; eftir það líkur liðsins á að komast svo langt.'}
        </p>
        <Toggle value={view} onChange={setView} options={[['idag', 'Í dag'], ['liklegast', 'Líklegast']]} />
      </div>

      <div className={`grid gap-6 items-start ${view === 'liklegast' ? 'lg:grid-cols-[1fr_minmax(200px,240px)_1fr]' : 'md:grid-cols-2'}`}>
        <ConfTree c="AFC" b={b.AFC} ctx={ctx} full={view === 'liklegast'} />
        {view === 'liklegast' && b.sb && b.winner && (
        <div className="lg:order-none order-last">
          {(
            <div className="card p-4 grid gap-3 lg:mt-24">
              <h3 className="display text-lg font-extrabold text-center">Super Bowl</h3>
              <div className="grid gap-1.5">{b.sb.map((s) => <Row key={s.abbr} s={s} ctx={ctx} bold={s.abbr === b.winner!.abbr} />)}</div>
              <div className="border-t pt-3 text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs muted">Líklegasti meistari</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <NflLogo team={byAbbr.get(b.winner.abbr)} size={32} />
                  <span className="display text-xl font-extrabold">{b.winner.abbr}</span>
                </div>
                <p className="text-sm num mt-1" style={{ color: 'var(--accent)' }}>{probCell(b.winner.p, false)} líkur</p>
                <p className="text-[11px] muted mt-1">Líklegast, en langt frá því víst.</p>
              </div>
            </div>
          )}
        </div>
        )}
        <ConfTree c="NFC" b={b.NFC} ctx={ctx} full={view === 'liklegast'} />
      </div>

      <ProbTable sim={sim} ctx={ctx} />

      <div className="text-[11px] muted leading-relaxed max-w-2xl grid gap-1">
        <p>{MARK_LEGEND}</p>
        <p>{sentence}</p>
        <p className="num">Tímabilið {season}. Síðast hermt {dayLabel(runAt).split(' ').slice(1).join(' ')} kl. {clock(runAt)} ({sims.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} hermanir).</p>
      </div>
    </section>
  )
}

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="tablist" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className="rounded-full px-4 min-h-[36px] font-semibold"
          style={{ background: value === v ? 'var(--accent)' : 'transparent', color: value === v ? 'var(--accent-ink)' : 'var(--text-2)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Row({ s, ctx, bold }: { s: Slot; ctx: Ctx; bold?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <span className="num muted w-4 text-right text-xs">{s.seed > 0 ? s.seed : ''}</span>
      <NflLogo team={ctx.byAbbr.get(s.abbr)} size={20} />
      <span className={`truncate ${bold ? 'font-bold' : ''}`}>{s.abbr}</span>
      <MarkBadge mark={ctx.marks[s.abbr]} />
      <span className="ml-auto num text-xs muted">{probCell(s.p, ctx.marks[s.abbr] === 'eliminated')}</span>
    </div>
  )
}

function Matchup({ pair, ctx, winner }: { pair: [Slot, Slot]; ctx: Ctx; winner?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 grid gap-1.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      {pair.map((s) => <Row key={s.abbr} s={s} ctx={ctx} bold={winner === s.abbr} />)}
    </div>
  )
}

function Round({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h4 className="text-xs font-semibold muted uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function ConfTree({ c, b, ctx, full }: { c: Conference; b: ConfBracket; ctx: Ctx; full: boolean }) {
  const next = (pair: [Slot, Slot], later: Slot[] | undefined) => later?.find((s) => pair.some((p) => p.abbr === s.abbr))?.abbr
  const round2 = b.div?.flat()
  const round3 = b.con
  return (
    <div className="card p-4 grid gap-4 content-start">
      <h3 className="display text-xl font-extrabold">{c}</h3>
      {b.byes.length > 0 && (
        <Round title={b.byes.length > 1 ? 'Frí í 1. umferð' : 'Frí'}>
          <div className="grid gap-1.5">{b.byes.map((s) => <Row key={s.abbr} s={s} ctx={ctx} />)}</div>
        </Round>
      )}
      <Round title="Umspil">{b.wc.map((pair) => <Matchup key={pair[0].abbr} pair={pair} ctx={ctx} winner={full ? next(pair, round2) : undefined} />)}</Round>
      {full && b.div && <Round title="8 liða úrslit">{b.div.map((pair) => <Matchup key={pair[0].abbr} pair={pair} ctx={ctx} winner={next(pair, round3)} />)}</Round>}
      {full && b.con && <Round title="Undanúrslit"><Matchup pair={b.con} ctx={ctx} winner={b.champ?.abbr} /></Round>}
      {b.hunt.length > 0 && (
        <Round title="Í baráttunni">
          <div className="grid gap-1.5">{b.hunt.map((s) => <Row key={s.abbr} s={{ ...s, seed: 0 }} ctx={ctx} />)}</div>
        </Round>
      )}
    </div>
  )
}

const COLS: [keyof SimTeam, string, boolean][] = [
  ['p_div', 'Riðill', false],
  ['p_playoffs', 'Úrslitak.', true],
  ['p_bye', 'Frí', false],
  ['p_round2', '8 liða', false],
  ['p_round3', 'Undanúrsl.', false],
  ['p_sb', 'Super Bowl', true],
  ['p_title', 'Titill', true],
]

function ProbTable({ sim, ctx }: { sim: Record<string, SimTeam>; ctx: Ctx }) {
  const [conf, setConf] = useState<'baedi' | Conference>('baedi')
  const rows = Object.values(sim)
    .filter((r) => conf === 'baedi' || ctx.byAbbr.get(r.team)?.conference === conf)
    .sort((a, b) => b.p_title - a.p_title || b.p_sb - a.p_sb || b.p_playoffs - a.p_playoffs)
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="display text-lg font-extrabold">Líkur hvers liðs</h2>
        <Toggle value={conf} onChange={setConf} options={[['baedi', 'Bæði'], ...CONFERENCES.map((c) => [c, c] as [Conference, string])]} />
      </div>
      <div className="table-wrap">
        <table className="text-sm w-full [&_td]:px-2 [&_th]:px-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="muted text-xs text-left">
              <th>Lið</th>
              {COLS.map(([k, label, always]) => <th key={k} className={`text-right ${always ? '' : 'hidden md:table-cell'}`}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const out = ctx.marks[r.team] === 'eliminated'
              return (
                <tr key={r.team} className="trow">
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <NflLogo team={ctx.byAbbr.get(r.team)} size={20} />
                      <span className="font-semibold">{r.team}</span>
                      <MarkBadge mark={ctx.marks[r.team]} />
                    </div>
                  </td>
                  {COLS.map(([k, , always]) => (
                    <td key={k} className={`text-right num ${always ? '' : 'hidden md:table-cell'} ${k === 'p_title' ? 'font-semibold' : ''}`}>
                      {probCell(r[k] as number, out)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
