import { expect, it } from 'vitest'
import { formatKickoff } from '../src/lib/kickoff'

it('keeps Icelandic kickoff labels identical on server and browser without ICU locale dependencies', () => {
  expect(formatKickoff('2026-09-13T14:00:00Z')).toBe('sun., 13. sep., 14:00')
  expect(formatKickoff('2026-09-14T21:15:00+02:00')).toBe('mán., 14. sep., 19:15')
})
it('handles unknown kickoff dates', () => {
  expect(formatKickoff(null)).toBe('Óráðið')
  expect(formatKickoff('invalid')).toBe('Óráðið')
})
