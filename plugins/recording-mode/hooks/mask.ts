export type MaskConfig = { strict: boolean; words: readonly string[] }

const KEYS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/g,
]
// A line like `export API_TOKEN=abc` keeps its name and loses its value.
// Upper-case names only, so `input_tokens` and `hotkey` stay readable.
const SECRET_ENV = /^(\s*(?:export\s+)?(?:[A-Z][A-Z0-9]*_)*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)(?:_[A-Z0-9]+)*\s*[=:]\s*)(?!\[key\])\S.*$/gm
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// Phones need a + or separators, so bare numbers, hashes and code stay alone.
const PHONES = [/\+\d[\d\s().-]{7,}\d/g, /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g, /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g]
const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?/g
const HOME = [/\/(?:Users|home)\/[^/\s"']+/g, /[A-Za-z]:\\Users\\[^\\\s"']+/g]

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whole words only; the placeholders above are matched first so a word like `key` cannot rewrite them.
function maskWords(text: string, words: readonly string[]) {
  const list = words.filter(Boolean).sort((a, b) => b.length - a.length).map(escape)
  if (list.length === 0) return text
  const re = new RegExp(`\\[(?:key|email|phone|private)\\]|(?<![\\p{L}\\p{N}_])(${list.join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  return text.replace(re, (m, word) => (word === undefined ? m : '[private]'))
}

export function maskText(text: string, cfg: MaskConfig): string {
  let out = text
  for (const re of KEYS) out = out.replace(re, '[key]')
  out = out.replace(SECRET_ENV, '$1[key]').replace(EMAIL, '[email]')
  for (const re of PHONES) out = out.replace(re, '[phone]')
  out = maskWords(out, cfg.words)
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
