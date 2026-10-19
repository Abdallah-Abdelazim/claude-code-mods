import type { CacheStep } from '../types'

// List prices in $ per million tokens, fetched 2026-10-19 from platform.claude.com/docs/en/about-claude/pricing.
// Cache writes: 5-minute 1.25x base input, 1-hour 2x; reads: per row.
type Price = { input: number; write5m: number; write1h: number; read: number }

const PRICES: Record<string, Price & { over100k?: Price }> = {
  'claude-fable-5-1': { input: 10, write5m: 12.5, write1h: 20, read: 0.25 },
  'claude-mythos-5-1': { input: 10, write5m: 12.5, write1h: 20, read: 0.25 },
  'claude-fable-5': { input: 10, write5m: 12.5, write1h: 20, read: 1 },
  'claude-opus-5-5': { input: 4, write5m: 5, write1h: 8, read: 0.2 },
  'claude-opus-5': { input: 5, write5m: 6.25, write1h: 10, read: 0.5 },
  'claude-opus-4-8': { input: 5, write5m: 6.25, write1h: 10, read: 0.5 },
  'claude-opus-4-7': { input: 5, write5m: 6.25, write1h: 10, read: 0.5 },
  'claude-opus-4-6': { input: 5, write5m: 6.25, write1h: 10, read: 0.5 },
  'claude-sonnet-5-5': { input: 2, write5m: 2.5, write1h: 4, read: 0.1 },
  'claude-sonnet-5': { input: 2, write5m: 2.5, write1h: 4, read: 0.2 },
  'claude-sonnet-4-6': { input: 3, write5m: 3.75, write1h: 6, read: 0.3 },
  'claude-haiku-5-5': {
    input: 0.1, write5m: 0.125, write1h: 0.2, read: 0.01,
    over100k: { input: 0.5, write5m: 0.625, write1h: 1, read: 0.05 },
  },
  'claude-haiku-4-5': { input: 1, write5m: 1.25, write1h: 2, read: 0.1 },
}

export const promptOf = (s: CacheStep) => s.reads + s.writes + s.fresh

// Undefined for a model not in the table: the caller shows "≈ ?".
function priceFor(s: CacheStep): Price | undefined {
  const row = PRICES[s.model.replace(/-\d{8}$/, '')]
  return row?.over100k && promptOf(s) > 100_000 ? row.over100k : row
}

export function savedUsd(s: CacheStep): number | undefined {
  const p = priceFor(s)
  return p && (s.reads * (p.input - p.read)) / 1e6
}

export function rewriteUsd(s: CacheStep, ttlMinutes: number): number | undefined {
  const p = priceFor(s)
  return p && ((s.reads + s.writes) * (ttlMinutes === 5 ? p.write5m : p.write1h)) / 1e6
}

export const cachedOf = (s: CacheStep) => s.reads + s.writes

export const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

export const fmtUsd = (usd: number | undefined) => (usd === undefined ? '≈ ?' : `≈ $${usd.toFixed(2)}`)
