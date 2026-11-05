import { describe, it, expect } from 'vitest'
import { BOT_UA, parseUtm, referrerHost } from '../src/lib/utm'

describe('parseUtm', () => {
  it('reads every utm field', () => {
    expect(parseUtm('?utm_source=facebook&utm_medium=group&utm_campaign=leidin&utm_content=a&utm_term=b')).toEqual({
      source: 'facebook', medium: 'group', campaign: 'leidin', content: 'a', term: 'b',
    })
  })

  it('is null without a utm_source', () => {
    expect(parseUtm('')).toBeNull()
    expect(parseUtm('?utm_campaign=leidin')).toBeNull()
    expect(parseUtm('?utm_source=%20%20')).toBeNull()
  })

  it('lowercases, hyphenates spaces and drops anything outside [a-z0-9._-]', () => {
    expect(parseUtm('?utm_source=FaceBook&utm_campaign=Leiðin%20á%20völl<script>')).toMatchObject({
      source: 'facebook', campaign: 'leiin--vllscript',
    })
  })

  it('caps values at 100 characters and leaves missing fields null', () => {
    const u = parseUtm(`?utm_source=${'x'.repeat(300)}`)
    expect(u?.source).toHaveLength(100)
    expect(u?.medium).toBeNull()
  })
})

describe('referrerHost', () => {
  it('keeps only the host', () => {
    expect(referrerHost('https://l.facebook.com/l.php?u=abc')).toBe('l.facebook.com')
  })

  it('is null for empty or malformed referrers', () => {
    expect(referrerHost('')).toBeNull()
    expect(referrerHost(undefined)).toBeNull()
    expect(referrerHost('not a url')).toBeNull()
  })
})

describe('BOT_UA', () => {
  it('skips link previews but not browsers', () => {
    expect(BOT_UA.test('facebookexternalhit/1.1')).toBe(true)
    expect(BOT_UA.test('Twitterbot/1.0')).toBe(true)
    expect(BOT_UA.test('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(false)
  })
})
