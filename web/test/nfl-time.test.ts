import { describe, it, expect } from 'vitest'
import { easternToUtcIso, dayLabel, clock, isSmallHours } from '../src/lib/nfl/time'

describe('easternToUtcIso', () => {
  it('EDT er UTC-4', () => {
    expect(easternToUtcIso('2026-10-15', '20:15')).toBe('2026-10-16T00:15:00.000Z')
    expect(easternToUtcIso('2026-10-25', '13:00')).toBe('2026-10-25T17:00:00.000Z')
  })
  it('EST er UTC-5 frá fyrsta sunnudegi nóvember', () => {
    expect(easternToUtcIso('2026-11-01', '13:00')).toBe('2026-11-01T18:00:00.000Z')
    expect(easternToUtcIso('2027-01-10', '16:30')).toBe('2027-01-10T21:30:00.000Z')
  })
  it('sumartími byrjar annan sunnudag í mars', () => {
    expect(easternToUtcIso('2026-03-08', '13:00')).toBe('2026-03-08T17:00:00.000Z')
    expect(easternToUtcIso('2026-03-07', '13:00')).toBe('2026-03-07T18:00:00.000Z')
  })
})

describe('íslensk merki', () => {
  it('dagur, klukka og aðfaranótt', () => {
    expect(dayLabel('2026-10-16T00:15:00.000Z')).toBe('Föstudagur 16. október')
    expect(clock('2026-10-16T00:15:00.000Z')).toBe('00:15')
    expect(isSmallHours('2026-10-16T00:15:00.000Z')).toBe(true)
    expect(isSmallHours('2026-10-18T17:00:00.000Z')).toBe(false)
  })
})
