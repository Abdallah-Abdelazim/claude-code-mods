import { expect, test } from 'claude-code/testing'

import { bar, line } from './format'

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
  ])
  expect(out).toBe('Session ████░░░░░░ 42%  ·  Week █░░░░░░░░░ 7%')
  expect(line([])).toBeUndefined()
})
