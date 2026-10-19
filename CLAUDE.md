# claude-code-mods

Marketplace of independent Claude Code mods (function-hook plugin API, written against Claude Code 2.1.303). Each folder under `plugins/` is one plugin; `README.md` has the user-facing table.

## Plugin layout

```
plugins/<name>/
  .claude-plugin/plugin.json   name, version, description, "types" when it keeps state
  hooks/hooks.json             {"modules": ["./register.tsx"]}
  hooks/register.tsx           the hooks
  <name>.test.ts               claude-code/testing tests, at the plugin root
  tsconfig.json                extends ./.claude-plugin/types/tsconfig.json
  types/index.d.ts             state contract, only when it uses atoms
```

- `types/index.d.ts` may only `export type`s plus `declare module 'claude-code'` augmenting `PluginState`; a bare `export {}` fails validation. Declare every atom you read, including another plugin's (`recording-mode`'s `mode` is declared in `goal-meter` and `agent-watch`).
- `.claude-plugin/types/` is written by the engine and git-ignored. For a type-check outside a session, point `tsc` at the `claude-code.d.ts` bundled with the `plugin-authoring` skill and include each plugin's `hooks`, `types` and `*.test.ts`.
- New plugin: add it to `.claude-plugin/marketplace.json`, the `README.md` table and the marketplace description.

## Bands

Each `AbovePrompt` hook draws its row and wraps the band below it (`const below = await next(e)`). Hooks nest in `enabledPlugins` order in `~/.claude/settings.json`, first on top. `band-rule` draws the separator line and must be listed before the other mods. Reorder by editing the lines in that object, then `/reload-plugins`; `claude plugin install` appends at the end. Current order: `band-rule`, `agent-watch`, `auto-handoff`, `cache-clock`, `usage-gauge`, `goal-meter`, `recording-mode`, `usage-limits`.

Every band's title chip is 11 cells wide (the label padded to match ` ⇄ CONTEXT `), so the colored column lines up; keep new chips at 11 and `CHIP_WIDTH` in `agent-watch` in step. Band text starts one space after the chip in every mod. A band is one row: the chip sits in a `Box flexShrink={0}` and the rest in a single `<Text wrap="truncate-end">` with nested colored `Text`s, so a narrow terminal cuts the end with `…` instead of wrapping; buttons get their own `flexShrink={0}` Box.

Progress bars are `▆` cells (three-quarter height, so stacked bars keep a gap): the filled part in the status color, the empty part in the same block in gray (`TRACK`), drawn as a nested `Text` run. `usage-limits` is the exception and uses `█`/`░`, because `SessionMode` only takes plain strings.

## Versioning

Every plugin's `version` in `plugins/*/.claude-plugin/plugin.json` equals the marketplace `metadata.version` in `.claude-plugin/marketplace.json` and the latest git tag. Bump all of them together in the same release commit, then tag.

## Release

1. Bump every `version` (plugins and marketplace), run the checks below.
2. Commit, then `git tag -a vX.Y.Z -m vX.Y.Z` and push the branch and the tag.
3. `direnv exec . gh release create vX.Y.Z --title vX.Y.Z --notes "..."`. `.envrc` / `.envrc.local` (git-ignored) set a personal `GITHUB_TOKEN`; the global one belongs to a work account that cannot write this repo.

## Before committing

Check whether `README.md` and this file need to change, and update them in the same commit. Typical triggers: a plugin added, removed or renamed; a command or option changed; a band title or band order changed; a new convention, release step or gotcha.

## Checks

```
claude plugin validate .
claude plugin validate plugins/<name>
claude plugin test plugins/<name>
```
