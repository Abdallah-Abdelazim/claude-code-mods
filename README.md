# claude-code-mods

Mods for Claude Code that add a band above the prompt, a side pane or a slash command. Each is its own plugin, so you can install only the ones you want.

## The mods

| Plugin | Band | What it does | Command |
| --- | --- | --- | --- |
| `band-rule` | line | Draws a dim line above the bands to separate them from Claude's output. List it before the other mods (see below). | none |
| `cache-clock` | CACHE | Shows whether the prompt cache is still warm, the time left, % reused and the cold-rewrite cost, with a Compact button. Toasts shortly before the cache goes cold. | `/cache-clock on \| off \| status` |
| `usage-gauge` | USAGE | Plan usage windows (5h, week, others) with reset times, the session cost and a pace warning. Toasts at 75% and 90%. | `/usage-gauge` (opens a pane), `on \| off \| warn <a> <b> \| status` |
| `usage-limits` | footer | Session (5h) and week (7d) rate-limit bars in the prompt footer. | none |
| `auto-handoff` | CONTEXT | Watches how full the chat is and saves a `HANDOFF.md` when it reaches a threshold, then offers to clear and resume. | `/auto-handoff on \| off \| now \| resume \| threshold <n> \| mode auto\|ask \| hide \| show \| status` |
| `agent-watch` | AGENTS | Shows the main chat and helper agents with their models and tasks, plus the skills that ran this turn. Opens an Agents pane. | `/agent-watch` (opens the Agents pane), `on \| off \| clear \| help` |
| `goal-meter` | GOAL | Progress bar and ETA for the task list Claude is working through. The pane lists every task and the last five goals. | `/goals` (opens the Goals pane), `on \| off \| clear \| help` |
| `recording-mode` | REC | For screen recordings. Masks keys, tokens, emails, phone numbers and your private words on screen, and tells the model not to print them. | `/rec`, `/rec strict`, `/rec off`, `/rec hide <word>`, `/rec unhide <word>`, `/rec list`, `/rec test <text>` |

Bands stack in the order their plugins appear in `enabledPlugins` in `~/.claude/settings.json`, first on top. To reorder, move the lines and run `/reload-plugins`; `claude plugin install` adds new entries at the end. `band-rule` draws its line above the whole stack only when it is listed first. The author's order, top to bottom: `band-rule`, `agent-watch`, `auto-handoff`, `cache-clock`, `usage-gauge`, `goal-meter`, `recording-mode`, `usage-limits`. The last one draws in the footer, so its place doesn't matter. The Band column is the title each mod shows in its band.

`usage-gauge` and `usage-limits` both show plan usage, so enable only one.

In `auto` mode, `auto-handoff` sends the handoff prompt as soon as the threshold is crossed, even while Claude is mid-task. The default `ask` mode only offers the button.

While `recording-mode` is on, `goal-meter` and `agent-watch` also hide goal and task text.

`cache-clock` has a `cacheMinutes` option (`5` or `60`, default `60`). Other settings are set through each mod's commands and persist between sessions.

## Install

Install a mod from the marketplace:

```
/plugin install cache-clock --marketplace Abdallah-Abdelazim/claude-code-mods
```

Run it once per mod, changing the plugin name. From a local clone, use `--marketplace ~/path/to/claude-code-mods` instead.

To try one without installing: `claude --plugin-dir plugins/<name>`.

## Requirements

These mods use Claude Code's function-hook plugin API, which is in early access; they were written against Claude Code 2.1.303. Where an organization manages Claude Code, plugins you install don't run the `session.compact`, `skill.prompt` and `prompt.compose` hooks.

## Develop

Each folder under `plugins/` is a standalone mod: `.claude-plugin/plugin.json`, `hooks/`, `tsconfig.json`, a `*.test.ts` and, for a mod that keeps state, `types/index.d.ts`. See [CLAUDE.md](CLAUDE.md) for the conventions and the release steps.

```
claude plugin validate plugins/<name>
claude plugin test plugins/<name>
```

The engine writes `.claude-plugin/types/` inside a mod when it loads it; the folder is git-ignored.
