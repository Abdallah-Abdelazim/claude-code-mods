export type CacheStep = { model: string; reads: number; writes: number; fresh: number }
export type CacheTotals = { reads: number; writes: number; fresh: number; savedUsd: number; isUnpriced: boolean }

declare module 'claude-code' {
  interface PluginState {
    'cache-clock': {
      lastCacheAt: number | null
      lastStep: CacheStep | null
      totals: CacheTotals
      warnedFor: number | null
      isOn: boolean
    }
  }
}
