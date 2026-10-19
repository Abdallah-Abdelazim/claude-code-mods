import type { SessionRateLimit } from 'claude-code'

const WIDTH = 10
const LABELS: Record<string, string> = { five_hour: 'Session', seven_day: 'Week' }

export const bar = (percent: number): string => {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * WIDTH)

  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

export const line = (limits: readonly SessionRateLimit[]): string | undefined => {
  const parts = limits
    .filter(l => l.kind in LABELS)
    .map(l => `${LABELS[l.kind]} ${bar(l.percentUsed)} ${Math.round(l.percentUsed)}%`)

  return parts.length ? parts.join('  ·  ') : undefined
}
