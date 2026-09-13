import { describe, expect, it } from 'vitest'
import { TapGesture } from './TapGesture'

const point = (pointerId: number, clientX = 100, clientY = 100) => ({ pointerId, clientX, clientY })

describe('map tap selection', () => {
  it('accepts one stationary pointer and rejects a cancelled pointer', () => {
    const gesture = new TapGesture()
    gesture.start(point(1))
    expect(gesture.end(point(1, 102))).toBe(true)
    gesture.start(point(2))
    gesture.cancel(2)
    expect(gesture.end(point(2))).toBe(false)
  })

  it('rejects a drag even when the pointer returns to its starting position', () => {
    const gesture = new TapGesture()
    gesture.start(point(1))
    gesture.move(point(1, 120))
    gesture.move(point(1))
    expect(gesture.end(point(1))).toBe(false)
  })

  it('never selects a stationary second finger after a pinch', () => {
    const gesture = new TapGesture()
    gesture.start(point(1))
    gesture.start(point(2, 200))
    gesture.move(point(1, 90))
    expect(gesture.end(point(2, 200))).toBe(false)
    expect(gesture.isActive).toBe(true)
    expect(gesture.end(point(1, 90))).toBe(false)
  })

  it('keeps suppression until every finger is lifted, then accepts a fresh tap', () => {
    const gesture = new TapGesture()
    gesture.start(point(1))
    gesture.start(point(2, 200))
    expect(gesture.end(point(1))).toBe(false)
    gesture.start(point(3, 300))
    gesture.cancel(2)
    expect(gesture.end(point(3, 300))).toBe(false)
    expect(gesture.isActive).toBe(false)
    gesture.start(point(4))
    expect(gesture.end(point(4))).toBe(true)
  })
})
