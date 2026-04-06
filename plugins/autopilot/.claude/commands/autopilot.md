---
description: "Execute a superpowers plan autonomously until done"
argument-hint: "PLAN_FILE [--backend in-session|loop]"
disable-model-invocation: true
---

Read `skills/autopilot/SKILL.md` and follow it exactly.

Primary interface:

```text
/autopilot <plan>
/autopilot <plan> --backend loop
```

Examples:

```text
/autopilot docs/superpowers/plans/my-plan.md
/autopilot docs/superpowers/plans/my-plan.md --backend loop
```

Arguments: `$ARGUMENTS`
