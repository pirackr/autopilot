# Autopilot Model-Aware Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add large model-aware prompt builders for the built-in `autopilot` roles while preserving user-controlled model selection and prompt override precedence.

**Architecture:** Introduce a small prompt-building layer under `.opencode/plugins/autopilot/agents/` with shared formatting helpers, prompt family detection, and role-first variant selection. Keep command registration and config shape stable, but have defaults and resolver flow through the builder so resolved prompts depend on the final model and cost tier unless the user explicitly overrides `prompt`.

**Tech Stack:** TypeScript, Node ESM, OpenCode plugin config, Bun tests

---

### Task 1: Add failing prompt builder tests

**Files:**
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-prompts.test.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-prompts.test.ts`

- [x] **Step 1: Write the failing prompt builder test file**

```ts
import { describe, expect, test } from "bun:test"
import {
  buildAutopilotAgentPrompt,
  getPromptModelFamily,
} from "../.opencode/plugins/autopilot/agents/prompt-builders"

describe("getPromptModelFamily", () => {
  test("maps known providers to prompt families", () => {
    expect(getPromptModelFamily("openai/gpt-5.4")).toBe("gpt")
    expect(getPromptModelFamily("anthropic/claude-sonnet-4-6")).toBe("claude")
    expect(getPromptModelFamily("google/gemini-2.5-pro")).toBe("gemini")
    expect(getPromptModelFamily("unknown/custom-model")).toBe("generic")
  })
})

describe("buildAutopilotAgentPrompt", () => {
  test("uses the gpt-family implementer variant when the model is gpt-like", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "implementer",
      model: "openai/gpt-5.4",
      costTier: "expensive",
    })

    expect(prompt).toContain("<Role>")
    expect(prompt).toContain("You are the autopilot implementer.")
    expect(prompt).toContain("<Workflow>")
    expect(prompt).toContain("Use an explicit execution and verification loop")
  })

  test("falls back to cost-tier guidance when there is no family-specific variant", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "research",
      model: "unknown/custom-model",
      costTier: "cheap",
    })

    expect(prompt).toContain("<Operating_Bias>")
    expect(prompt).toContain("Keep the workflow lightweight and search-first")
  })
})
```

- [x] **Step 2: Run the new test to verify it fails**

Run: `bun test tests/agent-prompts.test.ts`
Expected: FAIL with module-not-found errors for `.opencode/plugins/autopilot/agents/prompt-builders`

- [x] **Step 3: Commit the failing test**

```bash
git add tests/agent-prompts.test.ts
git commit -m "test: add model-aware prompt builder coverage"
```

### Task 2: Implement prompt builder types and helpers

**Files:**
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompt-types.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompt-shared.ts`
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompt-builders.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-prompts.test.ts`

- [x] **Step 1: Add the shared prompt types**

```ts
import type { AutopilotAgentID, CostTier } from "./types"

export type AutopilotPromptModelFamily =
  | "gpt"
  | "claude"
  | "gemini"
  | "generic"

export type AutopilotPromptVariantContext = {
  role: AutopilotAgentID
  model: string
  costTier: CostTier
}

export type AutopilotPromptSectionSet = {
  role: string
  primaryResponsibility: string
  operatingBias: string[]
  workflow: string[]
  doNot: string[]
  completionStandard: string
}
```

- [x] **Step 2: Add shared prompt-formatting helpers**

```ts
import type { AutopilotPromptSectionSet } from "./prompt-types"

function buildBulletBlock(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}

function buildWorkflowList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n")
}

export function formatPromptSections(sections: AutopilotPromptSectionSet): string {
  return [
    `<Role>\n${sections.role}\n</Role>`,
    `<Primary_Responsibility>\n${sections.primaryResponsibility}\n</Primary_Responsibility>`,
    `<Operating_Bias>\n${buildBulletBlock(sections.operatingBias)}\n</Operating_Bias>`,
    `<Workflow>\n${buildWorkflowList(sections.workflow)}\n</Workflow>`,
    `<Do_Not>\n${buildBulletBlock(sections.doNot)}\n</Do_Not>`,
    `<Completion_Standard>\n${sections.completionStandard}\n</Completion_Standard>`,
  ].join("\n\n")
}
```

- [x] **Step 3: Add model family detection and a temporary role builder**

```ts
import { formatPromptSections } from "./prompt-shared"
import type {
  AutopilotPromptModelFamily,
  AutopilotPromptVariantContext,
} from "./prompt-types"

export function getPromptModelFamily(model: string): AutopilotPromptModelFamily {
  if (model.startsWith("openai/") || model.startsWith("github-copilot/")) return "gpt"
  if (model.startsWith("anthropic/")) return "claude"
  if (model.startsWith("google/") || model.startsWith("google-vertex/")) return "gemini"
  return "generic"
}

export function buildAutopilotAgentPrompt(ctx: AutopilotPromptVariantContext): string {
  const family = getPromptModelFamily(ctx.model)

  if (ctx.role === "implementer" && family === "gpt") {
    return formatPromptSections({
      role: "You are the autopilot implementer.",
      primaryResponsibility: "Execute code changes end-to-end once scope is clear.",
      operatingBias: [
        "Explore enough context to act confidently.",
        "Prefer the smallest correct change.",
      ],
      workflow: [
        "Read enough relevant context before editing.",
        "Use an explicit execution and verification loop.",
        "Verify the affected behavior before claiming completion.",
      ],
      doNot: [
        "Do not expand scope with speculative refactors.",
        "Do not claim success without verification.",
      ],
      completionStandard: "The requested change works and has been verified.",
    })
  }

  return formatPromptSections({
    role: `You are the autopilot ${ctx.role} agent.`,
    primaryResponsibility: `Handle ${ctx.role} work with the configured model.`,
    operatingBias: ["Keep the workflow lightweight and search-first"],
    workflow: ["Use the simplest applicable path."],
    doNot: ["Do not drift outside the assigned role."],
    completionStandard: "The role-specific work is complete.",
  })
}
```

- [x] **Step 4: Run the prompt builder tests to verify they pass**

Run: `bun test tests/agent-prompts.test.ts`
Expected: PASS

- [x] **Step 5: Commit the prompt builder foundation**

```bash
git add .opencode/plugins/autopilot/agents/prompt-types.ts .opencode/plugins/autopilot/agents/prompt-shared.ts .opencode/plugins/autopilot/agents/prompt-builders.ts tests/agent-prompts.test.ts
git commit -m "feat: add autopilot prompt builder foundation"
```

### Task 3: Add role-first variants and large structured prompts

**Files:**
- Create: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompt-variants.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompt-builders.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-prompts.test.ts`

- [x] **Step 1: Extend the prompt builder test to cover family and cost-tier fallback**

```ts
  test("uses the claude-family orchestrator variant when available", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "orchestrator",
      model: "anthropic/claude-sonnet-4-6",
      costTier: "expensive",
    })

    expect(prompt).toContain("Reason carefully about routing and delegation tradeoffs")
  })

  test("prefers a cheap-tier planner fallback for unknown cheap models", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "planner",
      model: "unknown/custom-model",
      costTier: "cheap",
    })

    expect(prompt).toContain("Keep the plan lean and focused on immediate execution")
  })
```

- [x] **Step 2: Run the updated test to verify it fails**

Run: `bun test tests/agent-prompts.test.ts`
Expected: FAIL because the current builder does not have role-specific family and cost-tier variants

- [x] **Step 3: Add role-first prompt variants**

```ts
import type { AutopilotAgentID, CostTier } from "./types"
import type {
  AutopilotPromptModelFamily,
  AutopilotPromptSectionSet,
} from "./prompt-types"

type RolePromptVariants = {
  default: AutopilotPromptSectionSet
  families?: Partial<Record<AutopilotPromptModelFamily, Partial<AutopilotPromptSectionSet>>>
  costTiers?: Partial<Record<CostTier, Partial<AutopilotPromptSectionSet>>>
}

export const AUTOPILOT_PROMPT_VARIANTS: Record<AutopilotAgentID, RolePromptVariants> = {
  orchestrator: {
    default: {
      role: "You are the autopilot orchestrator.",
      primaryResponsibility: "Infer the user's actual intent and route work to the right role.",
      operatingBias: [
        "Prefer delegation over doing specialized work directly.",
        "Prefer research for information gathering.",
        "Prefer planning for unclear scope.",
      ],
      workflow: [
        "Infer intent before acting.",
        "Choose whether work should be researched, planned, implemented, or answered directly.",
        "Keep the session moving with the smallest correct next action.",
      ],
      doNot: [
        "Do not turn routing into ceremony.",
        "Do not absorb deep implementation work unless there is no better role.",
      ],
      completionStandard: "The right role is engaged and the user is unblocked.",
    },
    families: {
      claude: {
        workflow: [
          "Infer intent before acting.",
          "Reason carefully about routing and delegation tradeoffs.",
          "Keep the session moving with the smallest correct next action.",
        ],
      },
    },
  },
  planner: {
    default: {
      role: "You are the autopilot planner.",
      primaryResponsibility: "Clarify ambiguity and produce a concrete implementation plan before code changes begin.",
      operatingBias: [
        "Prefer clarification before action.",
        "Turn broad requests into concrete steps.",
      ],
      workflow: [
        "Identify ambiguity and missing assumptions.",
        "Resolve the scope of the work.",
        "Produce a concrete plan that can be executed without guesswork.",
      ],
      doNot: [
        "Do not start implementation when planning is still needed.",
      ],
      completionStandard: "The work is clearly scoped and implementation can proceed without guesswork.",
    },
    costTiers: {
      cheap: {
        operatingBias: [
          "Prefer clarification before action.",
          "Keep the plan lean and focused on immediate execution.",
        ],
      },
    },
  },
  // implementer and research variants in the same shape
}
```

- [x] **Step 4: Update the builder to merge role default, family variant, and cost-tier fallback**

```ts
import { AUTOPILOT_PROMPT_VARIANTS } from "./prompt-variants"

function mergeSections(
  base: AutopilotPromptSectionSet,
  override?: Partial<AutopilotPromptSectionSet>,
): AutopilotPromptSectionSet {
  return {
    ...base,
    ...override,
  }
}

export function buildAutopilotAgentPrompt(ctx: AutopilotPromptVariantContext): string {
  const family = getPromptModelFamily(ctx.model)
  const variants = AUTOPILOT_PROMPT_VARIANTS[ctx.role]
  const familyVariant = variants.families?.[family]
  const costTierVariant = familyVariant ? undefined : variants.costTiers?.[ctx.costTier]

  return formatPromptSections(
    mergeSections(
      mergeSections(variants.default, costTierVariant),
      familyVariant,
    ),
  )
}
```

- [x] **Step 5: Run the prompt builder tests to verify they pass**

Run: `bun test tests/agent-prompts.test.ts`
Expected: PASS

- [x] **Step 6: Commit the role variant builders**

```bash
git add .opencode/plugins/autopilot/agents/prompt-variants.ts .opencode/plugins/autopilot/agents/prompt-builders.ts tests/agent-prompts.test.ts
git commit -m "feat: add model-aware autopilot prompt variants"
```

### Task 4: Route defaults and resolver output through the prompt builders

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/prompts.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/defaults.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/.opencode/plugins/autopilot/agents/resolve.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-config.test.ts`

- [x] **Step 1: Extend the resolver test for builder output and explicit prompt override precedence**

```ts
  test("recomputes prompts from the resolved model when no explicit prompt override is provided", () => {
    const resolved = resolveAutopilotAgentConfig({
      agents: {
        implementer: {
          model: "anthropic/claude-sonnet-4-6",
        },
      },
    })

    expect(resolved.implementer.prompt).toContain("You are the autopilot implementer.")
    expect(resolved.implementer.prompt).toContain("Match the surrounding codebase")
  })

  test("keeps an explicit prompt override instead of builder output", () => {
    const resolved = resolveAutopilotAgentConfig({
      agents: {
        research: {
          prompt: "custom research prompt",
        },
      },
    })

    expect(resolved.research.prompt).toBe("custom research prompt")
  })
```

- [x] **Step 2: Run the resolver test to verify it fails**

Run: `bun test tests/agent-config.test.ts`
Expected: FAIL because defaults and resolver still rely on static prompt constants

- [x] **Step 3: Turn `prompts.ts` into a thin compatibility layer over the builders**

```ts
import { buildAutopilotAgentPrompt } from "./prompt-builders"

export const AUTOPILOT_AGENT_PROMPTS = {
  orchestrator: buildAutopilotAgentPrompt({
    role: "orchestrator",
    model: "anthropic/claude-sonnet-4-6",
    costTier: "expensive",
  }),
  implementer: buildAutopilotAgentPrompt({
    role: "implementer",
    model: "openai/gpt-5.4",
    costTier: "expensive",
  }),
  research: buildAutopilotAgentPrompt({
    role: "research",
    model: "openai/gpt-5-nano",
    costTier: "cheap",
  }),
  planner: buildAutopilotAgentPrompt({
    role: "planner",
    model: "anthropic/claude-sonnet-4-6",
    costTier: "standard",
  }),
} as const
```

- [x] **Step 4: Update the resolver to rebuild prompts from the resolved model and cost tier unless `prompt` is explicitly overridden**

```ts
import { buildAutopilotAgentPrompt } from "./prompt-builders"

      const resolvedDefinition = {
        ...base,
        ...presetOverride,
        ...userOverride,
      }

      return [
        id,
        {
          ...resolvedDefinition,
          prompt:
            userOverride.prompt ??
            buildAutopilotAgentPrompt({
              role: id,
              model: resolvedDefinition.model,
              costTier: resolvedDefinition.costTier,
            }),
          subscriptionSource: presetName ?? "default",
        },
      ]
```

- [x] **Step 5: Run the resolver and builder tests to verify they pass**

Run: `bun test tests/agent-prompts.test.ts tests/agent-config.test.ts`
Expected: PASS

- [x] **Step 6: Commit the resolver integration**

```bash
git add .opencode/plugins/autopilot/agents/prompts.ts .opencode/plugins/autopilot/agents/defaults.ts .opencode/plugins/autopilot/agents/resolve.ts tests/agent-config.test.ts tests/agent-prompts.test.ts
git commit -m "feat: resolve autopilot prompts from model-aware builders"
```

### Task 5: Verify command wiring still exposes resolved prompts

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/command-config.test.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/command-config.test.ts`

- [x] **Step 1: Extend the command registration test for model-family prompt output**

```ts
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain("<Role>")
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain(
    "You are the autopilot implementer.",
  )
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain(
    "Use an explicit execution and verification loop",
  )
```

- [x] **Step 2: Run the command registration test**

Run: `bun test tests/command-config.test.ts`
Expected: PASS

- [x] **Step 3: Commit the command verification update**

```bash
git add tests/command-config.test.ts
git commit -m "test: verify model-aware prompt command wiring"
```

### Task 6: Run the full verification suite

**Files:**
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-prompts.test.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/agent-config.test.ts`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.worktrees/autopilot-agent-roster/tests/command-config.test.ts`

- [x] **Step 1: Run the full test suite**

Run: `bun test`
Expected: PASS

- [x] **Step 2: Commit the final verification if any follow-up test-only edits were needed**

```bash
git status --short
```

Expected: no uncommitted changes
