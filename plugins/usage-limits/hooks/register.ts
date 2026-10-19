import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { line } from './format'

const text = atom({ plugin: 'usage-limits', key: 'text' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const latest = line((await $.session.usage()).rateLimits) ?? null
    await update($, text, () => latest)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, text, () => line(e.rateLimits) ?? null)

    return next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const current = await read($, text)

    return next(current ? { ...e, props: { ...e.props, modes: [...e.props.modes, current] } } : e)
  })
}
