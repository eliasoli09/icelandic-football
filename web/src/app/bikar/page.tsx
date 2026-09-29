import type { Metadata } from 'next'
import { BikarGame } from '@/components/Bikar/BikarGame'

export const metadata: Metadata = {
  title: 'Reyndu að verða bikarmeistari | Besta spáin',
  description: 'Draftaðu ellefu menn úr bestu liðum í sögu efstu deildar og reyndu að vinna bikarinn gegn goðsagnaliðum.',
}

export default function BikarPage() {
  return <BikarGame />
}
