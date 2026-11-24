export type Limit = { kind: string; percentUsed: number; resetsAt?: string | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-limits': { limits: Limit[] }
  }
}
