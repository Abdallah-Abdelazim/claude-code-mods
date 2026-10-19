import { atom, read, update } from 'claude-code'
import type { AgentSpawnInput, AgentSpawnResult, EngineInterface as Engine, Register } from 'claude-code'

import type { WatchAgent } from '../types'
import { CHIP_WIDTH, SKILL_COLOR, bandSegs, cut, markOf, modelColor, modelTag } from './layout'

const KEY = 'agent-watch'
const PANE = 'agent-watch'
const HELP = 'Usage: /agent-watch (opens the Agents pane) | on | off | clear | help'

const isOnA = atom({ plugin: 'agent-watch', key: 'isOn' } as const, true)
const agentsA = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const skillsA = atom({ plugin: 'agent-watch', key: 'skills' } as const, [])
const modelsA = atom({ plugin: 'agent-watch', key: 'models' } as const, {})
const timelineA = atom({ plugin: 'agent-watch', key: 'timeline' } as const, [])
const turnStartA = atom({ plugin: 'agent-watch', key: 'turnStart' } as const, null)
const activeA = atom({ plugin: 'agent-watch', key: 'active' } as const, 'main')
// Owned by recording-mode; while it is on, task text stays off screen.
const recA = atom({ plugin: 'recording-mode', key: 'mode' } as const, 'off')

async function shownAgents($: Engine) {
  const agents = await read($, agentsA)
  return (await read($, recA)) === 'off' ? agents : agents.map(a => ({ ...a, task: '' }))
}

const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`)

async function logEvent($: Engine, text: string) {
  const at = await $.clock.now()
  await update($, timelineA, t => [...t, { at, text }].slice(-60))
}

async function patch($: Engine, id: string, fn: (a: WatchAgent) => WatchAgent) {
  await update($, agentsA, rows => rows.map(r => (r.id === id ? fn(r) : r)))
}

async function loadOn($: Engine) {
  const raw = (await $.store.get(KEY)) as { isOn?: boolean } | null
  await update($, isOnA, () => raw?.isOn ?? true)
}

async function setOn($: Engine, isOn: boolean) {
  await $.store.set(KEY, { isOn })
  await update($, isOnA, () => isOn)
}

async function clearAll($: Engine) {
  await update($, agentsA, () => [])
  await update($, skillsA, () => [])
  await update($, modelsA, () => ({}))
  await update($, timelineA, () => [])
  await update($, turnStartA, () => null)
}

async function startTurn($: Engine, text: string) {
  const now = await $.clock.now()
  const main: WatchAgent = {
    id: 'main', parent: null, type: 'main', task: text.split('\n')[0] ?? '',
    model: null, status: 'running', steps: 0, calls: 0, tokens: 0, skills: [],
  }
  await clearAll($)
  await update($, agentsA, () => [main])
  await update($, turnStartA, () => now)
  await update($, activeA, () => 'main')
  await logEvent($, 'turn started')
}

async function recordSpawn($: Engine, e: AgentSpawnInput, r: AgentSpawnResult) {
  const parent = e.parentAgentId ?? 'main'
  const id = r.agentId ?? e.tool_use_id
  const task = e.description || e.prompt.split('\n')[0] || ''
  const row: WatchAgent = {
    id, parent, type: e.subagentType, task, model: r.model ?? null,
    status: r.deny === undefined ? 'running' : 'failed', steps: 0, calls: 0, tokens: 0, skills: [],
  }
  await update($, agentsA, rows => [...rows.filter(x => x.id !== id), row])
  await logEvent($, `${e.subagentType} ${r.deny === undefined ? 'started' : 'refused'}`)
}

async function recordStep($: Engine, agentId: string | undefined, model: string, tokens: number) {
  const id = agentId ?? 'main'
  await patch($, id, a => ({ ...a, model, steps: a.steps + 1, tokens: a.tokens + tokens }))
  await update($, modelsA, m => {
    const prev = m[model] ?? { steps: 0, tokens: 0 }
    return { ...m, [model]: { steps: prev.steps + 1, tokens: prev.tokens + tokens } }
  })
}

async function recordComplete($: Engine, agentId: string | undefined, isFailed: boolean) {
  const id = agentId ?? 'main'
  const status = isFailed ? 'failed' : 'done'
  const row = (await read($, agentsA)).find(a => a.id === id)
  await patch($, id, a => ({ ...a, status }))
  if (row) await logEvent($, `${row.type} ${status}`)
}

// A skill counts once per turn, under the agent that was running when it loaded.
async function recordSkill($: Engine, skill: string) {
  if ((await read($, skillsA)).includes(skill)) return
  const id = await read($, activeA)
  await update($, skillsA, s => [...s, skill])
  await patch($, id, a => ({ ...a, skills: [...a.skills, skill] }))
  await logEvent($, `skill ${skill}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-watch',
      description: 'Show which agents, models and skills are working this turn.',
      argumentHint: 'on | off | clear | help',
    })
    await loadOn($)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await startTurn($, e.text)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    await update($, activeA, () => e.agentId ?? 'main')
    const result = yield* next(e)
    const u = result.usage
    await recordStep($, e.agentId, u?.model ?? e.model, u ? u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0)

    return result
  })

  on('tool.call', async ($, e, next) => {
    await patch($, e.agentId ?? 'main', a => ({ ...a, calls: a.calls + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await recordSpawn($, e, result)

    return result
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    await recordSkill($, e.skill)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await recordComplete($, e.agentId, e.isAborted || 'refusal' in e)

    return next(e)
  })

  on('command.run', { command: 'agent-watch' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === '') {
      await $.ui.open({ id: PANE, title: 'Agents' })
      return { text: 'Agents pane opened.' }
    }
    if (arg === 'on' || arg === 'off') {
      await setOn($, arg === 'on')
      return { text: `Agent watch ${arg}.` }
    }
    if (arg === 'clear') {
      await clearAll($)
      return { text: 'Agent watch cleared.' }
    }

    return { text: HELP }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const agents = await shownAgents($)
    if (!(await read($, isOnA))) return below

    const { Box, Text } = $.ui.resolve(e)
    const segs =
      agents.length === 0
        ? [{ text: ' idle', dim: true }]
        : bandSegs(agents, await read($, skillsA), e.props.bodyColumns - CHIP_WIDTH)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#0b0b0f" backgroundColor="#bb9af7"> ◎ AGENTS  </Text>
          {segs.map(s => (
            <Text color={s.color} dimColor={s.dim}>{s.text}</Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const agents = await shownAgents($)
    const models = await read($, modelsA)
    const timeline = await read($, timelineA)
    const turnStart = await read($, turnStartA)

    const rows: { a: WatchAgent; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const a of agents.filter(x => x.parent === parent)) {
        rows.push({ a, depth })
        walk(a.id, depth + 1)
      }
    }
    walk(null, 0)

    return (
      <Box flexDirection="column">
        {agents.length === 0 && <Text dimColor>No agents yet this turn.</Text>}
        {rows.map(({ a, depth }) => {
          const pad = '  '.repeat(depth)
          const mark = markOf(a.status)
          return (
            <Box flexDirection="column">
              <Text bold>{pad}{a.type} — {a.task || 'no task'} <Text color={mark.color}>{mark.text}</Text></Text>
              <Text dimColor>
                {pad}{'  '}{modelTag(a.model).label} · {a.steps} steps · {a.calls} calls · {fmtTokens(a.tokens)} tokens
                {a.skills.length ? ` · skills: ${a.skills.join(', ')}` : ''}
              </Text>
            </Box>
          )
        })}
        {Object.keys(models).length > 0 && <Text bold>Models</Text>}
        {Object.entries(models).map(([id, m]) => (
          <Text color={modelColor(id)}>{'  '}{modelTag(id).label}{'  '}{m.steps} steps · {fmtTokens(m.tokens)} tokens</Text>
        ))}
        {e.surface === 'terminal' && timeline.length > 0 && <Text bold>Timeline</Text>}
        {e.surface === 'terminal' &&
          timeline.slice(-12).map(t => {
            const s = Math.max(0, Math.round((t.at - (turnStart ?? t.at)) / 1000))
            return <Text dimColor>{'  '}+{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')} {cut(t.text, 60)}</Text>
          })}
      </Box>
    )
  })
}
