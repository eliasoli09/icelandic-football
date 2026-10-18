import type { Mark } from '@/lib/nfl/clinch'

const LABEL: Record<Mark, { short: string; long: string }> = {
  division: { short: 'R', long: 'Riðilsmeistari' },
  playoffs: { short: 'T', long: 'Tryggt sæti í úrslitakeppni' },
  eliminated: { short: 'Ú', long: 'Úr leik' },
}

/** A proven mark: R riðilsmeistari, T tryggt sæti, Ú úr leik. */
export function MarkBadge({ mark }: { mark: Mark | null | undefined }) {
  if (!mark) return null
  const l = LABEL[mark]
  const good = mark !== 'eliminated'
  return (
    <span title={l.long} aria-label={l.long}
      className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold shrink-0"
      style={{ background: good ? 'var(--win)' : 'var(--loss)', color: '#ffffff' }}>
      {l.short}
    </span>
  )
}

export const MARK_LEGEND = 'R riðilsmeistari · T tryggt sæti í úrslitakeppni · Ú úr leik. Merkin birtast aðeins þegar þau eru stærðfræðilega sönnuð.'
