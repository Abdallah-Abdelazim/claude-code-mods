import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register, SessionMeasureInput } from 'claude-code'

import type { HandoffSettings } from '../types'
import { FILE, RESUME_PROMPT, agoLong, agoShort, TRACK, bar, clockTime, firstObjective, handoffPrompt, toneOf } from './format'

const KEY = 'auto-handoff'
const FRESH_MS = 10 * 60_000
const SAVE_TIMEOUT_MS = 10 * 60_000
const DEFAULTS: HandoffSettings = { isOn: true, threshold: 80, mode: 'ask', isHidden: false }
const USAGE = 'Usage: /auto-handoff on | off | now | resume | threshold <n> | mode auto|ask | hide | show | status'

const settingsA = atom({ plugin: 'auto-handoff', key: 'settings' } as const, DEFAULTS)
const fillA = atom({ plugin: 'auto-handoff', key: 'fill' } as const, null)
const phaseA = atom({ plugin: 'auto-handoff', key: 'phase' } as const, 'idle')
const savingSinceA = atom({ plugin: 'auto-handoff', key: 'savingSince' } as const, null)
const savedAtA = atom({ plugin: 'auto-handoff', key: 'savedAt' } as const, null)
const warnedA = atom({ plugin: 'auto-handoff', key: 'warned' } as const, false)
const staleA = atom({ plugin: 'auto-handoff', key: 'stale' } as const, null)
const seenMtimeA = atom({ plugin: 'auto-handoff', key: 'seenMtime' } as const, null)

async function loadSettings($: Engine) {
  const raw = await $.store.get(KEY)
  await update($, settingsA, () => ({ ...DEFAULTS, ...((raw ?? {}) as Partial<HandoffSettings>) }))
}

async function saveSettings($: Engine, next: HandoffSettings) {
  await $.store.set(KEY, next)
  await update($, settingsA, () => next)
}

async function handoffOf($: Engine, now: number) {
  const file = `${await $.session.cwd()}/${FILE}`
  if (!(await $.fs.exists(file))) return null
  const { mtimeMs } = await $.fs.stat(file)
  return { file, mtimeMs, isFresh: now - mtimeMs <= FRESH_MS }
}

async function commandNames($: Engine) {
  return (await $.command.list()).map(c => c.name)
}

async function start($: Engine) {
  await loadSettings($)
  const now = await $.clock.now()
  const usage = await $.session.usage().catch(() => null)
  await update($, fillA, () => usage?.context.percent ?? null)

  const handoff = await handoffOf($, now)
  if (handoff && handoff.mtimeMs !== (await read($, seenMtimeA))) {
    await update($, seenMtimeA, () => handoff.mtimeMs)
    const objective = firstObjective(await $.fs.read(handoff.file))
    await update($, staleA, () => ({ objective, mtimeMs: handoff.mtimeMs }))
    $.ui.toast(`Handoff from ${agoLong(now - handoff.mtimeMs)} available — /auto-handoff resume`)
  }
}

async function onMeasure($: Engine, e: SessionMeasureInput) {
  const fill = e.context.percent ?? null
  await update($, fillA, () => fill)
  if (fill === null) return

  const { threshold, mode, isOn } = await read($, settingsA)
  if (!isOn) return
  if (fill < threshold) {
    await update($, warnedA, () => false)
    if ((await read($, phaseA)) === 'due') await update($, phaseA, () => 'idle')
    return
  }
  if (await read($, warnedA)) return

  await update($, warnedA, () => true)
  $.ui.toast(`Chat is ${threshold}% full — saving a handoff`)
  if (mode === 'auto') $.clock.after(0, () => runSave($))
  else await update($, phaseA, () => 'due')
}

// Called from a timer: commands and prompts never run inside a hook.
async function runSave($: Engine) {
  const now = await $.clock.now()
  await update($, phaseA, () => 'saving')
  await update($, savingSinceA, () => now)
  if ((await commandNames($)).includes('handoff')) {
    await $.command.run({ command: 'handoff' })
  } else {
    await $.prompt.submit({ text: handoffPrompt(`${await $.session.cwd()}/${FILE}`) })
  }
}

async function checkSaved($: Engine) {
  if ((await read($, phaseA)) !== 'saving') return
  const since = await read($, savingSinceA)
  const now = await $.clock.now()
  const handoff = await handoffOf($, now)
  if (since === null || !handoff || handoff.mtimeMs < since) {
    // An interrupted turn or a handoff written elsewhere would otherwise leave the band stuck on "saving".
    if (since === null || now - since > SAVE_TIMEOUT_MS) await update($, phaseA, () => 'idle')
    return
  }

  await update($, phaseA, () => 'saved')
  await update($, savedAtA, () => handoff.mtimeMs)
  await update($, staleA, () => null)
  await update($, seenMtimeA, () => handoff.mtimeMs)
}

async function runResume($: Engine) {
  if ((await commandNames($)).includes('handoff')) {
    await $.command.run({ command: 'handoff', args: 'resume' })
  } else {
    await $.prompt.submit({ text: RESUME_PROMPT })
  }
  await update($, staleA, () => null)
}

async function runClear($: Engine) {
  const cleared = await $.command.run({ command: 'clear' }).then(() => true, () => false)
  if (!cleared) {
    $.ui.toast('Could not run /clear. Type /clear, then /auto-handoff resume.')
    return
  }
  await update($, phaseA, () => 'idle')
  await runResume($)
}

async function summary($: Engine) {
  const s = await read($, settingsA)
  const fill = await read($, fillA)
  const phase = await read($, phaseA)
  const savedAt = await read($, savedAtA)
  const stale = await read($, staleA)
  const now = await $.clock.now()
  const lines = [
    `${s.isOn ? 'on' : 'off'}${s.isHidden ? ', hidden' : ''} · threshold ${s.threshold}% · mode ${s.mode}`,
    `context ${fill === null ? 'unknown' : `${Math.round(fill)}%`} · ${phase}`,
  ]
  if (savedAt !== null) lines.push(`last handoff ${clockTime(savedAt)}`)
  if (stale) lines.push(`from ${agoLong(now - stale.mtimeMs)}: ${stale.objective}`)
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'auto-handoff',
      description: 'Watch chat fill and save a handoff at a threshold.',
      argumentHint: 'on | off | now | resume | threshold <n> | mode auto|ask | hide | show | status',
    })
    await start($)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await onMeasure($, e)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await checkSaved($)

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    if (e.trigger !== 'precompute' && e.agentId === undefined) {
      const handoff = await handoffOf($, await $.clock.now())
      if (!handoff?.isFresh) $.ui.toast('Compacting without a fresh handoff')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, warnedA, () => false)

    return next(e)
  })

  on('command.run', { command: 'auto-handoff' }, async ($, e) => {
    const [cmd = '', arg = ''] = e.args.trim().split(/\s+/)
    const s = await read($, settingsA)

    if (cmd === 'on' || cmd === 'off') {
      await saveSettings($, { ...s, isOn: cmd === 'on' })
      return { text: `Auto-handoff ${cmd}.` }
    }
    if (cmd === 'hide' || cmd === 'show') {
      await saveSettings($, { ...s, isHidden: cmd === 'hide' })
      return { text: `Auto-handoff band ${cmd === 'hide' ? 'hidden' : 'shown'}.` }
    }
    if (cmd === 'mode') {
      if (arg !== 'auto' && arg !== 'ask') return { text: USAGE }
      await saveSettings($, { ...s, mode: arg })
      return { text: `Auto-handoff mode ${arg}.` }
    }
    if (cmd === 'threshold') {
      const n = Number(arg)
      if (!Number.isInteger(n) || n < 1 || n > 100) return { text: 'Threshold must be a whole number, 1 to 100.' }
      await saveSettings($, { ...s, threshold: n })
      return { text: `Auto-handoff threshold ${n}%.` }
    }
    if (cmd === 'now') {
      $.clock.after(0, () => runSave($))
      return { text: 'Saving a handoff.' }
    }
    if (cmd === 'resume') {
      $.clock.after(0, () => runResume($))
      return { text: 'Resuming from HANDOFF.md.' }
    }
    if (cmd === 'status') return { text: await summary($) }

    return { text: USAGE }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const s = await read($, settingsA)
    if (!s.isOn || s.isHidden) return below

    const { Box, Button, Text } = $.ui.resolve(e)
    const fill = await read($, fillA)
    const phase = await read($, phaseA)
    const savedAt = await read($, savedAtA)
    const stale = await read($, staleA)
    const now = await $.clock.now()
    const isDue = fill !== null && fill >= s.threshold
    const cells = fill === null ? null : bar(fill, 6)
    const showStale = stale !== null && phase === 'idle' && !isDue

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#0b0b0f" backgroundColor="#a78bfa"> ⇄ CONTEXT </Text>
          <Text color={fill === null ? '#a1a1aa' : toneOf(fill, s.threshold)}>
            {' ctx '}
            {cells ? cells.on : '—'}
            {cells && <Text color={TRACK}>{cells.off}</Text>}
            {'  '}
            {fill === null ? '' : `${Math.round(fill)}%`}
          </Text>
          <Text color={isDue ? '#ef4444' : undefined} dimColor={!isDue}>
            {'  · saves at '}
            {s.threshold}%
          </Text>
          {phase === 'saving' && <Text dimColor>{'  · saving…'}</Text>}
          {phase === 'saved' && savedAt !== null && (
            <Text color="#22c55e">{'  ✓ saved '}{clockTime(savedAt)}</Text>
          )}
          {phase === 'saved' && (
            <Box marginLeft={1}><Button key="clear" plain label="[clear & continue]" onPress={() => $.clock.after(0, () => runClear($))} /></Box>
          )}
          {showStale && (
            <Text dimColor>{'  from '}{agoShort(now - stale.mtimeMs)}{' ago: '}{stale.objective}</Text>
          )}
          {showStale && (
            <Box marginLeft={1}><Button key="resume" plain label="[resume]" onPress={() => $.clock.after(0, () => runResume($))} /></Box>
          )}
          {phase !== 'saving' && phase !== 'saved' && !showStale && (
            <Box marginLeft={1}><Button key="save" plain label="[save now]" onPress={() => $.clock.after(0, () => runSave($))} /></Box>
          )}
        </Box>
        {below}
      </Box>
    )
  })
}
