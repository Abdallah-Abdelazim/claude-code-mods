import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { GoalRecord, GoalState, GoalTask } from '../types'
import { AMBER, GREEN, SHOW_DONE_MS, TRACK, bar, firstLine, fmtMin, stats, taskTime } from './format'

const KEY = 'goal-meter'
const HISTORY_KEY = 'goal-meter.history'
const PANE = 'goal-meter'
const HELP = 'Usage: /goals (opens the Goals pane) | on | off | clear | help'

type Todo = { content: string; status: GoalTask['status']; activeForm: string }

const isOnA = atom({ plugin: 'goal-meter', key: 'isOn' } as const, true)
const goalA = atom({ plugin: 'goal-meter', key: 'goal' } as const, null)
const nextNameA = atom({ plugin: 'goal-meter', key: 'nextName' } as const, null)
const promptAtA = atom({ plugin: 'goal-meter', key: 'promptAt' } as const, null)
const historyA = atom({ plugin: 'goal-meter', key: 'history' } as const, [])
// Owned by recording-mode; while it is on, goal text stays off screen.
const recA = atom({ plugin: 'recording-mode', key: 'mode' } as const, 'off')

async function load($: Engine) {
  const settings = (await $.store.get(KEY)) as { isOn?: boolean } | null
  const history = (await $.store.get(HISTORY_KEY)) as GoalRecord[] | null
  await update($, isOnA, () => settings?.isOn ?? true)
  await update($, historyA, () => history ?? [])
}

async function setOn($: Engine, isOn: boolean) {
  await $.store.set(KEY, { isOn })
  await update($, isOnA, () => isOn)
}

async function clearAll($: Engine) {
  await $.store.set(HISTORY_KEY, [])
  await update($, historyA, () => [])
  await update($, goalA, () => null)
}

async function notePrompt($: Engine, text: string) {
  const name = firstLine(text)
  if (!name) return
  await update($, nextNameA, () => name)
  const at = await $.clock.now()
  await update($, promptAtA, () => at)
}

const stamp = (status: GoalTask['status'], old: GoalTask | undefined, now: number) => ({
  startedAt: status === 'pending' ? null : (old?.startedAt ?? now),
  endedAt: status === 'completed' ? (old?.endedAt ?? now) : null,
})

async function recordTodos($: Engine, todos: readonly Todo[]) {
  await commitTasks($, (prev, now) =>
    todos.map(t => ({
      id: null,
      content: t.content,
      activeForm: t.activeForm,
      status: t.status,
      ...stamp(t.status, prev.find(p => p.content === t.content), now),
    })),
  )
}

async function recordTaskCreate($: Engine, id: string, subject: string, activeForm: string | undefined) {
  await commitTasks($, prev => [
    ...prev.filter(p => p.id !== id),
    { id, content: subject, activeForm: activeForm ?? subject, status: 'pending', startedAt: null, endedAt: null },
  ])
}

type TaskPatch = { status?: GoalTask['status'] | 'deleted'; subject?: string; activeForm?: string }

async function recordTaskUpdate($: Engine, id: string, patch: TaskPatch) {
  await commitTasks($, (prev, now) =>
    prev.flatMap(p => {
      if (p.id !== id) return [p]
      if (patch.status === 'deleted') return []
      const status = patch.status ?? p.status
      return [{ ...p, content: patch.subject ?? p.content, activeForm: patch.activeForm ?? p.activeForm, status, ...stamp(status, p, now) }]
    }),
  )
}

async function commitTasks($: Engine, build: (prev: GoalTask[], now: number) => GoalTask[]) {
  const now = await $.clock.now()
  const current = await read($, goalA)
  let goal = current && current.doneAt === null ? current : null
  let tasks = build(goal?.tasks ?? [], now)
  const promptAt = await read($, promptAtA)
  // A prompt sent since the goal began, with a task list that shares nothing with it, is a new goal.
  if (goal && promptAt !== null && promptAt > goal.startedAt && !tasks.some(t => goal?.tasks.some(p => p.content === t.content))) {
    goal = null
    tasks = build([], now)
  }
  if (tasks.length === 0) return
  const isDone = tasks.length > 0 && tasks.every(t => t.status === 'completed')
  const next: GoalState = {
    name: goal?.name ?? (await read($, nextNameA)) ?? 'goal',
    startedAt: goal?.startedAt ?? promptAt ?? now,
    tasks,
    doneAt: isDone ? now : null,
  }
  await update($, goalA, () => next)
  if (!isDone) return

  const mins = fmtMin(now - next.startedAt)
  const record: GoalRecord = { name: next.name, tasks: tasks.length, ms: now - next.startedAt, at: now }
  const history = [record, ...(await read($, historyA))].slice(0, 5)
  await update($, historyA, () => history)
  await $.store.set(HISTORY_KEY, history)
  $.ui.toast(`Goal done in ${mins} — ${tasks.length} tasks`)
  $.clock.after(SHOW_DONE_MS, () => $.ui.invalidate('ui.render'))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'goals',
      description: 'Show the current goal and the last five.',
      argumentHint: 'on | off | clear | help',
    })
    await load($)
    $.clock.every(30_000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command === undefined) await notePrompt($, e.text)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
      await recordTodos($, e.todos)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
      await recordTaskCreate($, ran.result.task.id, e.subject, e.activeForm)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
      await recordTaskUpdate($, e.taskId, { status: e.status, subject: e.subject, activeForm: e.activeForm })
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'goals' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === '') {
      await $.ui.open({ id: PANE, title: 'Goals' })
      return { text: 'Goals pane opened.' }
    }
    if (arg === 'on' || arg === 'off') {
      await setOn($, arg === 'on')
      return { text: `Goal meter ${arg}.` }
    }
    if (arg === 'clear') {
      await clearAll($)
      return { text: 'Goal meter cleared.' }
    }

    return { text: HELP }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const goal = await read($, goalA)
    const now = await $.clock.now()
    const isDone = goal?.doneAt != null
    if (!(await read($, isOnA))) return below

    const { Box, Text } = $.ui.resolve(e)
    const isHidden = (await read($, recA)) !== 'off'
    if (!goal || goal.tasks.length === 0 || (isDone && now - (goal.doneAt ?? now) >= SHOW_DONE_MS)) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text bold color="#0b0b0f" backgroundColor="#facc15"> ◆ GOAL </Text>
            <Text dimColor>{' idle, no task list yet'}</Text>
          </Box>
          {below}
        </Box>
      )
    }
    const s = stats(goal, now)
    const tone = s.isSlow ? AMBER : GREEN
    const cells = bar(s.pct)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="#0b0b0f" backgroundColor="#facc15"> ◆ GOAL </Text>
          <Text>{` ${isHidden ? 'goal' : goal.name}`}</Text>
          <Text color={isDone ? GREEN : tone}>{'  '}{cells.on}<Text color={TRACK}>{cells.off}</Text></Text>
          {isDone ? (
            <Text color={GREEN}>{'  done ✓ in '}{fmtMin((goal.doneAt ?? now) - goal.startedAt)}</Text>
          ) : (
            <Text>{`  ${s.done}/${s.total} · ${s.pct}% · ${fmtMin(now - goal.startedAt)}`}</Text>
          )}
          {!isDone && s.eta !== null && <Text dimColor>{'  ETA ~'}{fmtMin(s.eta)}</Text>}
          {!isDone && s.running && !isHidden && <Text dimColor>{'  │ ▶ '}{s.running.activeForm || s.running.content}</Text>}
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const goal = await read($, goalA)
    const history = await read($, historyA)
    const now = await $.clock.now()
    const isHidden = (await read($, recA)) !== 'off'
    const mask = (text: string) => (isHidden ? '•••' : text)

    return (
      <Box flexDirection="column">
        <Text bold>{goal ? mask(goal.name) : 'No goal yet.'}</Text>
        {goal?.tasks.map(t => (
          <Text dimColor={t.status === 'pending'} color={t.status === 'in_progress' ? AMBER : t.status === 'completed' ? GREEN : undefined}>
            {t.status === 'in_progress' ? '▶' : t.status === 'completed' ? '✓' : '○'} {mask(t.content)}
            {taskTime(t, now) ? `  ${taskTime(t, now)}` : ''}
          </Text>
        ))}
        {history.length > 0 && <Text bold>Last goals</Text>}
        {history.map(h => (
          <Text dimColor>{'  '}{mask(h.name)} — {h.tasks} tasks · {fmtMin(h.ms)}</Text>
        ))}
      </Box>
    )
  })
}
