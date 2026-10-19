export type RecMode = 'off' | 'on' | 'strict'

declare module 'claude-code' {
  interface PluginState {
    'recording-mode': { mode: RecMode }
  }
}
