export type WatchStatus = 'running' | 'done' | 'failed'
export type WatchAgent = {
  id: string
  parent: string | null
  type: string
  task: string
  model: string | null
  status: WatchStatus
  steps: number
  calls: number
  tokens: number
  skills: string[]
}
export type WatchModel = { steps: number; tokens: number }
export type WatchEvent = { at: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    'recording-mode': { mode: 'off' | 'on' | 'strict' }
    'agent-watch': {
      isOn: boolean
      agents: WatchAgent[]
      skills: string[]
      models: Record<string, WatchModel>
      timeline: WatchEvent[]
      turnStart: number | null
      active: string
    }
  }
}
