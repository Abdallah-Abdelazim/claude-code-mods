import type { WatchAgent } from '../types'

export type Seg = { text: string; color?: string; dim?: boolean }

const MODEL_COLOR: Record<string, string> = {
  fable: '#d16bff',
  opus: '#ff8c1a',
  sonnet: '#3d9bff',
  haiku: '#19c3a6',
}
const MARK = { running: '⟳', done: '✓', failed: '✗' } as const
const MARK_COLOR = { running: '#f59e0b', done: '#22c55e', failed: '#ef4444' } as const
export const SKILL_COLOR = '#a3e635'
export const CHIP_WIDTH = 11 // " ◎ AGENTS  ", every band chip is 11 cells

// claude-opus-5-5 -> opus·5.5; a dated id keeps only the version.
export function modelTag(id: string | null) {
  if (!id) return { family: '?', label: '?' }
  const m = /(fable|opus|sonnet|haiku)(?:-(\d+)(?:-(\d{1,2}))?)?/.exec(id)
  if (!m) return { family: id, label: id }
  const ver = m[2] ? (m[3] ? `${m[2]}.${m[3]}` : m[2]) : ''
  return { family: m[1] ?? id, label: ver ? `${m[1]}·${ver}` : (m[1] ?? id) }
}

export const modelColor = (id: string | null) => MODEL_COLOR[modelTag(id).family]
export const markOf = (s: WatchAgent['status']) => ({ text: MARK[s], color: MARK_COLOR[s] })

export const cut = (task: string, max = 22) => (task.length > max ? `${task.slice(0, max - 1)}…` : task)

function agentSegs(a: WatchAgent, showTask: boolean): Seg[] {
  const tag = modelTag(a.model)
  const mark = markOf(a.status)
  const segs: Seg[] = [{ text: a.type }, { text: ` ${tag.label}`, color: MODEL_COLOR[tag.family] }]
  if (showTask && a.task && a.id !== 'main') segs.push({ text: ` "${cut(a.task)}"`, dim: true })
  segs.push({ text: ` ${mark.text}`, color: mark.color })
  return segs
}

const width = (segs: Seg[]) => segs.reduce((n, s) => n + s.text.length, 0)

// Too wide: drop task text from the oldest helpers, then fold the newest into "+N more",
// then trim skills. The first helper's task and one skill always stay.
export function bandSegs(agents: WatchAgent[], skills: string[], avail: number): Seg[] {
  const [main, ...helpers] = agents
  if (!main) return []
  const keep = Math.max(0, helpers.findIndex(h => h.task))
  const showTask = helpers.map(() => true)
  let hidden = 0
  let nSkills = skills.length

  const build = () => {
    const segs = agentSegs(main, false).map((s, i) => (i === 0 ? { ...s, text: ` ${s.text}` } : s))
    helpers.slice(0, helpers.length - hidden).forEach((h, i) => {
      segs.push({ text: i === 0 ? ' │ ' : ' · ', dim: true }, ...agentSegs(h, showTask[i] ?? false))
    })
    if (hidden) segs.push({ text: ` +${hidden} more`, dim: true })
    if (skills.length) {
      segs.push({ text: ' │ skills:', dim: true })
      skills.slice(0, nSkills).forEach(s => segs.push({ text: ` ${s}`, color: SKILL_COLOR }))
      if (nSkills < skills.length) segs.push({ text: ` +${skills.length - nSkills}`, dim: true })
    }
    return segs
  }

  let segs = build()
  while (width(segs) > avail) {
    const i = showTask.findIndex((s, j) => s && j !== keep)
    if (i >= 0) showTask[i] = false
    else if (helpers.length - hidden - 1 > keep) hidden += 1
    else if (nSkills > 1) nSkills -= 1
    else break
    segs = build()
  }
  return segs
}
