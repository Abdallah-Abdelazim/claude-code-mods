import { expect, mock, test } from 'claude-code/testing'

test('a window crossing 75% toasts once', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-19T12:00:00Z') })
  const toasts: string[] = []
  on('ui.toast', ($, e, next) => {
    toasts.push(e.text)
    return next(e)
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const resetsAt = '2026-10-19T14:11:00Z'
  const measure = (percent: number) =>
    $.session.measure({
      context: { window: 200_000, percent: 10 },
      rateLimits: [{ kind: 'five_hour', percentUsed: percent, resetsAt }],
      changed: ['rateLimits'],
    })

  await measure(76)
  await measure(77)

  expect(toasts).toEqual(['5-hour limit at 75% — resets in 2h11m'])
})
