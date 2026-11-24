import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { Limit } from '../types'
import { line } from './format'

const TICK_MS = 30_000

const limitsA = atom({ plugin: 'usage-limits', key: 'limits' } as const, [] as Limit[])

const toLimits = (list: readonly SessionRateLimit[]): Limit[] =>
  list.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt ?? null }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const latest = (await $.session.usage().catch(() => null))?.rateLimits ?? []
    await update($, limitsA, () => toLimits(latest))
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, limitsA, () => toLimits(e.rateLimits))

    return next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const current = line(await read($, limitsA), await $.clock.now())

    return next(current ? { ...e, props: { ...e.props, modes: [...e.props.modes, current] } } : e)
  })
}
