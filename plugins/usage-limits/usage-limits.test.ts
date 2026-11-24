import { expect, test } from 'claude-code/testing'

import { bar, line } from './hooks/format'

test('bar fills proportionally and clamps', () => {
  expect(bar(0)).toBe('░░░░░░░░░░')
  expect(bar(50)).toBe('█████░░░░░')
  expect(bar(140)).toBe('██████████')
})

test('line shows session and week, skips unknown kinds, empty when none', () => {
  const out = line([
    { kind: 'five_hour', percentUsed: 42 },
    { kind: 'seven_day', percentUsed: 7.4 },
    { kind: 'spend_limit', percentUsed: 99 },
  ], 0)
  expect(out).toBe('Session ████░░░░░░ 42%  ·  Week █░░░░░░░░░ 7%')
  expect(line([], 0)).toBeUndefined()
})

test('line adds a countdown for the session and a day for the week', () => {
  const now = Date.parse('2026-11-25T00:00:00')
  const out = line([
    { kind: 'five_hour', percentUsed: 2, resetsAt: new Date(now + 90 * 60_000).toISOString() },
    { kind: 'seven_day', percentUsed: 19, resetsAt: new Date('2026-11-26T01:00:00').toISOString() },
  ], now)
  expect(out).toBe('Session ░░░░░░░░░░ 2% ↻1h30m  ·  Week ██░░░░░░░░ 19% ↻Thu 1am')
})
