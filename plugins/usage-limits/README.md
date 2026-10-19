# usage-limits

A Claude Code mod that shows your **session (5-hour)** and **week (7-day)** rate-limit usage as progress bars in the prompt footer.

```
Session ████░░░░░░ 42%  ·  Week █░░░░░░░░░ 7%
```

The bars appear next to the session mode indicator and update whenever Claude Code re-measures your rate limits.

## Install

From inside Claude Code:

```
/plugin marketplace add Abdallah-Abdelazim/usage-limits-cc-mod
/plugin install usage-limits@usage-limits-local
```

Then reload plugins (or restart the session).

## How it works

The mod is a plugin of function hooks (`hooks/hooks.json` → `hooks/register.ts`):

| Hook | What it does |
| --- | --- |
| `session.start` | Reads current usage via `$.session.usage()` and stores the formatted line. |
| `session.measure` | Refreshes the line when `rateLimits` changed. |
| `ui.render` (`SessionMode`) | Appends the line to the session mode indicators. |

`hooks/format.ts` renders each limit as a 10-cell bar (`█` filled, `░` empty), clamped to 0–100%. Only the `five_hour` (Session) and `seven_day` (Week) limits are shown; other kinds are ignored. If no limits are reported, nothing is rendered.

## Development

```
hooks/
  hooks.json     module manifest
  register.ts    hook registration
  format.ts      bar / line formatting
  format.test.ts tests (claude-code/testing)
types/index.d.ts plugin state typings
```

Tests use the `claude-code/testing` harness provided by Claude Code.

## License

[MIT](LICENSE)
