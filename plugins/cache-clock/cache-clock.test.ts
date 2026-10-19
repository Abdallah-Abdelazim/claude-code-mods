import { expect, test } from 'claude-code/testing'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Compact on ${surface} calls session.compact`, async ($, on) => {
    let calls = 0
    on('session.compact', () => {
      calls += 1
      return { skip: 'test' }
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))

    const ui = await $.ui.mount({
      plugin: 'cache-clock',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
    })
    expect(calls).toBe(0)
    await ui.press({ key: 'compact' })

    expect(calls).toBe(1)
  })
}
