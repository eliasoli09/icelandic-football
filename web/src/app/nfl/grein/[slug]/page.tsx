import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Bot } from 'lucide-react'
import { ARTICLE_KIND } from '@/components/Nfl/ArticleList'
import { Markdown } from '@/lib/nfl/articles/markdown'
import { nflArticle } from '@/lib/nfl/articles/queries'
import { dayLabel } from '@/lib/nfl/time'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await nflArticle((await params).slug).catch(() => null)
  if (!a) return { title: 'Grein fannst ekki' }
  return {
    title: `${a.title} - Besta spáin`,
    description: a.lede,
    openGraph: { type: 'article', title: a.title, description: a.lede, publishedTime: a.published_at, modifiedTime: a.updated_at, locale: 'is_IS' },
  }
}

export default async function NflArticlePage({ params }: Props) {
  const a = await nflArticle((await params).slug).catch(() => null)
  if (!a) notFound()
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, description: a.lede,
    datePublished: a.published_at, dateModified: a.updated_at, inLanguage: 'is',
    publisher: { '@type': 'Organization', name: 'Besta spáin' },
  }
  return (
    <article className="grid gap-5 max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/nfl/greinar" className="text-sm muted inline-flex items-center gap-1.5"><ArrowLeft size={14} aria-hidden /> Allar greinar</Link>
      <header className="grid gap-2">
        <p className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--accent)' }}>{ARTICLE_KIND[a.kind].toUpperCase()} <span className="muted font-normal">· {dayLabel(a.published_at)}</span></p>
        <h1 className="display text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">{a.title}</h1>
        {a.lede && <p className="text-lg font-semibold">{a.lede}</p>}
      </header>
      <Markdown text={a.body} />
      {a.kind !== 'grein' && (
        <p className="text-xs muted inline-flex items-start gap-1.5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Bot size={13} aria-hidden className="shrink-0 mt-0.5" />
          Skrifað með aðstoð gervigreindar úr gögnum Besta spáarinnar og yfirlesið af ritstjórn.
        </p>
      )}
      {a.game_id && <Link href={`/nfl/leikur/${a.game_id}`} className="text-sm underline decoration-dotted underline-offset-2 w-fit">Leikurinn: tölur og spá</Link>}
    </article>
  )
}
