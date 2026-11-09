import type { ChordChart } from '~~/shared/types'
import { cloneChart } from './factory'

export class ChartHistory {
  private past: ChordChart[] = []
  private future: ChordChart[] = []
  private limit: number

  constructor(limit = 80) {
    this.limit = limit
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }

  push(current: ChordChart) {
    this.past.push(cloneChart(current))
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  undo(current: ChordChart): ChordChart | null {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(cloneChart(current))
    return prev
  }

  redo(current: ChordChart): ChordChart | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(cloneChart(current))
    return next
  }

  clear() {
    this.past = []
    this.future = []
  }
}
