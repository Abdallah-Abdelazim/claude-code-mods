import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-19T12:00:00Z')
const props = (bodyColumns: number) => ({
  hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {},
})
const SKILL = { skill: 'watch', text: 'x', frontmatter: {}, source: 'userSettings' } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`agents stack on the band and drop task text first when narrow on ${surface}`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const ids = ['a1', 'a2']
    const models = ['claude-haiku-4-5', 'claude-sonnet-5-5']
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('agent.spawn', () => ({ model: models.shift() ?? '', agentId: ids.shift() }))
    on('skill.prompt', ($, e) => ({ text: e.text }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))

    await $.turn.start({ text: 'ship it', turnId: 't1' })
    await $.agent.spawn({ prompt: 'p', description: 'find the hooks', subagentType: 'Explore' } as never)
    await $.agent.spawn({ prompt: 'p', description: 'check the prices', subagentType: 'fact-checker' } as never)
    await $.skill.prompt(SKILL)
    await $.skill.prompt(SKILL)
    await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', agentId: 'a1' } as never)

    const drawn = async (cols: number) => {
      const ui = await $.ui.mount({ plugin: 'agent-watch', surface, component: 'AbovePrompt', props: props(cols) })
      const text = JSON.stringify(await ui.drawn())
      await ui.unmount()
      return text
    }

    const wide = await drawn(200)
    expect(wide).toContain('find the hooks')
    expect(wide).toContain('check the prices')
    expect(wide).toContain('haiku')
    expect(wide).toContain('✓')
    expect((wide.match(/ watch/g) ?? []).length).toBe(1)

    const narrow = await drawn(110)
    expect(narrow).toContain('find the hooks')
    expect(narrow).not.toContain('check the prices')
    expect(narrow).toContain('fact-checker')

    const tiny = await drawn(70)
    expect(tiny).toContain('find the hooks')
    expect(tiny).toContain('+1 more')
    expect(tiny).toContain('skills:')
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the Agents pane nests helpers and shows the timeline only on the terminal (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'a1' }))

    await $.turn.start({ text: 'ship it', turnId: 't1' })
    await $.agent.spawn({ prompt: 'p', description: 'find the hooks', subagentType: 'Explore' } as never)

    const ui = await $.ui.mount({
      plugin: 'agent-watch',
      surface,
      component: 'Pane',
      requestId: 'agent-watch',
      props: { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    const text = JSON.stringify(await ui.drawn())

    expect(text).toContain('"  ","Explore"," — "')
    expect(text).toContain('find the hooks')
    expect(text.includes('Timeline')).toBe(surface === 'terminal')
  })
}
