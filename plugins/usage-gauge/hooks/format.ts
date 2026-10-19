import type { Pace } from '../types'

const SHORT: Record<string, string> = { five_hour: '5h', seven_day: 'week' }
const TITLE: Record<string, string> = { five_hour: '5-hour', seven_day: 'Weekly' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PACE_MIN_MS = 5 * 60_000

export const shortName = (kind: string) => SHORT[kind] ?? kind
export const titleName = (kind: string) => TITLE[kind] ?? kind

// Green under 60%, amber 60 to 85, red over 85.
export const toneOf = (pct: number) => (pct > 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e')

export function bar(pct: number, cells: number) {
  const on = Math.max(0, Math.min(cells, Math.round((cells * pct) / 100)))
  return '▰'.repeat(on) + '▱'.repeat(cells - on)
}

export function countdown(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(m / 60)
  return h ? `${h}h${m % 60}m` : `${m}m`
}

export function dayTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const min = d.getMinutes() ? `:${String(d.getMinutes()).padStart(2, '0')}` : ''
  return `${DAYS[d.getDay()]} ${h % 12 || 12}${min}${h < 12 ? 'am' : 'pm'}`
}

// The five-hour window counts down; longer windows name their reset day.
export function resetText(kind: string, iso: string | null, now: number) {
  if (!iso) return ''
  return kind === 'five_hour' ? countdown(Date.parse(iso) - now) : dayTime(iso)
}

// Ms until the window runs out at its current rate, if that comes before it resets.
export function outIn(pace: Pace, percent: number, now: number) {
  const elapsed = now - pace.at
  const gained = percent - pace.percent
  const resetAt = Date.parse(pace.resetsAt)
  if (elapsed < PACE_MIN_MS || gained <= 0 || resetAt <= now) return null
  const ms = ((100 - percent) * elapsed) / gained
  return now + ms < resetAt ? ms : null
}
