import type { GoalState, GoalTask } from '../types'

export const GREEN = '#22c55e'
export const AMBER = '#f59e0b'
export const SHOW_DONE_MS = 2 * 60_000

export const firstLine = (text: string, max = 50) => {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

export const fmtMin = (ms: number) => {
  const m = Math.round(ms / 60_000)
  return m < 1 ? '<1m' : `${m}m`
}

export function bar(pct: number, cells = 6) {
  const on = Math.max(0, Math.min(cells, Math.round((cells * pct) / 100)))
  return '▰'.repeat(on) + '▱'.repeat(cells - on)
}

const spent = (t: GoalTask) => (t.startedAt !== null && t.endedAt !== null ? t.endedAt - t.startedAt : null)

export function stats(goal: GoalState, now: number) {
  const done = goal.tasks.filter(t => t.status === 'completed')
  const times = done.map(spent).filter((n): n is number => n !== null)
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
  const running = goal.tasks.find(t => t.status === 'in_progress') ?? null
  const runningFor = running?.startedAt != null ? now - running.startedAt : 0
  return {
    done: done.length,
    total: goal.tasks.length,
    pct: goal.tasks.length ? Math.round((100 * done.length) / goal.tasks.length) : 0,
    avg,
    running,
    isSlow: avg !== null && avg > 0 && runningFor > 2 * avg,
    eta: avg !== null && times.length > 0 ? avg * (goal.tasks.length - done.length) : null,
  }
}

export const taskTime = (t: GoalTask, now: number) => {
  const ms = t.endedAt !== null && t.startedAt !== null ? t.endedAt - t.startedAt : t.startedAt !== null ? now - t.startedAt : null
  return ms === null ? '' : fmtMin(ms)
}
