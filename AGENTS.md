# Repository Guide

**Generated:** 2026-04-06
**Commit:** `68a1d83`
**Branch:** `main`

## Overview

OpenCode-only plugin package for the `autopilot` capability plus shipped slash-command assets. The repo is TypeScript + Node ESM, publishes raw `.opencode` runtime files, and uses Bun only for verification.

## Structure

```text
.
|- .opencode/              # Runtime plugin entry, plugin internals, authoritative command markdown
|- commands/               # Package-root mirror of command files that must ship in the tarball
|- scripts/                # Install-time asset copy helper
|- tests/                  # Bun tests for command registration and packaging/install behavior
|- docs/superpowers/specs/ # Structure design notes; rationale, not runtime behavior
|- opencode.json           # OpenCode project config
\- package.json            # Publish surface and install/test scripts
```

## Where To Look

| Task | Location | Notes |
|------|----------|-------|
| Plugin entry and event wiring | `.opencode/plugins/autopilot.ts` | Auto-loaded entrypoint; keeps lifecycle wiring shallow |
| Plugin implementation details | `.opencode/plugins/autopilot/` | Real logic boundary; has its own local `AGENTS.md` |
| Slash command source of truth | `.opencode/commands/*.md` | Edit here first |
| Packaged command mirror | `commands/*.md` | Must stay byte-for-byte aligned with shipped command files |
| Command install behavior | `scripts/install-commands.mjs` | Copies commands into the user's OpenCode config dir on `prepare` and `postinstall` |
| Packaging and config checks | `tests/*.test.ts` | `bun:test` coverage for command registration, mirroring, and install behavior |
| Structure rationale | `docs/superpowers/specs/*.md` | Useful for intent, not source of runtime truth |

## Code Map

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `AutopilotPlugin` | plugin | `.opencode/plugins/autopilot.ts` | Registers commands and forwards session events into `Enforcer` |
| `registerAutopilotCommand` | function | `.opencode/plugins/autopilot/command.ts` | Loads `.opencode/commands/autopilot.md` into OpenCode config |
| `Enforcer` | class | `.opencode/plugins/autopilot/enforcer.ts` | Decides when to inject continuation prompts |
| `installCommands` | function | `scripts/install-commands.mjs` | Installs packaged command markdown into the user config dir |

## Conventions

- Treat `.opencode/commands/` as the authoritative command content; `commands/` is the published mirror.
- Keep `.opencode/plugins/autopilot.ts` tiny; push feature logic into `.opencode/plugins/autopilot/`.
- Do not assume a build or typecheck step exists. The package ships raw runtime assets and only defines `bun test`.
- Root `package.json` is the publish surface. `.opencode/package.json` exists only for local plugin runtime dependencies.

## Anti-Patterns

- Do not edit only `commands/*.md` and forget the `.opencode/commands/*.md` source file.
- Do not infer runtime behavior from top-level `agents/`, `hooks/`, or `skills/`; they are currently empty placeholders.
- Do not treat `README.md` structure text as authoritative when it disagrees with the current filesystem.
- Do not create extra directory-local `AGENTS.md` files unless a subtree has rules that the root and plugin guides cannot cover cleanly.

## Commands

```bash
bun test
node ./scripts/install-commands.mjs
```

## Notes

- `package.json` publishes both `.opencode/commands` and `commands`, so packaging changes often span both trees plus tests.
- There is no CI config or Makefile in this repo; local verification is the primary signal.
