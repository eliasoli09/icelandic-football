import { expect, test } from 'vitest'
import { UEFA_COMPETITIONS, getUefaCompetition } from '../src/lib/uefaCompetitions'

test('resolves all competition routes and safely defaults unknown keys', () => {
  expect(UEFA_COMPETITIONS.map(c=>c.key)).toEqual(['ucl','uel','uecl'])
  expect(getUefaCompetition('uel').name).toBe('Evrópudeildin')
  expect(getUefaCompetition('uecl').name).toBe('Sambandsdeildin')
  expect(getUefaCompetition(undefined).key).toBe('ucl')
  expect(getUefaCompetition('other').key).toBe('ucl')
})
