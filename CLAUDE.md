# claude-code-mods

## Versioning

Every plugin's `version` in `plugins/*/.claude-plugin/plugin.json` equals the marketplace `metadata.version` in `.claude-plugin/marketplace.json` and the latest git tag (currently `v1.0.1`). Bump all of them together in the same release commit, then tag.

## Checks

```
claude plugin validate .
claude plugin validate plugins/<name>
claude plugin test plugins/<name>
```
