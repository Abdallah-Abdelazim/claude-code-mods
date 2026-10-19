export type Limit = { kind: string; percent: number; resetsAt: string | null }
export type Notice = { resetsAt: string | null; level: number }
export type Pace = { at: number; percent: number; resetsAt: string }

declare module 'claude-code' {
  interface PluginState {
    'usage-gauge': {
      isOn: boolean
      limits: Limit[]
      context: number | null
      cost: number | null
      turnBase: number | null
      thresholds: { low: number; high: number }
      notified: Record<string, Notice>
      pace: Pace | null
    }
  }
}
