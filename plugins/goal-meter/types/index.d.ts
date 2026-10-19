export type GoalTask = {
  id: string | null
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed'
  startedAt: number | null
  endedAt: number | null
}
export type GoalState = { name: string; startedAt: number; tasks: GoalTask[]; doneAt: number | null }
export type GoalRecord = { name: string; tasks: number; ms: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'goal-meter': {
      isOn: boolean
      goal: GoalState | null
      nextName: string | null
      promptAt: number | null
      history: GoalRecord[]
    }
  }
}
