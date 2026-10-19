export type HandoffSettings = { isOn: boolean; threshold: number; mode: 'auto' | 'ask'; isHidden: boolean }
export type HandoffPhase = 'idle' | 'due' | 'saving' | 'saved'
export type HandoffStale = { objective: string; mtimeMs: number }

declare module 'claude-code' {
  interface PluginState {
    'auto-handoff': {
      settings: HandoffSettings
      fill: number | null
      phase: HandoffPhase
      savingSince: number | null
      savedAt: number | null
      warned: boolean
      stale: HandoffStale | null
      seenMtime: number | null
    }
  }
}
