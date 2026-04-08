---
description: "Execute a markdown checklist autonomously until done"
argument-hint: "PLAN_FILE"
---

You are running the OpenCode `autopilot` command.

Use the built-in `orchestrator` role via the `autopilot-orchestrator` agent.
Remain in that role for the full `/autopilot` run.
Use the effective `autopilot` config to determine which model and prompt to apply.

Arguments: `$ARGUMENTS`

Required behavior:

1. Treat the first argument as the path to a markdown plan file.
2. Resolve it to an absolute path and verify the file exists before doing any work.
3. Write that absolute path to the active plan marker file so the OpenCode autopilot plugin can keep the session moving if it goes idle:

```text
$AUTOPILOT_STATE_DIR/active-plan-$AUTOPILOT_SESSION_ID
```

If `AUTOPILOT_STATE_DIR` is not set, use:

```text
~/.config/opencode/autopilot/active-plan-$AUTOPILOT_SESSION_ID
```

Both environment variables are set automatically by the autopilot plugin.

4. Create the state directory if it does not exist.
5. Read the plan file and orchestrate the unchecked tasks in order.
6. For each task, choose the right autopilot subagent explicitly:

- Use `/autopilot-planner` when the task is ambiguous or needs scope clarification before code changes.
- Use `/autopilot-research` when the next step is information gathering, codebase search, or evidence collection.
- Use `/autopilot-implementer` when the task is ready to be executed.

7. When a task is implementation work, delegate it to `/autopilot-implementer` with the full task block as context instead of implementing it in the orchestrator.
8. Update the plan file as tasks complete.
9. Continue without asking for confirmation between tasks unless a real blocker prevents progress.
10. When all tasks are complete, remove the active plan marker file.
11. If a blocker prevents completion, keep the plan file accurate and report the blocker clearly.

Focus on finishing the plan, not on re-planning it.
