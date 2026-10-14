import type { Stat, StatGroup } from './players'

type Row = Partial<Record<Stat, number>>
export interface Column { label: string; title: string; value: (r: Row) => string }

// a real minus sign, as in the EPA column
const minus = (x: string) => x.replace('-', '−')
const n = (k: Stat) => (r: Row) => minus(String(Math.round(r[k] ?? 0)))
const half = (k: Stat) => (r: Row) => minus(String(r[k] ?? 0).replace('.', ','))
const epa = (k: Stat) => (r: Row) => minus((r[k] ?? 0).toFixed(1).replace('.', ','))

export const GROUP_LABEL: Record<StatGroup, string> = { sendingar: 'Sendingar', hlaup: 'Hlaup', gripir: 'Gripir', vorn: 'Vörn' }

/** Columns per stat group, in the order they read on a player page. */
export const GROUP_COLUMNS: Record<StatGroup, Column[]> = {
  sendingar: [
    { label: 'Heppn./Tilr.', title: 'Heppnaðar sendingar / tilraunir', value: (r) => `${r.completions ?? 0}/${r.attempts ?? 0}` },
    { label: 'Jardar', title: 'Sendingajardar', value: n('passing_yards') },
    { label: 'SM', title: 'Snertimörk', value: n('passing_tds') },
    { label: 'Hler.', title: 'Hleranir (kastað)', value: n('interceptions') },
    { label: 'EPA', title: 'Vænt stig sem sendingarnar bættu við', value: epa('passing_epa') },
  ],
  hlaup: [
    { label: 'Hlaup', title: 'Hlaup', value: n('carries') },
    { label: 'Jardar', title: 'Hlaupajardar', value: n('rushing_yards') },
    { label: 'SM', title: 'Snertimörk', value: n('rushing_tds') },
  ],
  gripir: [
    { label: 'Grip', title: 'Grip', value: n('receptions') },
    { label: 'Skotm.', title: 'Skotmark (sendingar á leikmanninn)', value: n('targets') },
    { label: 'Jardar', title: 'Gripjardar', value: n('receiving_yards') },
    { label: 'SM', title: 'Snertimörk', value: n('receiving_tds') },
  ],
  vorn: [
    { label: 'Tækl.', title: 'Tæklingar (einar og með aðstoð)', value: (r) => String((r.tackles_solo ?? 0) + (r.tackle_assists ?? 0)) },
    { label: 'TFT', title: 'Tæklingar fyrir tap', value: half('tackles_for_loss') },
    { label: 'Fellur', title: 'Fellur', value: half('def_sacks') },
    { label: 'Hler.', title: 'Hleranir', value: n('def_interceptions') },
    { label: 'VS', title: 'Varðar sendingar', value: n('passes_defended') },
    { label: 'ÞB', title: 'Þvingaðir boltamissar', value: n('forced_fumbles') },
  ],
}

export interface LeaderStat { stat: Stat | 'tackles'; label: string; format?: 'epa' | 'half' }
export const LEADER_CATEGORIES: { group: StatGroup; stats: LeaderStat[] }[] = [
  { group: 'sendingar', stats: [{ stat: 'passing_yards', label: 'Sendingajardar' }, { stat: 'passing_tds', label: 'Snertimörk' }, { stat: 'passing_epa', label: 'EPA', format: 'epa' }] },
  { group: 'hlaup', stats: [{ stat: 'rushing_yards', label: 'Hlaupajardar' }, { stat: 'rushing_tds', label: 'Snertimörk' }] },
  { group: 'gripir', stats: [{ stat: 'receiving_yards', label: 'Gripjardar' }, { stat: 'receptions', label: 'Grip' }, { stat: 'receiving_tds', label: 'Snertimörk' }] },
  { group: 'vorn', stats: [{ stat: 'def_sacks', label: 'Fellur', format: 'half' }, { stat: 'def_interceptions', label: 'Hleranir' }, { stat: 'tackles', label: 'Tæklingar' }, { stat: 'tackles_for_loss', label: 'Tæklingar fyrir tap', format: 'half' }, { stat: 'forced_fumbles', label: 'Þvingaðir boltamissar' }] },
]
