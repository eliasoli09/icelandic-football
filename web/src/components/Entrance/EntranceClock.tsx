'use client'

import { createContext, useContext, type MutableRefObject } from 'react'

export interface EntranceClock { active: boolean; waveTime: number; heroVisible: boolean }
export const EntranceClockContext = createContext<MutableRefObject<EntranceClock> | null>(null)
export const useEntranceClock = () => useContext(EntranceClockContext)
