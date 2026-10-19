import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-19T12:00:00Z')
const props = {
  hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 140, scroll: { offset: 0, bodyRows: 4 }, view: {},
}
const todo = (content: string, status: 'pending' | 'in_progress' | 'completed') => ({ content, status, activeForm: `Doing ${content}` })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`2 of 4 tasks reads 2/4 · 50% above another mod's line on ${surface}`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    on('prompt.submit', ($, e) => ({ text: e.text }))
    on('tool.call', () => ({ result: 'ok' }) as never)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      return Box({ children: [Text({ children: ['other mod line'] })] })
    })

    await $.prompt.submit({ text: 'Fix the login bug\nand add tests' } as never)
    await $.tool.call({ tool: 'TodoWrite', todos: [todo('a', 'in_progress'), todo('b', 'pending'), todo('c', 'pending'), todo('d', 'pending')] } as never)
    await clock.advance(60_000)
    await $.tool.call({ tool: 'TodoWrite', todos: [todo('a', 'completed'), todo('b', 'in_progress'), todo('c', 'pending'), todo('d', 'pending')] } as never)
    await clock.advance(60_000)
    await $.tool.call({ tool: 'TodoWrite', todos: [todo('a', 'completed'), todo('b', 'completed'), todo('c', 'in_progress'), todo('d', 'pending')] } as never)

    const ui = await $.ui.mount({ plugin: 'goal-meter', surface, component: 'AbovePrompt', props })
    const text = JSON.stringify(await ui.drawn())

    expect(text).toContain('Fix the login bug')
    expect(text).toContain('2/4 · 50%')
    expect(text).toContain('ETA ~')
    expect(text.indexOf('2/4 · 50%')).toBeLessThan(text.indexOf('other mod line'))
  })
}

test('TaskCreate and TaskUpdate drive the band, and an idle chip shows before any task', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  let n = 0
  on('tool.call', () => ({ result: { task: { id: `t${++n}`, subject: 's' } } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const band = async () => {
    const ui = await $.ui.mount({ plugin: 'goal-meter', surface: 'terminal', component: 'AbovePrompt', props })
    const text = JSON.stringify(await ui.drawn())
    await ui.unmount()
    return text
  }

  expect(await band()).toContain('idle')

  for (const subject of ['a', 'b']) await $.tool.call({ tool: 'TaskCreate', subject, description: subject } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: 't1', status: 'completed' } as never)

  expect(await band()).toContain('1/2 · 50%')
})
