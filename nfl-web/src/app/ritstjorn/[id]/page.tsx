import { DeskEditor } from '@/components/Ritstjorn/DeskEditor'

export const metadata = { title: 'Ritstjórn', robots: { index: false } }

type Props = { params: Promise<{ id: string }> }

export default async function RitstjornArticlePage({ params }: Props) {
  const { id } = await params
  return <DeskEditor id={id} />
}
