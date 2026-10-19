import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register, SessionMeasureInput, SessionRateLimit } from 'claude-code'

import type { Limit } from '../types'
import { bar, countdown, outIn, resetText, shortName, titleName, toneOf } from './format'

const KEY = 'usage-gauge'
const PANE = 'usage-gauge'
const USAGE = 'Usage: /usage-gauge | on | off | warn <low> <high> | status'
const TICK_MS = 30_000

const isOnA = atom({ plugin: 'usage-gauge', key: 'isOn' } as const, true)
const limitsA = atom({ plugin: 'usage-gauge', key: 'limits' } as const, [] as Limit[])
const contextA = atom({ plugin: 'usage-gauge', key: 'context' } as const, null)
const costA = atom({ plugin: 'usage-gauge', key: 'cost' } as const, null)
const turnBaseA = atom({ plugin: 'usage-gauge', key: 'turnBase' } as const, null)
const thresholdsA = atom({ plugin: 'usage-gauge', key: 'thresholds' } as const, { low: 75, high: 90 })
const notifiedA = atom({ plugin: 'usage-gauge', key: 'notified' } as const, {})
const paceA = atom({ plugin: 'usage-gauge', key: 'pace' } as const, null)

const toLimits = (list: readonly SessionRateLimit[]): Limit[] =>
  list.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt ?? null }))

async function load($: Engine) {
  const saved = (await $.store.get(KEY)) as { isOn?: boolean; low?: number; high?: number } | null
  await update($, isOnA, () => saved?.isOn ?? true)
  await update($, thresholdsA, t => ({ low: saved?.low ?? t.low, high: saved?.high ?? t.high }))
}

async function save($: Engine) {
  const { low, high } = await read($, thresholdsA)
  await $.store.set(KEY, { isOn: await read($, isOnA), low, high })
}

async function seed($: Engine) {
  const usage = await $.session.usage().catch(() => null)
  if (!usage) return
  await update($, limitsA, () => toLimits(usage.rateLimits))
  await update($, contextA, () => usage.context.percent ?? null)
  await update($, costA, () => usage.cost?.usd ?? null)
}

async function record($: Engine, e: SessionMeasureInput) {
  const now = await $.clock.now()
  const limits = toLimits(e.rateLimits)
  await update($, limitsA, () => limits)
  await update($, contextA, () => e.context.percent ?? null)
  const usd = e.cost?.usd
  if (usd !== undefined) await update($, costA, () => usd)

  const five = limits.find(l => l.kind === 'five_hour')
  const fiveReset = five?.resetsAt
  if (five && fiveReset) {
    const pace = await read($, paceA)
    if (pace?.resetsAt !== fiveReset) {
      await update($, paceA, () => ({ at: now, percent: five.percent, resetsAt: fiveReset }))
    }
  }

  const { low, high } = await read($, thresholdsA)
  const isOn = await read($, isOnA)
  for (const l of limits) {
    const level = l.percent >= high ? high : l.percent >= low ? low : null
    const prev = (await read($, notifiedA))[l.kind]
    if (level === null || (prev && prev.resetsAt === l.resetsAt && prev.level >= level)) continue
    await update($, notifiedA, n => ({ ...n, [l.kind]: { resetsAt: l.resetsAt, level } }))
    if (!isOn) continue
    const when = resetText(l.kind, l.resetsAt, now)
    const reset = when ? ` — resets ${l.kind === 'five_hour' ? 'in ' : ''}${when}` : ''
    $.ui.toast(`${titleName(l.kind)} limit at ${level}%${reset}`)
  }
}

async function startTurn($: Engine) {
  const cost = await read($, costA)
  await update($, turnBaseA, () => cost)
}

async function summary($: Engine) {
  const limits = await read($, limitsA)
  const context = await read($, contextA)
  const cost = await read($, costA)
  const { low, high } = await read($, thresholdsA)
  const now = await $.clock.now()
  const lines = limits.map(
    l => `${shortName(l.kind)} ${Math.round(l.percent)}%${l.resetsAt ? ` · resets ${resetText(l.kind, l.resetsAt, now)}` : ''}`,
  )
  if (context !== null) lines.push(`context ${Math.round(context)}%`)
  if (cost !== null) lines.push(`session $${cost.toFixed(2)}`)
  if (lines.length === 0) lines.push('No usage data yet.')
  lines.push(`toasts at ${low}% and ${high}%`)
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-gauge',
      description: 'Show plan usage, reset times and session cost.',
      argumentHint: 'on | off | warn <low> <high> | status',
    })
    await load($)
    await seed($)
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await record($, e)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await startTurn($)

    return next(e)
  })

  on('command.run', { command: 'usage-gauge' }, async ($, e) => {
    const [cmd = '', a = '', b = ''] = e.args.trim().split(/\s+/)
    if (cmd === '') {
      await $.ui.open({ id: PANE, title: 'Usage' })
      return { text: 'Usage pane opened.' }
    }
    if (cmd === 'on' || cmd === 'off') {
      await update($, isOnA, () => cmd === 'on')
      await save($)
      return { text: `Usage gauge ${cmd}.` }
    }
    if (cmd === 'warn') {
      const low = Number(a)
      const high = Number(b)
      if (!(Number.isInteger(low) && Number.isInteger(high) && low >= 1 && low < high && high <= 100)) {
        return { text: 'Usage: /usage-gauge warn <low> <high>, whole numbers 1 to 100, low below high.' }
      }
      await update($, thresholdsA, () => ({ low, high }))
      await save($)
      return { text: `Toasts at ${low}% and ${high}%.` }
    }
    if (cmd === 'status') return { text: await summary($) }

    return { text: USAGE }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!(await read($, isOnA))) return below

    const { Box, Text } = $.ui.resolve(e)
    const limits = await read($, limitsA)
    const context = await read($, contextA)
    const cost = await read($, costA)
    const base = await read($, turnBaseA)
    const pace = await read($, paceA)
    const now = await $.clock.now()
    const five = limits.find(l => l.kind === 'five_hour')
    const out = five && pace ? outIn(pace, five.percent, now) : null
    const delta = cost !== null && base !== null ? Math.max(0, cost - base) : null

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#0b0b0f" backgroundColor="#60a5fa"> ◔ PLAN </Text>
          {limits.map((l, i) => (
            <Text color={toneOf(l.percent)}>
              {i ? '  │ ' : '  '}
              {shortName(l.kind)} {bar(l.percent, 6)}{'  '}{Math.round(l.percent)}%
              {l.resetsAt ? ` ↻${resetText(l.kind, l.resetsAt, now)}` : ''}
            </Text>
          ))}
          {out !== null && <Text color="#f59e0b">{'  ⚠ at this pace: out in '}{countdown(out)}</Text>}
          {limits.length === 0 && context !== null && (
            <Text color={toneOf(context)}>{'  context '}{bar(context, 6)}{'  '}{Math.round(context)}%</Text>
          )}
          {cost !== null && (
            <Text dimColor>
              {'  │ session $'}
              {cost.toFixed(2)}
              {delta !== null ? ` (+$${delta.toFixed(2)})` : ''}
            </Text>
          )}
          {limits.length === 0 && context === null && cost === null && (
            <Text dimColor>{'  no usage data yet'}</Text>
          )}
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const limits = await read($, limitsA)
    const context = await read($, contextA)
    const cost = await read($, costA)
    const base = await read($, turnBaseA)
    const now = await $.clock.now()
    const cells = Math.max(10, Math.min(60, e.props.bodyColumns - 34))
    const delta = cost !== null && base !== null ? Math.max(0, cost - base) : null

    return (
      <Box flexDirection="column">
        {limits.map(l => (
          <Text color={toneOf(l.percent)}>
            {shortName(l.kind).padEnd(7)} {bar(l.percent, cells)}{'  '}{Math.round(l.percent)}%
            {l.resetsAt ? `  ↻ ${resetText(l.kind, l.resetsAt, now)}` : ''}
          </Text>
        ))}
        {context !== null && (
          <Text color={toneOf(context)}>
            {'context'.padEnd(7)} {bar(context, cells)}{'  '}{Math.round(context)}%
          </Text>
        )}
        {cost !== null && (
          <Text dimColor>
            {'session'.padEnd(7)} ${cost.toFixed(2)}
            {delta !== null ? ` (+$${delta.toFixed(2)})` : ''}
          </Text>
        )}
        {limits.length === 0 && context === null && cost === null && (
          <Text dimColor>No usage data yet.</Text>
        )}
      </Box>
    )
  })
}
