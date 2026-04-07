# Autopilot Plugin Guide

This subtree contains the actual `autopilot` plugin behavior: command registration, idle-session enforcement, and incomplete-work sources.

## Where To Look

| File | Role |
|------|------|
| `../autopilot.ts` | Auto-loaded entrypoint; translates OpenCode events into `Enforcer` calls |
| `command.ts` | Reads `.opencode/commands/autopilot.md`, parses frontmatter, and registers `/autopilot` |
| `enforcer.ts` | Tracks session abort/activity state and injects continuation prompts on idle |
| `sources/file-plan.ts` | Counts unchecked checklist items from the plan file named by `AUTOPILOT_STATE_DIR/active-plan` |
| `sources/session-todo.ts` | Counts non-completed session todos from the OpenCode client |
| `sources/types.ts` | Shared `IncompleteResult` and `TodoSource` contracts |

## Conventions

- Keep `Enforcer` focused on lifecycle policy only: idle detection, abort debounce, source iteration, and prompt injection.
- Add new incomplete-work detectors as new `TodoSource` implementations instead of embedding source-specific branches in `Enforcer`.
- Keep command markdown loading in `command.ts`; prompt wording for `/autopilot` belongs in `.opencode/commands/autopilot.md`, not plugin logic.
- Preserve the current event shape tolerance in `../autopilot.ts`; session IDs can arrive from multiple property paths.

## Testing Impact

- Changes to slash-command registration should update or re-run `tests/command-config.test.ts`.
- Changes to command asset paths or loading usually affect `tests/package-command-assets.test.ts` and `tests/install-commands.test.ts`.
- There are no direct tests for `enforcer.ts` or `sources/*`; behavior changes here need manual scrutiny plus targeted regression coverage if the surface grows.

## Anti-Patterns

- Do not move source-specific counting logic into `Enforcer` when a new `TodoSource` is enough.
- Do not lengthen the continuation prompt with command-planning instructions; keep it short and imperative.
- Do not change `file-plan.ts` environment-variable resolution casually; `STATE_DIR` is computed at module load and affects testability.
- Do not remove the `response.data ?? response` compatibility path in `session-todo.ts` without confirming the OpenCode client contract.

## Notes

- `ABORT_WINDOW_MS` is the guard against prompting immediately after an aborted session interaction.
- `FilePlanSource` returns `null` when there is no active plan file or no checklist items, so empty plans do not trigger prompts.
