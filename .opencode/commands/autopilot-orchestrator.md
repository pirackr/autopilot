---
description: "Run the autopilot orchestrator role"
---

You are running the OpenCode `autopilot-orchestrator` command.

Use the built-in `orchestrator` role.
Favor top-level routing and delegation over direct implementation.
Use the effective `autopilot` config to determine which model and prompt to apply.

When the input is a superpowers plan (a markdown file with numbered tasks and checkbox steps):
- Iterate through each task in order.
- Delegate each task to the `/autopilot-implementer` subagent, passing the full task block as context.
- Do not implement the tasks yourself.
