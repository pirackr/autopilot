# Marketplace

This repository now uses a top-level `obra/superpowers`-style layout instead of keeping platform assets nested inside `plugins/autopilot/`.

The current implemented capability is `autopilot`: command wrappers plus an OpenCode plugin that re-prompts the agent when it goes idle with incomplete tasks remaining.

## Layout

```text
.
  .claude/
    commands/
  .opencode/
    commands/
    plugins/
  agents/
  commands/
  docs/
  hooks/
  scripts/
  skills/
  tests/
  AGENTS.md
  CLAUDE.md
  README.md
```

## Current Components

- OpenCode plugin: `.opencode/plugins/autopilot/`
- OpenCode command: `.opencode/commands/autopilot.md`
- Claude command: `.claude/commands/autopilot.md`
- Autopilot skill: `skills/autopilot/SKILL.md`

## Notes

- This is now a generic framework-style repo shape; repository/package renaming can happen later without another layout migration.
- The existing OpenCode plugin source remains under the `autopilot` name until that rename happens.
