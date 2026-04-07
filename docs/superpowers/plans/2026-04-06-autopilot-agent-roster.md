# Autopilot Agent Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four built-in `autopilot` agent roles and a subscription-aware config resolver without turning the plugin into a full orchestration framework.

**Architecture:** Add a focused `.opencode/plugins/autopilot/agents/` module that owns built-in role definitions, prompt text, generic subscription presets, and effective config resolution. Keep slash command markdown thin, register the new commands from plugin code, and cover the new behavior with Bun tests for config resolution and command asset packaging.

**Tech Stack:** TypeScript, Node ESM, OpenCode plugin config, markdown slash commands, Bun tests

---

### Task 1: Add failing tests for agent config resolution

**Files:**
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/agent-config.test.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/agent-config.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, expect, test } from "bun:test"
import {
  getDefaultAgentDefinitions,
  resolveAutopilotAgentConfig,
} from "../.opencode/plugins/autopilot/agents/resolve"

describe("resolveAutopilotAgentConfig", () => {
  test("returns the four built-in roles", () => {
    expect(Object.keys(getDefaultAgentDefinitions())).toEqual([
      "orchestrator",
      "implementer",
      "research",
      "planner",
    ])
  })

  test("applies the subscription preset before per-agent overrides", () => {
    const resolved = resolveAutopilotAgentConfig({
      subscription: "pro",
      agents: {
        implementer: {
          model: "openai/gpt-5.4",
        },
      },
    })

    expect(resolved.implementer.model).toBe("openai/gpt-5.4")
    expect(resolved.research.costTier).toBe("cheap")
    expect(resolved.planner.subscriptionSource).toBe("pro")
  })

  test("falls back to defaults for an unknown preset", () => {
    const resolved = resolveAutopilotAgentConfig({
      subscription: "unknown-preset",
    })

    expect(resolved.orchestrator.subscriptionSource).toBe("default")
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `bun test tests/agent-config.test.ts`
Expected: FAIL with module-not-found errors for `.opencode/plugins/autopilot/agents/resolve`

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/agent-config.test.ts
git commit -m "test: add agent config resolution coverage"
```

### Task 2: Implement the agent definitions and resolver

**Files:**
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/agents/types.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/agents/prompts.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/agents/defaults.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/agents/presets.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/agents/resolve.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/agent-config.test.ts`

- [ ] **Step 1: Add the shared types**

```ts
export type AutopilotAgentID =
  | "orchestrator"
  | "implementer"
  | "research"
  | "planner"

export type AutopilotSubscriptionPreset = "free" | "pro" | "max"

export type CostTier = "cheap" | "standard" | "expensive"

export type AutopilotAgentDefinition = {
  id: AutopilotAgentID
  description: string
  prompt: string
  model: string
  costTier: CostTier
}

export type AutopilotAgentOverride = Partial<
  Pick<AutopilotAgentDefinition, "model" | "prompt" | "costTier">
>

export type AutopilotAgentSettings = {
  subscription?: string
  agents?: Partial<Record<AutopilotAgentID, AutopilotAgentOverride>>
}

export type ResolvedAutopilotAgentDefinition = AutopilotAgentDefinition & {
  subscriptionSource: AutopilotSubscriptionPreset | "default"
}
```

- [ ] **Step 2: Add the prompt constants**

```ts
export const AUTOPILOT_AGENT_PROMPTS = {
  orchestrator:
    "You are the autopilot orchestrator. Route work, delegate when appropriate, and avoid doing cheap lookup work yourself.",
  implementer:
    "You are the autopilot implementer. Once scope is clear, execute code changes end-to-end with minimal churn and verify your work.",
  research:
    "You are the autopilot research agent. Prefer low-cost search, docs lookup, and evidence gathering over heavy reasoning.",
  planner:
    "You are the autopilot planner. Clarify ambiguity, define scope, and produce an implementation plan before code changes start.",
} as const
```

- [ ] **Step 3: Add the built-in default definitions**

```ts
import { AUTOPILOT_AGENT_PROMPTS } from "./prompts"
import type { AutopilotAgentDefinition } from "./types"

export function getDefaultAgentDefinitions(): Record<string, AutopilotAgentDefinition> {
  return {
    orchestrator: {
      id: "orchestrator",
      description: "Top-level routing role for autopilot",
      prompt: AUTOPILOT_AGENT_PROMPTS.orchestrator,
      model: "anthropic/claude-sonnet-4-6",
      costTier: "expensive",
    },
    implementer: {
      id: "implementer",
      description: "Primary end-to-end implementation role",
      prompt: AUTOPILOT_AGENT_PROMPTS.implementer,
      model: "openai/gpt-5.4",
      costTier: "expensive",
    },
    research: {
      id: "research",
      description: "Cheap search and documentation role",
      prompt: AUTOPILOT_AGENT_PROMPTS.research,
      model: "openai/gpt-5-nano",
      costTier: "cheap",
    },
    planner: {
      id: "planner",
      description: "Clarification and planning role",
      prompt: AUTOPILOT_AGENT_PROMPTS.planner,
      model: "anthropic/claude-sonnet-4-6",
      costTier: "standard",
    },
  }
}
```

- [ ] **Step 4: Add subscription presets**

```ts
import type { AutopilotSubscriptionPreset, AutopilotAgentOverride } from "./types"

export const AUTOPILOT_SUBSCRIPTION_PRESETS: Record<
  AutopilotSubscriptionPreset,
  Record<string, AutopilotAgentOverride>
> = {
  free: {
    orchestrator: { model: "anthropic/claude-haiku-4-5", costTier: "standard" },
    implementer: { model: "openai/gpt-5-mini", costTier: "standard" },
    research: { model: "openai/gpt-5-nano", costTier: "cheap" },
    planner: { model: "anthropic/claude-haiku-4-5", costTier: "standard" },
  },
  pro: {
    orchestrator: { model: "anthropic/claude-sonnet-4-6", costTier: "expensive" },
    implementer: { model: "openai/gpt-5.4", costTier: "expensive" },
    research: { model: "openai/gpt-5-nano", costTier: "cheap" },
    planner: { model: "anthropic/claude-sonnet-4-6", costTier: "standard" },
  },
  max: {
    orchestrator: { model: "anthropic/claude-opus-4-6", costTier: "expensive" },
    implementer: { model: "openai/gpt-5.4", costTier: "expensive" },
    research: { model: "anthropic/claude-haiku-4-5", costTier: "cheap" },
    planner: { model: "anthropic/claude-opus-4-6", costTier: "expensive" },
  },
}
```

- [ ] **Step 5: Add the resolver**

```ts
import { getDefaultAgentDefinitions } from "./defaults"
import { AUTOPILOT_SUBSCRIPTION_PRESETS } from "./presets"
import type {
  AutopilotAgentID,
  AutopilotAgentSettings,
  AutopilotSubscriptionPreset,
  ResolvedAutopilotAgentDefinition,
} from "./types"

const BUILTIN_AGENT_IDS: AutopilotAgentID[] = [
  "orchestrator",
  "implementer",
  "research",
  "planner",
]

function isPreset(value: string | undefined): value is AutopilotSubscriptionPreset {
  return value === "free" || value === "pro" || value === "max"
}

export { getDefaultAgentDefinitions } from "./defaults"

export function resolveAutopilotAgentConfig(
  settings: AutopilotAgentSettings = {},
): Record<AutopilotAgentID, ResolvedAutopilotAgentDefinition> {
  const defaults = getDefaultAgentDefinitions()
  const presetName = isPreset(settings.subscription) ? settings.subscription : undefined
  const preset = presetName ? AUTOPILOT_SUBSCRIPTION_PRESETS[presetName] : undefined

  return Object.fromEntries(
    BUILTIN_AGENT_IDS.map((id) => {
      const base = defaults[id]
      const presetOverride = preset?.[id] ?? {}
      const userOverride = settings.agents?.[id] ?? {}

      return [
        id,
        {
          ...base,
          ...presetOverride,
          ...userOverride,
          subscriptionSource: presetName ?? "default",
        },
      ]
    }),
  ) as Record<AutopilotAgentID, ResolvedAutopilotAgentDefinition>
}
```

- [ ] **Step 6: Run the resolver tests to verify they pass**

Run: `bun test tests/agent-config.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the resolver implementation**

```bash
git add .opencode/plugins/autopilot/agents tests/agent-config.test.ts
git commit -m "feat: add autopilot agent resolver"
```

### Task 3: Add role-specific slash commands and plugin registration

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/command.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/commands/autopilot-orchestrator.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/commands/autopilot-implementer.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/commands/autopilot-research.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/commands/autopilot-planner.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/commands/autopilot-orchestrator.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/commands/autopilot-implementer.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/commands/autopilot-research.md`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/commands/autopilot-planner.md`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/command-config.test.ts`

- [ ] **Step 1: Add a generic helper for loading command markdown by filename**

```ts
function loadCommandDefinition(fileName: string): CommandDefinition {
  const file = readFileSync(new URL(`../../commands/${fileName}`, import.meta.url), "utf8")
  const match = file.match(FRONTMATTER_RE)

  if (!match) {
    return { template: file.trim() }
  }

  const [, frontmatter, body] = match
  const metadata = parseFrontmatter(frontmatter)

  return {
    description: metadata.description,
    template: body.trim(),
  }
}
```

- [ ] **Step 2: Register all five autopilot commands**

```ts
const AUTOPILOT_COMMAND_FILES = {
  autopilot: "autopilot.md",
  "autopilot-orchestrator": "autopilot-orchestrator.md",
  "autopilot-implementer": "autopilot-implementer.md",
  "autopilot-research": "autopilot-research.md",
  "autopilot-planner": "autopilot-planner.md",
} as const

export function registerAutopilotCommands(config: Config): void {
  config.command ??= {}

  for (const [commandName, fileName] of Object.entries(AUTOPILOT_COMMAND_FILES)) {
    if (config.command[commandName]) continue
    config.command[commandName] = loadCommandDefinition(fileName)
  }
}
```

- [ ] **Step 3: Add the command markdown files**

```md
---
description: "Run the autopilot implementer role"
---

You are running the OpenCode `autopilot-implementer` command.

Use the built-in `implementer` role.
Favor end-to-end code execution once scope is clear.
Use the effective `autopilot` config to determine which model and prompt to apply.
```
```

Create equivalent files for `autopilot-orchestrator`, `autopilot-research`, and `autopilot-planner`, adjusting the role name and purpose sentence.

- [ ] **Step 4: Extend the command registration test**

```ts
import { registerAutopilotCommands } from "../.opencode/plugins/autopilot/command"

test("registerAutopilotCommands injects all autopilot slash commands", () => {
  const config: Config = { command: {} }

  registerAutopilotCommands(config)

  expect(config.command?.autopilot?.description).toBeDefined()
  expect(config.command?.["autopilot-orchestrator"]?.description).toBe(
    "Run the autopilot orchestrator role",
  )
  expect(config.command?.["autopilot-implementer"]?.description).toBe(
    "Run the autopilot implementer role",
  )
  expect(config.command?.["autopilot-research"]?.description).toBe(
    "Run the autopilot research role",
  )
  expect(config.command?.["autopilot-planner"]?.description).toBe(
    "Run the autopilot planner role",
  )
})
```

- [ ] **Step 5: Run the command registration test**

Run: `bun test tests/command-config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the command work**

```bash
git add .opencode/plugins/autopilot/command.ts .opencode/commands commands tests/command-config.test.ts
git commit -m "feat: register autopilot role commands"
```

### Task 4: Verify packaged command mirroring and install behavior

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/package-command-assets.test.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/install-commands.test.ts`

- [ ] **Step 1: Extend the package asset test for all new commands**

```ts
const commandFiles = [
  "init-deep.md",
  "autopilot.md",
  "autopilot-orchestrator.md",
  "autopilot-implementer.md",
  "autopilot-research.md",
  "autopilot-planner.md",
]

for (const file of commandFiles) {
  expect(readFileSync(`commands/${file}`, "utf8")).toBe(
    readFileSync(`.opencode/commands/${file}`, "utf8"),
  )
}
```

- [ ] **Step 2: Extend the install script test to verify copied role commands**

```ts
writeFileSync(join(sourceDir, "autopilot-orchestrator.md"), "# /autopilot-orchestrator\n")
writeFileSync(join(sourceDir, "autopilot-implementer.md"), "# /autopilot-implementer\n")
writeFileSync(join(sourceDir, "autopilot-research.md"), "# /autopilot-research\n")
writeFileSync(join(sourceDir, "autopilot-planner.md"), "# /autopilot-planner\n")

expect(readFileSync(join(targetDir, "commands", "autopilot-planner.md"), "utf8")).toBe(
  "# /autopilot-planner\n",
)
```

- [ ] **Step 3: Run the packaging/install tests**

Run: `bun test tests/package-command-assets.test.ts tests/install-commands.test.ts`
Expected: PASS

- [ ] **Step 4: Commit the packaging coverage**

```bash
git add tests/package-command-assets.test.ts tests/install-commands.test.ts
git commit -m "test: cover autopilot role command packaging"
```

### Task 5: Run the full verification suite and document the config shape

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/opencode.json`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/README.md`

- [ ] **Step 1: Add an example `autopilot` config block to `opencode.json`**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": "allow",
  "autopilot": {
    "subscription": "pro",
    "agents": {
      "implementer": {
        "model": "openai/gpt-5.4"
      }
    }
  }
}
```

- [ ] **Step 2: Add a README section for the four roles and preset precedence**

```md
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
```

- [ ] **Step 3: Run the full test suite**

Run: `bun test`
Expected: PASS

- [ ] **Step 4: Commit the documentation and verification**

```bash
git add opencode.json README.md
git commit -m "docs: add autopilot agent configuration"
```

### Task 6: Fix autopilot continuation so it only runs for explicit autopilot sessions

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/enforcer.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/sources/session-todo.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/enforcer.test.ts`

- [ ] **Step 1: Add a failing regression test for normal sessions with todos**

```ts
test("Enforcer does not inject continuation prompts for ordinary sessions with todos", async () => {
  const prompt = mock(async () => true)
  const todo = mock(async () => [
    { id: "todo-1", content: "pending", status: "pending", priority: "high" },
  ])

  const ctx = {
    directory: "/workspace",
    client: {
      session: {
        prompt,
        todo,
        summarize: mock(async () => true),
      },
    },
  } as unknown as PluginInput

  const enforcer = new Enforcer(ctx)
  await enforcer.onIdle("session-1")

  expect(prompt).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the regression test to verify current failure**

Run: `bun test tests/enforcer.test.ts`
Expected: FAIL because `prompt` is called even when the session was not started with `/autopilot`.

- [ ] **Step 3: Gate continuation on explicit autopilot activation**

```ts
interface SessionState {
  autopilotActive?: boolean
  abortDetectedAt?: number
  compacting?: boolean
  tokensSinceCompaction: number
  compactedMessageIDs: Set<string>
}

private getSources(sessionID: string): TodoSource[] {
  const state = this.getState(sessionID)
  const sources: TodoSource[] = [new FilePlanSource()]

  if (state.autopilotActive) {
    sources.push(new SessionTodoSource(this.ctx, sessionID))
  }

  return sources
}
```

- [ ] **Step 4: Mark sessions as autopilot-active only from explicit autopilot entrypoints**

```ts
// Use an explicit autopilot session marker rather than all sessions.
// If command-start events are unavailable, use the active-plan marker as the first guard
// and keep session todo continuation disabled until a session has been marked autopilot-managed.
```

- [ ] **Step 5: Re-run the enforcer tests**

Run: `bun test tests/enforcer.test.ts`
Expected: PASS, including the regression that ordinary sessions with todos do not trigger autopilot prompts.

- [ ] **Step 6: Commit the runtime scoping fix**

```bash
git add .opencode/plugins/autopilot.ts .opencode/plugins/autopilot/enforcer.ts .opencode/plugins/autopilot/sources/session-todo.ts tests/enforcer.test.ts docs/superpowers/plans/2026-04-06-autopilot-agent-roster.md
git commit -m "fix: scope autopilot continuation to autopilot sessions"
```
