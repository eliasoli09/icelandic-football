type PointerPosition = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>

export class TapGesture {
  private pointers = new Map<number, { x: number; y: number }>()
  private suppressed = false

  get isActive() { return this.pointers.size > 0 }

  start(event: PointerPosition) {
    if (!this.pointers.size) this.suppressed = false
    if (this.pointers.has(event.pointerId)) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size > 1) this.suppressed = true
  }

  move(event: PointerPosition) {
    const start = this.pointers.get(event.pointerId)
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) this.suppressed = true
  }

  end(event: PointerPosition) {
    this.move(event)
    const tap = this.pointers.has(event.pointerId) && this.pointers.size === 1 && !this.suppressed
    this.pointers.delete(event.pointerId)
    return tap
  }

  cancel(pointerId: number) {
    this.suppressed = true
    this.pointers.delete(pointerId)
  }
}
