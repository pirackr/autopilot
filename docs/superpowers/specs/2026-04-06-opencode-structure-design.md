# OpenCode Repository Structure Design

## Goal

Standardize this repository around the documented OpenCode project layout while keeping it a focused single-plugin repo for `autopilot`.

## Research Summary

- OpenCode documents `opencode.json` at the repository root as the standard per-project config location.
- OpenCode documents `.opencode/commands/` as the per-project command directory.
- OpenCode documents `.opencode/plugins/` as the per-project plugin directory and states local plugin files there are auto-loaded.
- OpenCode documents `.opencode/package.json` as the place for local plugin dependencies.

## Options Considered

### Option 1: Keep the current layout

Keep `.opencode/opencode.json` and the nested plugin entry at `.opencode/plugins/autopilot/index.ts`.

Trade-offs:

- Smallest change.
- Keeps the repo working only because it explicitly points config at a nonstandard path.
- Conflicts with the documented project config location.
- Leaves the plugin entry outside the documented top-level auto-loaded plugin file pattern.

### Option 2: Standard single-plugin OpenCode layout

Move project config to `opencode.json` at the repo root. Move the plugin entry to `.opencode/plugins/autopilot.ts`. Keep supporting implementation files under `.opencode/plugins/autopilot/`. Keep `.opencode/package.json` for dependencies and `.opencode/commands/` for command prompts.

Trade-offs:

- Matches documented OpenCode conventions.
- Keeps the repo small and easy to understand.
- Avoids redundant plugin registration because local plugin files are auto-loaded.
- Requires a small path cleanup in README and plugin entrypoint.

### Option 3: Expand to a marketplace-first multi-plugin layout now

Add top-level docs and directories for multiple plugins before there is a real need.

Trade-offs:

- Could help future expansion.
- Adds structure and naming overhead the repo does not need today.
- Risks creating placeholders instead of useful organization.

## Recommendation

Choose Option 2.

This repository currently ships one plugin and one command. The recommended structure should therefore optimize for documented OpenCode conventions and low overhead, not speculative multi-plugin scaffolding.

## Final Structure

```text
.
  opencode.json
  .opencode/
    commands/
      autopilot.md
    package.json
    plugins/
      autopilot.ts
      autopilot/
        enforcer.ts
        sources/
          file-plan.ts
          session-todo.ts
          types.ts
  docs/
    superpowers/
      specs/
        2026-04-06-opencode-structure-design.md
  AGENTS.md
  README.md
```

## Design Details

### Config

`opencode.json` lives at the repository root. It contains only project-level config and no explicit local plugin registration, because `.opencode/plugins/` is already auto-loaded by OpenCode.

### Plugin Entry

`.opencode/plugins/autopilot.ts` is the auto-loaded entrypoint. It imports implementation details from the `autopilot/` subdirectory so the public plugin entry stays obvious while the internals remain grouped.

### Plugin Internals

`.opencode/plugins/autopilot/` holds the implementation details for the plugin. The existing `enforcer.ts` and `sources/` files remain there because that grouping is already coherent and small.

### Commands

`.opencode/commands/autopilot.md` remains the project command definition. This already matches documented OpenCode command structure.

### Dependencies

`.opencode/package.json` remains the dependency manifest for local plugins. This matches OpenCode's documented dependency mechanism for files under `.opencode/plugins/`.

## Error Handling

The structure change should not alter runtime behavior. The main risk is load discovery. Using a top-level plugin file in `.opencode/plugins/` reduces that risk compared with relying on a nested `index.ts` path.

## Testing

- Verify `opencode.json` exists at the repository root.
- Verify `.opencode/plugins/autopilot.ts` exists as the plugin entrypoint.
- Verify `.opencode/opencode.json` no longer exists.
- Verify `.opencode/plugins/autopilot/index.ts` no longer exists.
- Verify README reflects the new structure.

## Scope

This design standardizes the existing single-plugin repository only. It does not introduce a marketplace catalog format, plugin publishing workflow, or multi-plugin package management.
