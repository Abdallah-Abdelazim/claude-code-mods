import { expect, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 40, scroll: { offset: 0, bodyRows: 4 }, view: {} }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the rule sits above the other bands on ${surface}`, async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      return Box({ children: [Text({ children: ['other mod line'] })] })
    })

    const ui = await $.ui.mount({ plugin: 'band-rule', surface, component: 'AbovePrompt', props })
    const text = JSON.stringify(await ui.drawn())

    expect(text).toContain('─'.repeat(40))
    expect(text.indexOf('─')).toBeLessThan(text.indexOf('other mod line'))
  })
}
