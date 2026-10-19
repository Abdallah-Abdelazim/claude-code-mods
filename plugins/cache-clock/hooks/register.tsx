import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { CacheStep } from '../types'
import { cachedOf, fmtTokens, fmtUsd, promptOf, rewriteUsd, savedUsd } from './prices'

const lastCacheAt = atom({ plugin: 'cache-clock', key: 'lastCacheAt' } as const, null)
const lastStep = atom({ plugin: 'cache-clock', key: 'lastStep' } as const, null)
const totals = atom({ plugin: 'cache-clock', key: 'totals' } as const, {
  reads: 0, writes: 0, fresh: 0, savedUsd: 0, isUnpriced: false,
})
const warnedFor = atom({ plugin: 'cache-clock', key: 'warnedFor' } as const, null)
const isOn = atom({ plugin: 'cache-clock', key: 'isOn' } as const, true)

const TICK_MS = 30_000
const KEY = 'cache-clock'
// Both windows shrink with the cache lifetime, so a 5-minute cache is not "amber" or "about to expire" from the start.
const amberMs = (ttlMs: number) => ttlMs / 4
const warnMs = (ttlMs: number) => Math.min(5 * 60_000, ttlMs / 5)
const BAR = 6

// Ms until the cache goes cold; 0 when cold or no main request has cached yet.
const remaining = async ($: Engine, ttlMs: number) => {
  const at = await read($, lastCacheAt)
  return at === null ? 0 : at + ttlMs - (await $.clock.now())
}

const compact = async ($: Engine) => {
  const r = await $.session.compact()
  $.ui.toast('skip' in r ? `Compact skipped: ${r.skip}` : `Compacted: ${r.messages.length} messages kept.`)
}

const tick = async ($: Engine, ttl: number) => {
  const at = await read($, lastCacheAt)
  const step = await read($, lastStep)
  const ttlMs = ttl * 60_000
  const left = await remaining($, ttlMs)
  if (
    at !== null && step !== null && (await read($, isOn)) &&
    left > 0 && left <= warnMs(ttlMs) && (await read($, warnedFor)) !== at
  ) {
    await update($, warnedFor, () => at)
    $.ui.toast(
      `Cache: ${fmtTokens(cachedOf(step))} tokens, cold rewrite ${fmtUsd(rewriteUsd(step, ttl))}. Send anything to keep it warm.`,
    )
  }
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  const ttl = options.cacheMinutes === '5' ? 5 : 60
  const ttlMs = ttl * 60_000

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cache-clock',
      description: 'Show or toggle the prompt-cache clock.',
      argumentHint: 'on | off | status',
    })
    const saved = (await $.store.get(KEY)) as { isOn?: boolean } | null
    await update($, isOn, () => saved?.isOn ?? true)
    $.clock.every(TICK_MS, () => tick($, ttl))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    const u = result.usage
    if (u) {
      const step: CacheStep = {
        model: u.model,
        reads: u.cache_read_input_tokens,
        writes: u.cache_creation_input_tokens,
        fresh: u.input_tokens,
      }
      const saved = savedUsd(step)
      await update($, totals, t => ({
        reads: t.reads + step.reads,
        writes: t.writes + step.writes,
        fresh: t.fresh + step.fresh,
        savedUsd: t.savedUsd + (saved ?? 0),
        isUnpriced: t.isUnpriced || saved === undefined,
      }))
      if (e.agentId === undefined) {
        await update($, lastStep, () => step)
        if (cachedOf(step) > 0) await update($, lastCacheAt, () => startedAt)
      }
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!(await read($, isOn))) return below

    const { Box, Button, Text } = $.ui.resolve(e)
    const step = await read($, lastStep)
    const left = await remaining($, ttlMs)
    const isCold = left <= 0
    const tone = isCold ? '#ef4444' : left <= amberMs(ttlMs) ? '#f59e0b' : '#22c55e'
    const filled = Math.max(0, Math.min(BAR, Math.round((BAR * left) / ttlMs)))
    const bar = '▰'.repeat(filled) + '▱'.repeat(BAR - filled)
    const state = isCold ? 'COLD' : `warm ${Math.ceil(left / 60_000)}m`
    const reuse =
      step && promptOf(step) > 0 ? `${Math.round((100 * step.reads) / promptOf(step))}% reused` : 'no request yet'
    const cached = step ? fmtTokens(cachedOf(step)) : '0'
    const rewrite = step ? fmtUsd(rewriteUsd(step, ttl)) : '—'

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#0b0b0f" backgroundColor="#22d3ee"> ● CACHE </Text>
          <Text color={tone}> {state} {bar}</Text>
          <Text dimColor>{'  '}{reuse} · {cached} cached · cold rewrite {rewrite} </Text>
          <Button key="compact" plain label="[Compact]" onPress={() => compact($)} />
        </Box>
        {below}
      </Box>
    )
  })

  on('command.run', { command: 'cache-clock' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await $.store.set(KEY, { isOn: arg === 'on' })
      await update($, isOn, () => arg === 'on')
      return { text: `Cache clock ${arg}.` }
    }
    if (arg !== 'status') return { text: 'Usage: /cache-clock on | off | status' }
    const t = await read($, totals)
    const seen = t.reads + t.writes + t.fresh
    const pct = seen ? Math.round((100 * t.reads) / seen) : 0
    return {
      text:
        `Reads ${fmtTokens(t.reads)} · writes ${fmtTokens(t.writes)} · ${pct}% reused\n` +
        `Estimated saved ${fmtUsd(t.isUnpriced ? undefined : t.savedUsd)} (list prices, estimate)`,
    }
  })
}
