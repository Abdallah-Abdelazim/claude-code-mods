export type LimitsText = string | null

declare module 'claude-code' {
  interface PluginState {
    'usage-limits': { text: LimitsText }
  }
}
