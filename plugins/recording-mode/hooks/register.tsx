import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { RecMode } from '../types'
import { PROMPT_SECTION, initial, maskProps, maskText } from './mask'

const MODE_KEY = 'recording-mode'
const WORDS_KEY = 'recording-mode.words'
const USAGE = 'Usage: /rec | /rec strict | /rec off | /rec hide <word> | /rec unhide <word> | /rec list | /rec test <text>'

const modeA = atom({ plugin: 'recording-mode', key: 'mode' } as const, 'off')

// Private words live only in $.store, read when a message is drawn.
async function loadWords($: Engine) {
  return ((await $.store.get(WORDS_KEY)) as string[] | null) ?? []
}

async function setMode($: Engine, mode: RecMode) {
  await $.store.set(MODE_KEY, { mode })
  await update($, modeA, () => mode)
  $.ui.status(mode === 'off' ? undefined : '● REC')
  $.ui.toast(mode === 'off' ? 'Recording mode OFF' : mode === 'strict' ? 'Recording mode ON (strict)' : 'Recording mode ON')
}

async function start($: Engine) {
  const saved = (await $.store.get(MODE_KEY)) as { mode?: RecMode } | null
  const mode = saved?.mode ?? 'off'
  await update($, modeA, () => mode)
  if (mode === 'off') return
  $.ui.status('● REC')
  $.ui.toast('Recording mode is still ON')
}

async function maskedProps<P extends object>($: Engine, props: P, keys: readonly string[]) {
  const mode = await read($, modeA)
  if (mode === 'off') return null
  return maskProps(props, keys, { strict: mode === 'strict', words: await loadWords($) })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rec',
      description: 'Recording mode: mask secrets on screen.',
      argumentHint: 'strict | off | hide <word> | unhide <word> | list | test <text>',
    })
    await start($)

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if ((await read($, modeA)) === 'off') return result

    return { sections: [...result.sections, { id: 'recording-mode', text: PROMPT_SECTION, scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'rec' }, async ($, e) => {
    const [cmd = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ').trim()
    const mode = await read($, modeA)

    if (cmd === '') {
      await setMode($, mode === 'off' ? 'on' : 'off')
      return { text: `Recording mode ${mode === 'off' ? 'on' : 'off'}.` }
    }
    if (cmd === 'off' || cmd === 'strict') {
      await setMode($, cmd === 'off' ? 'off' : 'strict')
      return { text: `Recording mode ${cmd === 'off' ? 'off' : 'on (strict)'}.` }
    }
    if (cmd === 'hide' || cmd === 'unhide') {
      if (!arg) return { text: USAGE }
      const words = await loadWords($)
      const word = arg.toLowerCase()
      const next = cmd === 'hide' ? [...new Set([...words, word])] : words.filter(w => w !== word)
      await $.store.set(WORDS_KEY, next)
      return { text: `${next.length} private word${next.length === 1 ? '' : 's'} saved.` }
    }
    if (cmd === 'list') {
      const words = await loadWords($)
      return { text: `${words.length} private word${words.length === 1 ? '' : 's'}${words.length ? `: ${words.map(initial).join(' ')}` : ''}` }
    }
    if (cmd === 'test') {
      const words = await loadWords($)
      return { text: maskText(arg, { strict: mode === 'strict', words }) }
    }

    return { text: USAGE }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const mode = await read($, modeA)
    if (mode === 'off') return below

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#ffffff" backgroundColor="#ef4444"> ● REC </Text>
          <Text dimColor>{mode === 'strict' ? ' masking on screen (strict)' : ' masking on screen'}</Text>
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const props = await maskedProps($, e.props, ['text'])

    return next(props ? { ...e, props } : e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const props = await maskedProps($, e.props, ['text'])

    return next(props ? { ...e, props } : e)
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    const props = await maskedProps($, e.props, ['text', 'args'])

    return next(props ? { ...e, props } : e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const props = await maskedProps($, e.props, ['input', 'output'])

    return next(props ? { ...e, props } : e)
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const props = await maskedProps($, e.props, ['output'])

    return next(props ? { ...e, props } : e)
  })
}
