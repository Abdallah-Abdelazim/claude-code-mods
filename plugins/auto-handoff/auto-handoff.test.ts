import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-19T12:00:00Z')
const PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} }

test('measure does nothing while auto-handoff is off', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', ($, e, next) => {
    toasts.push(e.text)
    return next(e)
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))

  await $.command.run({ command: 'auto-handoff', args: 'off' } as never)
  await $.session.measure({ context: { window: 200_000, percent: 90 }, rateLimits: [], changed: ['context'] })

  expect(toasts).toEqual([])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the threshold toasts once on ${surface}`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const toasts: string[] = []
    on('ui.toast', ($, e, next) => {
      toasts.push(e.text)
      return next(e)
    })
    on('session.measure', ($, e) => ({ changed: e.changed }))

    const measure = (percent: number) =>
      $.session.measure({ context: { window: 200_000, percent }, rateLimits: [], changed: ['context'] })
    await measure(81)
    await measure(82)

    expect(toasts).toEqual(['Chat is 80% full — saving a handoff'])
  })

  test(`save now on ${surface} submits the handoff prompt`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    const submits: string[] = []
    on('prompt.submit', ($, e) => {
      submits.push(e.text)
      return { text: e.text }
    })
    on('session.cwd', () => ({ value: '/work/app' }))
    on('fs.exists', () => ({ value: false }))
    on('command.list', () => ({ value: [] }))
    on('ui.toast', ($, e, next) => next(e))
    on('session.measure', ($, e) => ({ changed: e.changed }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))

    await $.session.measure({ context: { window: 200_000, percent: 85 }, rateLimits: [], changed: ['context'] })
    const ui = await $.ui.mount({ plugin: 'auto-handoff', surface, component: 'AbovePrompt', props: PROPS })
    await ui.press({ key: 'save' })
    await clock.advance(1)

    expect(submits.length).toBe(1)
  })
}
