import type { Limit } from '../types'

const WIDTH = 10
const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'week' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const bar = (percent: number): string => {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * WIDTH)

  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

const countdown = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(m / 60)
  return h ? `${h}h${m % 60}m` : `${m}m`
}

const dayTime = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours()
  const min = d.getMinutes() ? `:${String(d.getMinutes()).padStart(2, '0')}` : ''
  return `${DAYS[d.getDay()]} ${h % 12 || 12}${min}${h < 12 ? 'am' : 'pm'}`
}

const reset = (l: Limit, now: number) =>
  l.resetsAt ? ` ↻${l.kind === 'five_hour' ? countdown(Date.parse(l.resetsAt) - now) : dayTime(l.resetsAt)}` : ''

export const line = (limits: readonly Limit[], now: number): string | undefined => {
  const parts = limits
    .filter(l => l.kind in LABELS)
    .map(l => `${LABELS[l.kind]} ${bar(l.percentUsed)} ${Math.round(l.percentUsed)}%${reset(l, now)}`)

  return parts.length ? parts.join('  ·  ') : undefined
}
