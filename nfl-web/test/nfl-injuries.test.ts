import { describe, expect, it } from 'vitest'
import { availability, injuryLabel, isUnavailable, parseInjuries } from '../src/lib/nfl/injuries'

const REPORT_HEAD = 'season,season_type,game_type,team,week,gsis_id,position,full_name,first_name,last_name,report_primary_injury,report_secondary_injury,report_status,practice_primary_injury,practice_secondary_injury,practice_status'
const ROSTER_HEAD = 'season,team,position,status,full_name,gsis_id,week,game_type,status_description_abbr'

describe('parseInjuries', () => {
  const report = [REPORT_HEAD,
    '2026,REG,REG,LA,5,00-1,RB,Old Week,O,W,Knee,,Out,Knee,,Did Not Participate In Practice',
    '2026,REG,REG,LA,6,00-2,WR,Sore Hammy,S,H,Hamstring,Ankle,Questionable,Hamstring,,Limited Participation in Practice',
    '2026,REG,REG,KC,6,00-3,QB,Healthy Guy,H,G,,,,Knee,,Full Participation in Practice',
    '2026,REG,REG,KC,6,00-4,TE,Both Lists,B,L,Concussion,,Out,Concussion,,Did Not Participate In Practice',
  ].join('\n')
  const roster = [ROSTER_HEAD,
    '2026,KC,RB,RES,On Ir,00-5,6,REG,R01',
    '2026,KC,TE,RES,Both Lists,00-4,6,REG,R01',
    '2026,KC,WR,RES,Pup Guy,00-6,6,REG,R04',
    '2026,KC,WR,ACT,Active Guy,00-7,6,REG,A01',
    '2026,KC,WR,CUT,Let Go,00-8,6,REG,W03',
    '2026,KC,WR,RES,Old Ir,00-9,5,REG,R01',
  ].join('\n')
  const w = parseInjuries(report, roster, 2026)!
  const by = new Map(w.rows.map((r) => [r.player_id, r]))
  it('takes the latest week only', () => {
    expect(w.week).toBe(6)
    expect(by.has('00-1')).toBe(false)
    expect(by.has('00-9')).toBe(false)
  })
  it('keeps report statuses and drops practice-only lines', () => {
    expect(by.get('00-2')).toMatchObject({ status: 'Questionable', injury: 'Hamstring, Ankle', source: 'report' })
    expect(by.has('00-3')).toBe(false)
  })
  it('adds the roster reserve list; the report wins on overlap', () => {
    expect(by.get('00-5')).toMatchObject({ status: 'IR', source: 'roster' })
    expect(by.get('00-6')?.status).toBe('PUP')
    expect(by.get('00-8')?.status).toBe('Cut')
    expect(by.has('00-7')).toBe(false)
    expect(by.get('00-4')).toMatchObject({ status: 'Out', injury: 'Concussion', source: 'report' })
  })
  it('takes a named week, or the newest week before it', () => {
    const w5 = parseInjuries(report, roster, 2026, 5)!
    const by5 = new Map(w5.rows.map((r) => [r.player_id, r]))
    expect(w5.week).toBe(5)
    expect(by5.get('00-1')).toMatchObject({ status: 'Out', source: 'report' })
    expect(by5.get('00-9')).toMatchObject({ status: 'IR', source: 'roster' })
    expect(by5.has('00-2')).toBe(false)
    expect(by5.has('00-5')).toBe(false)
    expect(parseInjuries(report, roster, 2026, 8)!.week).toBe(6)
    expect(parseInjuries(report, roster, 2026, 4)).toBeNull()
  })
  it('falls back to the roster when the report has no week up to the one named', () => {
    const early = parseInjuries(report, [ROSTER_HEAD, '2026,KC,WR,RES,Early Ir,00-10,3,REG,R01'].join('\n'), 2026, 4)!
    expect(early.week).toBe(3)
    expect(early.rows.map((r) => r.player_id)).toEqual(['00-10'])
  })
})

describe('labels', () => {
  it('translates injuries it knows', () => {
    expect(injuryLabel('Knee')).toBe('hné')
    expect(injuryLabel('Hamstring, Ankle')).toBe('aftanlæri, ökkli')
    expect(injuryLabel('Right Knee')).toBe('hné')
    expect(injuryLabel('Not injury related - resting player')).toBe('hvíld')
    expect(injuryLabel('Turf toe syndrome')).toBe('Turf toe syndrome')
    expect(injuryLabel(null)).toBeNull()
  })
  it('only Questionable may still play', () => {
    expect(isUnavailable('Questionable')).toBe(false)
    expect(isUnavailable('Out')).toBe(true)
    expect(isUnavailable('IR')).toBe(true)
  })
})

describe('availability', () => {
  const rows = [
    { player_id: 'a', status: 'Out' as const, source: 'report' as const },
    { player_id: 'b', status: 'IR' as const, source: 'roster' as const },
  ]
  it('uses the whole list in its own week, only the reserve list when it is older', () => {
    expect([...availability(rows, 6, 6).keys()]).toEqual(['a', 'b'])
    expect([...availability(rows, 5, 6).keys()]).toEqual(['b'])
    expect(availability(rows, null, 6).size).toBe(0)
  })
})
