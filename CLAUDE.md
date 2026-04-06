# Repository Layout

This repository follows a top-level `superpowers`-style structure.

## Rules

- Keep platform-specific assets in hidden top-level directories such as `.opencode/` and `.claude/`.
- Keep shared skills, docs, scripts, and other framework content in top-level directories such as `skills/`, `docs/`, `commands/`, and `scripts/`.
- The current implemented feature is `autopilot`, with OpenCode plugin code in `.opencode/plugins/autopilot/` and command wrappers in `.opencode/commands/` and `.claude/commands/`.
