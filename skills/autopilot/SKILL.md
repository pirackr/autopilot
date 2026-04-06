# Skill: autopilot

Execute a plan file autonomously until all tasks are done.

## Inputs

- Required: path to a plan file
- Optional: `--backend in-session|loop`

## Behavior

1. Read the plan file provided in the command arguments.
2. Work through pending tasks in order.
3. Update task state as work completes.
4. Continue without stopping for confirmation between tasks unless blocked.
5. Stop only when all tasks are complete or a real blocker prevents progress.

## Typical Usage

```text
/autopilot docs/superpowers/plans/my-plan.md
/autopilot docs/superpowers/plans/my-plan.md --backend loop
```
