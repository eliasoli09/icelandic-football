import { describe, it, expect } from 'vitest'
import { shareUrl } from '../src/lib/shareLink'
import { parseUtm } from '../src/lib/utm'

describe('shareUrl', () => {
  it('tags a shared result so its landing is counted', () => {
    const url = shareUrl('/leidin', 'leidin')
    expect(url).toBe('https://islensk-fotbolti.vercel.app/leidin?utm_source=deila&utm_medium=share&utm_campaign=leidin')
    expect(parseUtm(new URL(url).search)).toMatchObject({ source: 'deila', medium: 'share', campaign: 'leidin' })
  })
})
