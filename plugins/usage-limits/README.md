# usage-limits

A Claude Code mod that shows your **session (5-hour)** and **week (7-day)** rate-limit usage as progress bars in the prompt footer, with when each one resets.

```
Session ████░░░░░░ 42% ↻1h30m  ·  Week █░░░░░░░░░ 7% ↻Thu 1am
```

The bars appear next to the session mode indicator and update whenever Claude Code re-measures your rate limits.

## Install

From inside Claude Code:

```
/plugin install usage-limits --marketplace <path-or-owner>/claude-code-mods
```

See the [root README](../../README.md) for details, then reload plugins (or restart the session).

## How it works

The mod is a plugin of function hooks (`hooks/hooks.json` → `hooks/register.ts`):

| Hook | What it does |
| --- | --- |
| `session.start` | Reads current usage via `$.session.usage()`, stores the limits, and re-renders every 30 seconds so the countdown stays current. |
| `session.measure` | Refreshes the limits when `rateLimits` changed. |
| `ui.render` (`SessionMode`) | Appends the line to the session mode indicators. |

`hooks/format.ts` renders each limit as a 10-cell bar (`█` filled, `░` empty), clamped to 0–100%. Only the `five_hour` (Session) and `seven_day` (Week) limits are shown; other kinds are ignored. The session limit shows a countdown to its reset (`↻1h30m`), the week limit its reset day and hour (`↻Thu 1am`). If no limits are reported, nothing is rendered.

## Development

```
hooks/
  hooks.json     module manifest
  register.ts    hook registration
  format.ts      bar / line formatting
types/index.d.ts plugin state typings
usage-limits.test.ts tests (claude-code/testing)
```

Tests use the `claude-code/testing` harness provided by Claude Code.

## License

[MIT](LICENSE)
