import { describe, it, expect } from 'vitest'
import { leagueTheme, leagueVars } from '../src/lib/leagueTheme'

describe('leagueTheme', () => {
  it('is stable for a key', () => {
    expect(leagueTheme('brazil-serie-b').accent).toBe(leagueTheme('brazil-serie-b').accent)
  })

  it('gives different leagues different accents', () => {
    const seen = new Set<string>()
    for (const k of ['a-league', 'mls', 'championship', 'eredivisie', 'liga-mx', 'j1', 'k-league']) {
      seen.add(leagueTheme(k).accent)
    }
    expect(seen.size).toBe(7)
  })

  it('gives the founding leagues the exact colours the stylesheet uses', () => {
    // anything painting from JS — the hero waves, an OG image — must match
    // globals.css, not approximate it
    expect(leagueTheme('besta').accent).toBe('#e8b93c')
    expect(leagueTheme('lengjudeild').accent).toBe('#2f9df4')
  })

  it('always returns a usable colour, whatever it is handed', () => {
    for (const bad of [undefined, null, '', 'red', 'var(--accent)', '#xyz', '#fff']) {
      const t = leagueTheme('some-league', bad as string | null | undefined)
      expect(typeof t.accent).toBe('string')
      expect(t.accent.length).toBeGreaterThan(3)
      expect(t.glow.length).toBeGreaterThan(3)
    }
  })

  it('honours an explicit colour and ignores a malformed one', () => {
    expect(leagueTheme('x', '#ff0044').accent).toBe('#ff0044')
    expect(leagueTheme('x', 'red').accent).not.toBe('red')
  })

  it('avoids the hues that disappear on the dark surface', () => {
    for (let i = 0; i < 400; i++) {
      const m = leagueTheme(`league-${i}`).accent.match(/hsl\((\d+)/)!
      const hue = Number(m[1])
      expect(hue >= 52 && hue <= 68).toBe(false)
      expect(hue >= 232 && hue <= 258).toBe(false)
    }
  })

  it('exposes the variables the components already read', () => {
    const v = leagueVars(leagueTheme('mls'))
    expect(Object.keys(v).sort()).toEqual(['--accent', '--accent-ink', '--glow'])
  })
})
