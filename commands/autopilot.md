---
description: "Execute a markdown checklist autonomously until done"
argument-hint: "PLAN_FILE"
---

You are running the OpenCode `autopilot` command.

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
5. Read the plan file and execute the unchecked tasks in order.
6. Update the plan file as tasks complete.
7. Continue without asking for confirmation between tasks unless a real blocker prevents progress.
8. When all tasks are complete, remove the active plan marker file.
9. If a blocker prevents completion, keep the plan file accurate and report the blocker clearly.

Focus on finishing the plan, not on re-planning it.
