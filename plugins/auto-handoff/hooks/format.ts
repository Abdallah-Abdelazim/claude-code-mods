export const FILE = 'HANDOFF.md'
export const RESUME_PROMPT = 'Read HANDOFF.md in this folder and continue from its exact next step.'

export const handoffPrompt = (path: string) =>
  [
    `Write the handoff file ${path} now, overwriting it, with these sections in this order:`,
    '# Handoff',
    '## Objective',
    'One line: what this chat is for.',
    '## Done',
    '## In progress',
    '## Next',
    '## Decisions',
    'Each decision, and why.',
    '## Open questions',
    '## Exact next step',
    'One sentence a fresh session can act on.',
    'Write only the file. Do not continue the task.',
  ].join('\n')

// Green under 60%, amber from 60 up to the threshold, red at or over it.
export const toneOf = (fill: number, threshold: number) =>
  fill >= threshold ? '#ef4444' : fill >= 60 ? '#f59e0b' : '#22c55e'

// The empty part is the same block in TRACK gray, drawn as its own Text run.
export const TRACK = '#52525b'

export function bar(pct: number, cells: number) {
  const on = Math.max(0, Math.min(cells, Math.round((cells * pct) / 100)))
  return { on: '▆'.repeat(on), off: '▆'.repeat(cells - on) }
}

export function clockTime(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const minutesOf = (ms: number) => Math.max(0, Math.floor(ms / 60_000))

export function agoShort(ms: number) {
  const m = minutesOf(ms)
  if (m >= 1440) return `${Math.floor(m / 1440)}d`
  if (m >= 60) return `${Math.floor(m / 60)}h`
  return `${m}m`
}

export function agoLong(ms: number) {
  const m = minutesOf(ms)
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`
  if (m >= 1440) return unit(Math.floor(m / 1440), 'day')
  if (m >= 60) return unit(Math.floor(m / 60), 'hour')
  return unit(m, 'minute')
}

// The line under "## Objective"; for a file written some other way, the first prose line.
export function firstObjective(text: string) {
  const lines = text.split('\n').map(l => l.trim())
  const at = lines.findIndex(l => /^##\s*objective/i.test(l))
  const body = at >= 0 ? lines.slice(at + 1) : lines
  const line = body.find(l => l !== '' && !l.startsWith('#')) ?? 'no objective'
  return line.length > 60 ? `${line.slice(0, 59)}…` : line
}
