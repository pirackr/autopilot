# Marketplace

This repository is an OpenCode-only home for the `autopilot` plugin and its `/autopilot` command.

`autopilot` re-prompts the agent when a session goes idle while incomplete work remains.

## Layout

```text
.
  opencode.json
  .opencode/
    commands/
    package.json
    plugins/
  AGENTS.md
  README.md
```

## Components

- Project config: `opencode.json`
- OpenCode plugin entry: `.opencode/plugins/autopilot.ts`
- OpenCode plugin sources: `.opencode/plugins/autopilot/`
- OpenCode command: `.opencode/commands/autopilot.md`

## Active Plan State

The plugin looks for an active plan marker at:

```text
~/.config/opencode/autopilot/active-plan
```

Set `AUTOPILOT_STATE_DIR` to override that location.

## Command Registration

`/autopilot` is registered as a per-project OpenCode command by `.opencode/commands/autopilot.md`.

## Built-in Agents

- `orchestrator`: top-level routing role
- `implementer`: end-to-end code execution role
- `research`: cheap search and docs lookup role
- `planner`: ambiguity-clearing and planning role

## Configuration

Precedence:

1. built-in defaults
2. subscription preset
3. per-agent override

## Why This Structure

- `opencode.json` lives at the repository root because that is the standard per-project OpenCode config location.
- `.opencode/plugins/*.ts` is the standard autoloaded project plugin directory, so `autopilot` uses a top-level plugin entry file there.
- `.opencode/package.json` remains the right place for local plugin dependencies used by files under `.opencode/plugins/`.
