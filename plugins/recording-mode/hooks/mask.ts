export type MaskConfig = { strict: boolean; words: readonly string[] }

const KEYS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/g,
]
// A line like `export API_TOKEN=abc` keeps its name and loses its value.
const SECRET_ENV = /^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)[A-Za-z0-9_]*\s*[=:]\s*)(?!\[key\])\S.*$/gim
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// Phones need a + or separators, so bare numbers, hashes and code stay alone.
const PHONES = [/\+\d[\d\s().-]{7,}\d/g, /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g, /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g]
const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?/g
const HOME = [/\/(?:Users|home)\/[^/\s"']+/g, /[A-Za-z]:\\Users\\[^\\\s"']+/g]

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function maskText(text: string, cfg: MaskConfig): string {
  let out = text
  for (const re of KEYS) out = out.replace(re, '[key]')
  out = out.replace(SECRET_ENV, '$1[key]').replace(EMAIL, '[email]')
  for (const re of PHONES) out = out.replace(re, '[phone]')
  for (const w of cfg.words) if (w) out = out.replace(new RegExp(escape(w), 'gi'), '[private]')
  if (cfg.strict) {
    out = out.replace(MONEY, '[$]')
    for (const re of HOME) out = out.replace(re, '~')
  }
  return out
}

export function maskDeep(value: unknown, cfg: MaskConfig): unknown {
  if (typeof value === 'string') return maskText(value, cfg)
  if (Array.isArray(value)) return value.map(v => maskDeep(v, cfg))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v, cfg)]))
  }
  return value
}

export function maskProps<P extends object>(props: P, keys: readonly string[], cfg: MaskConfig): P {
  const out: Record<string, unknown> = { ...(props as Record<string, unknown>) }
  for (const k of keys) if (k in out) out[k] = maskDeep(out[k], cfg)
  return out as P
}

export const initial = (word: string) => `${word.charAt(0).toUpperCase()}•••`

export const PROMPT_SECTION = [
  'Recording mode is on: the person is screen-recording this session.',
  'Never print API keys, tokens, passwords, email addresses, phone numbers, or the private words they listed.',
  'Refer to them generically ("the API key", "your email") instead of quoting them.',
  'When you skip one, say: "Recording mode is on, so I\'ll keep that off screen".',
].join(' ')
