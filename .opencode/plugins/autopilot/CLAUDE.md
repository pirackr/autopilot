# Autopilot Plugin

OpenCode plugin that re-prompts the agent when it goes idle with incomplete tasks remaining.

## Architecture

```
index.ts          - plugin entry, routes OpenCode events to Enforcer
enforcer.ts       - core logic: abort detection, source selection, prompt injection
sources/
  types.ts        - TodoSource interface (IncompleteResult, TodoSource)
  file-plan.ts    - FilePlanSource: reads ~/.claude/autopilot-state/active-plan -> plan file -> counts - [ ] checkboxes
  session-todo.ts - SessionTodoSource: calls session.todo() API for OpenCode's built-in task system
```

## How It Works

1. On `session.idle`, the Enforcer checks for incomplete tasks
2. Source priority: **FilePlanSource first** (file-based plans), then **SessionTodoSource** (API-based todos)
3. If incomplete tasks found, injects a continuation prompt via `session.prompt()`
4. If user aborted (Escape/Stop) within the last 3 seconds, skips injection

## Source Selection

- **FilePlanSource** activates when `~/.claude/autopilot-state/active-plan` exists and points to a valid plan file. Counts `- [ ]` (unchecked) and `- [x]` (checked) markdown checkboxes.
- **SessionTodoSource** activates as fallback. Queries OpenCode's `session.todo()` API and filters for non-completed/non-cancelled tasks.

## Events Handled

| Event | Action |
|---|---|
| `session.idle` | Check sources -> inject prompt if incomplete tasks |
| `session.error` (AbortError) | Set abort flag (suppresses next idle injection for 3s) |
| `message.updated` | Clear abort flag |
| `message.part.updated` | Clear abort flag |
| `tool.execute.before/after` | Clear abort flag |
| `session.deleted` | Clean up session state |

## Activating File-Based Plans

```bash
mkdir -p ~/.claude/autopilot-state
echo "/path/to/plan.md" > ~/.claude/autopilot-state/active-plan
```

To deactivate: `rm ~/.claude/autopilot-state/active-plan`

## Testing

### Plugin Registration

The plugin must be registered in `.opencode/opencode.json`:
```json
{
  "plugin": ["./plugins/autopilot/index.ts"]
}
```
OpenCode does NOT auto-discover plugins from `.opencode/plugins/` - they must be explicitly listed.

### Verified (2026-04-05)

**FilePlanSource unit test** (bun):
- Created test plan with 2 unchecked + 1 checked step
- Activated via `~/.claude/autopilot-state/active-plan`
- `FilePlanSource.getIncomplete()` returned `{ count: 2, total: 3, context: "1/3 completed, 2 remaining" }`
- Returns `null` when state dir doesn't exist (tested with `AUTOPILOT_STATE_DIR=/tmp/nonexistent`)

**End-to-end idle hook** (`npx opencode-ai run --print-logs --log-level DEBUG "Say hello"`):
- Plugin loads: `service=plugin path=file:///.../autopilot/index.ts loading plugin`
- After agent finishes, `session.idle` publishes
- Plugin detects 2 unchecked steps and injects continuation prompt
- `session.prompt step=0` fires - agent starts a new loop
- Agent did not execute plan steps because `opencode run` non-interactive mode has limited tool permissions

**Result:** Idle hook works correctly. Full plan execution requires interactive TUI mode with tool permissions granted.

## Design Decisions

- **No countdown/toast** - minimal first, add UX later if needed
- **No agent/model preservation** - uses session defaults for re-prompting
- **No background task coordination** - no BackgroundManager dependency
- **Abort flag persists** until activity clears it or 3s window expires - prevents race on rapid idle events
