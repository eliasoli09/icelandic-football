import { ProbBar } from '@/components/ProbBar'
import { ShareButton } from '@/components/ShareButton'
import { FormBadges } from '@/components/FormBadges'
import { teams, matchDetail, teamInfo, matchReport, matchOdds } from '@/lib/queries'
import { OddsTable } from '@/components/OddsTable'
import { TeamBadge } from '@/components/TeamBadge'
import { displayColor, tint } from '@/lib/teamColors'
import type { PredictionFactors } from '@/lib/types'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return {
    openGraph: { images: [`/api/og/leikur/${id}`] },
    twitter: { card: 'summary_large_image', images: [`/api/og/leikur/${id}`] },
  }
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('is-IS', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let names = new Map<number, string>()
  let infos: Awaited<ReturnType<typeof teamInfo>> = new Map()
  let detail: Awaited<ReturnType<typeof matchDetail>> = null
  let report: Awaited<ReturnType<typeof matchReport>> = null
  let odds: Awaited<ReturnType<typeof matchOdds>> = []
  try {
    ;[names, infos, detail, report, odds] = await Promise.all([teams(), teamInfo(), matchDetail(Number(id)), matchReport(Number(id)), matchOdds(Number(id))])
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
  if (!detail) return <p className="muted">Leikur fannst ekki.</p>
  const { match, prediction, events } = detail
  const nm = (tid: number) => names.get(tid) ?? `#${tid}`
  const factors = (prediction?.factors ?? null) as
    | (PredictionFactors & {
        topScorelines?: { home: number; away: number; p: number }[]
        newsAdjustments?: { home: string[]; away: string[] }
      })
    | null

  return (
    <div className="max-w-2xl mx-auto grid gap-6">
      <section
        className="card p-6 text-center"
        style={{
          background: `linear-gradient(120deg, ${tint(infos.get(match.home_team), 0.22)} 0%, var(--surface) 42%, var(--surface) 58%, ${tint(infos.get(match.away_team), 0.22)} 100%)`,
        }}
      >
        <p className="text-xs muted mb-3">
          {fmtDate(match.date)} · {match.venue ?? ''} · {match.league === 'besta' ? 'Besta deildin' : 'Lengjudeildin'} {match.season}
        </p>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-lg font-bold flex-1 text-right inline-flex items-center justify-end gap-2">
            <span style={{ color: displayColor(infos.get(match.home_team)) }}>{nm(match.home_team)}</span>
            <TeamBadge info={infos.get(match.home_team)} size={34} />
          </h1>
          <div className="stat text-4xl sm:text-5xl px-4">
            {match.status === 'played' ? `${match.home_goals} – ${match.away_goals}` : 'gegn'}
          </div>
          <h1 className="text-lg font-bold flex-1 text-left inline-flex items-center gap-2">
            <TeamBadge info={infos.get(match.away_team)} size={34} />
            <span style={{ color: displayColor(infos.get(match.away_team)) }}>{nm(match.away_team)}</span>
          </h1>
        </div>
        {prediction && match.status === 'upcoming' && (
          <ProbBar pHome={prediction.p_home} pDraw={prediction.p_draw} pAway={prediction.p_away} />
        )}
        {report && (
          <p className="mt-4 text-sm">
            <a href={report.url} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4" style={{ color: 'var(--accent)' }}>
              Lesa leikskýrslu á fótbolta.net ↗
            </a>
          </p>
        )}
        <div className="mt-4">
          <ShareButton
            title={`${nm(match.home_team)} – ${nm(match.away_team)}`}
            text={match.status === 'played'
              ? `${nm(match.home_team)} ${match.home_goals} – ${match.away_goals} ${nm(match.away_team)}`
              : `Spá: ${nm(match.home_team)} ${Math.round((prediction?.p_home ?? 0) * 100)}% – jafntefli ${Math.round((prediction?.p_draw ?? 0) * 100)}% – ${nm(match.away_team)} ${Math.round((prediction?.p_away ?? 0) * 100)}%`}
            path={`/leikir/${match.id}`}
            imagePath={`/api/og/leikur/${match.id}`}
          />
        </div>
      </section>

      {match.status === 'upcoming' && odds.length > 0 && (
        <OddsTable
          odds={odds}
          favored={
            prediction
              ? ((['home', 'draw', 'away'] as const)[
                  [prediction.p_home, prediction.p_draw, prediction.p_away].indexOf(
                    Math.max(prediction.p_home, prediction.p_draw, prediction.p_away),
                  )
                ] ?? 'home')
              : 'home'
          }
          homeName={nm(match.home_team)}
          awayName={nm(match.away_team)}
        />
      )}

      {factors && match.status === 'upcoming' && (
        <section className="card p-5">
          <h2 className="display font-extrabold mb-4">Af hverju? — rökin á bak við spána</h2>
          <div className="grid gap-2.5 text-sm">
            <Row label="Elo-stig">
              <span className="num">{factors.eloHome} gegn {factors.eloAway} <span className="muted">(munur {factors.eloDiff > 0 ? '+' : ''}{factors.eloDiff})</span></span>
            </Row>
            <Row label="Form (nýjast fyrst)">
              <span className="flex gap-3 justify-end">
                <FormBadges form={factors.formHome} />
                <FormBadges form={factors.formAway} />
              </span>
            </Row>
            <Row label="Mörk skoruð/fengin í leik">
              <span className="num">{factors.gfHome}/{factors.gaHome} gegn {factors.gfAway}/{factors.gaAway}</span>
            </Row>
            <Row label="Innbyrðis frá 2019">
              <span className="num">{factors.h2h.homeWins} sigrar – {factors.h2h.draws} jafntefli – {factors.h2h.awayWins} tap</span>
            </Row>
            <Row label="Heimavallaráhrif deildar">
              <span className="num">×{factors.homeAdvantage}</span>
            </Row>
          </div>
          {factors.newsAdjustments && (
            <div className="mt-4 pt-3 grid gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs font-bold muted uppercase tracking-wide">Fréttastuðlar</p>
              {[...factors.newsAdjustments.home.map((r) => `${nm(match.home_team)} ${r}`),
                ...factors.newsAdjustments.away.map((r) => `${nm(match.away_team)} ${r}`)].map((r) => (
                <p key={r} className="text-xs" style={{ color: 'var(--accent)' }}>{r}</p>
              ))}
              <p className="text-[10px] muted">Handskráð atvik úr fréttum (t.d. sölur, meiðsli, Evrópuálag) — lögð ofan á Elo í spánni.</p>
            </div>
          )}
          {factors.topScorelines && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs muted mb-2">Líklegustu úrslit</p>
              <div className="flex gap-2 flex-wrap">
                {factors.topScorelines.slice(0, 5).map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs num font-semibold" style={{ background: 'var(--surface-2)' }}>
                    {s.home}–{s.away} <span className="muted">{Math.round(s.p * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {events.length > 0 && (
        <section className="card p-5">
          <h2 className="display font-extrabold mb-4">Atburðir</h2>
          <div className="grid gap-1.5 text-sm">
            {events.map((e) => (
              <div key={`${e.event_id}-${e.type}-${e.player_name}`} className="flex items-center gap-3">
                <span className="muted num w-8 text-right">{e.minute}&rsquo;</span>
                <span className="w-5 text-center">
                  {e.type === 'goal' ? '⚽' : e.type === 'penalty' ? '⚽ (v)' : e.type === 'owngoal' ? '⚽ (sj)' : e.type === 'yellow' ? '🟨' : e.type === 'red' ? '🟥' : e.type === 'sub_in' ? '▲' : '▼'}
                </span>
                <span className={e.side === 'home' ? '' : 'muted'}>{e.player_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="muted">{label}</span>
      {children}
    </div>
  )
}
