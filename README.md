# claude-code-mods

Claude Code mods that add a line above the prompt, a pane or a slash command. Each mod is its own plugin, so you install and enable only the ones you want.

## The mods

| Plugin | What it does | Command |
| --- | --- | --- |
| `band-rule` | Draws one dim line above the mod bands to separate them from Claude's output. Needs to be listed before the other mods (see below). | none |
| `cache-clock` | Shows whether the prompt cache is still warm, the time left, % reused and the cold-rewrite cost, with a Compact button. Toasts at 5 minutes left. | `/cache-clock on \| off \| status` |
| `usage-gauge` | Plan windows (5h, week, others) with reset times, session cost, toasts at 75% and 90%, and a pace warning. | `/usage-gauge` (opens a pane), `on \| off \| warn <a> <b> \| status` |
| `usage-limits` | Session (5h) and week (7d) rate-limit bars in the prompt footer. | none |
| `auto-handoff` | Watches how full the chat is and saves a `HANDOFF.md` at a threshold, then offers clear and resume. | `/auto-handoff on \| off \| now \| resume \| threshold <n> \| mode auto\|ask \| hide \| show \| status` |
| `agent-watch` | Shows the main chat, helper agents, their models and tasks, and the skills that ran this turn. Side pane "Agents". | `/agent-watch` (opens the Agents pane), `on \| off \| clear \| help` |
| `goal-meter` | Progress bar for the task list Claude is working through, with ETA. Pane with every task and the last 5 goals. | `/goals` (opens the Goals pane), `on \| off \| clear \| help` |
| `recording-mode` | For screen recordings: masks keys, tokens, emails, phones and your private words on screen, and tells the model to keep them off. | `/rec`, `/rec strict`, `/rec off`, `/rec hide <word>`, `/rec unhide <word>`, `/rec list`, `/rec test <text>` |

`band-rule` only sits above the whole stack when it is the first of these mods in `enabledPlugins` in `~/.claude/settings.json`; mods nest in that order, first on top.

`usage-gauge` and `usage-limits` both show plan usage. Enable one of them, not both.

In `auto-handoff`'s `auto` mode the handoff prompt is sent as soon as the threshold is crossed, even if Claude is in the middle of a task. The default mode, `ask`, only offers the button.

While `recording-mode` is on, `goal-meter` and `agent-watch` hide goal and task text too.

Settings: `cache-clock` has a `cacheMinutes` option (`5` or `60`, default `60`). The other settings live in the mods' commands and are remembered between sessions.

## Install

From this folder, add it as a marketplace and install what you want:

```
/plugin install cache-clock --marketplace Abdallah-Abdelazim/claude-code-mods
```

Repeat with another plugin name for each mod. From a local clone, use `--marketplace ~/path/to/claude-code-mods` instead.

To try one without installing: `claude --plugin-dir plugins/<name>`.

## Requirements

These mods use Claude Code's function-hook plugin API, which is early access and written against Claude Code 2.1.303. Some hooks (`session.compact`, `skill.prompt`, `prompt.compose`) do not run in plugins you install where an organization manages Claude Code.

## Develop

Each folder under `plugins/` is a standalone mod: `.claude-plugin/plugin.json`, `hooks/`, `tsconfig.json`, a `*.test.ts` and, for a mod that keeps state, `types/index.d.ts`. See [CLAUDE.md](CLAUDE.md) for the conventions and the release steps.

```
claude plugin validate plugins/<name>
claude plugin test plugins/<name>
```

The engine writes `.claude-plugin/types/` inside a mod when it loads it. It is git-ignored.
