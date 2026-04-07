# Autopilot Model-Aware Prompt Design

## Goal

Add prompt builders and model-specific prompt variants for the built-in `autopilot` roles so prompt behavior can adapt to the configured model while still allowing explicit model selection to control cost.

## Decision

Use a role-first prompt builder with both model-family and cost-tier variants.

Selection order:

1. built-in role
2. model-family variant when recognized
3. cost-tier variant fallback
4. role default fallback

This keeps model choice user-controlled while letting the plugin attach prompt guidance that better fits the selected model.

## Why This Fits The Request

The user wants two things at the same time:

- large detailed prompts like OMO
- the ability to specify cheaper models to save cost

If prompts are only static per role, model choice affects cost but not prompt behavior.

If prompts are only model-family specific, cost-tier fallbacks become awkward when the configured model is unknown or when a cheaper provider should still get a simpler prompt.

Using both gives a stable fallback ladder:

- exact family when known
- otherwise a cheaper or more capable prompt profile based on resolved `costTier`

## Current Architecture

Today the plugin already resolves per-role runtime config in `.opencode/plugins/autopilot/agents/resolve.ts`.

That resolved object includes:

- `id`
- `description`
- `model`
- `costTier`
- `prompt`
- `subscriptionSource`

That means the natural extension is to compute `prompt` from a builder instead of hardcoding it as a static string.

## Scope

This design adds:

- prompt builder utilities
- model-family prompt variants
- cost-tier fallback prompt variants
- prompt resolution based on resolved model and cost tier

This design does not add:

- dynamic agent inventories
- category-driven prompt assembly
- runtime tool discovery inside prompts
- additional built-in roles
- an OMO-sized orchestration framework

## Architecture

Create a new prompt-building layer under `.opencode/plugins/autopilot/agents/`.

Recommended files:

- Create: `.opencode/plugins/autopilot/agents/prompt-types.ts`
- Create: `.opencode/plugins/autopilot/agents/prompt-shared.ts`
- Create: `.opencode/plugins/autopilot/agents/prompt-builders.ts`
- Create: `.opencode/plugins/autopilot/agents/prompt-variants.ts`
- Modify: `.opencode/plugins/autopilot/agents/prompts.ts`
- Modify: `.opencode/plugins/autopilot/agents/defaults.ts`
- Modify: `.opencode/plugins/autopilot/agents/resolve.ts`

### Responsibilities

#### `prompt-types.ts`

Defines prompt-related selection types.

Expected contents:

- `AutopilotPromptModelFamily`
- `AutopilotPromptVariantContext`
- `AutopilotPromptSectionSet`

Example:

```ts
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
```

#### `prompt-shared.ts`

Defines reusable helpers for building large structured prompts without duplicating section formatting in every role.

Expected helpers:

- `formatPromptSections()`
- `buildRoleSection()`
- `buildWorkflowList()`
- `buildBulletBlock()`

These helpers keep prompts readable in code while still producing static strings.

#### `prompt-builders.ts`

Contains role-first builders.

Expected exports:

- `buildOrchestratorPrompt(ctx)`
- `buildImplementerPrompt(ctx)`
- `buildResearchPrompt(ctx)`
- `buildPlannerPrompt(ctx)`
- `buildAutopilotAgentPrompt(ctx)`

Each role builder should:

- identify the model family
- choose the best role variant
- fall back by cost tier when needed
- return the final large prompt string

#### `prompt-variants.ts`

Holds the actual prompt section variants.

Structure should be role-first, then variant type.

Example shape:

```ts
export const AUTOPILOT_PROMPT_VARIANTS = {
  implementer: {
    default: { ... },
    families: {
      gpt: { ... },
      claude: { ... },
    },
    costTiers: {
      cheap: { ... },
      standard: { ... },
      expensive: { ... },
    },
  },
}
```

This keeps the selection logic simple and keeps prompt text close to its role.

## Model Family Resolution

Add a small helper that classifies model IDs into prompt families.

Suggested behavior:

```ts
function getPromptModelFamily(model: string): AutopilotPromptModelFamily {
  if (model.startsWith("openai/") || model.startsWith("github-copilot/")) return "gpt"
  if (model.startsWith("anthropic/")) return "claude"
  if (model.startsWith("google/") || model.startsWith("google-vertex/")) return "gemini"
  return "generic"
}
```

This should be intentionally small and easy to extend.

## Variant Selection Rules

Variant resolution should be deterministic.

For a given role and resolved agent config:

1. Determine model family from `model`
2. Check whether the role has a family-specific variant
3. If yes, use that variant
4. Otherwise, check whether the role has a `costTier` variant
5. If yes, use that variant
6. Otherwise, use the role default

Important rule:

- family-specific variants override cost-tier variants
- cost-tier variants exist to keep prompts reasonable when the provider is unknown or when cheaper models should get a reduced-operational-complexity prompt

## Prompt Strategy By Role

All roles should become large structured prompts, but the differences should be practical rather than decorative.

### Orchestrator

Base behavior:

- infer actual user intent
- route work to research, planner, or implementer
- avoid doing cheap lookups or deep implementation directly
- keep progress moving without ceremony

Family tuning:

- `gpt`: more explicit step ordering and completion contracts
- `claude`: more emphasis on reasoning about scope and delegation choices
- `gemini`: more explicit guardrails against over-eager action and premature conclusions

Cost-tier fallback:

- `cheap`: shorter operating loop, stronger bias toward routing instead of detailed supervision
- `expensive`: fuller orchestration guidance

### Implementer

Base behavior:

- read enough context before editing
- make the smallest correct change
- follow local patterns
- verify before claiming completion

Family tuning:

- `gpt`: explicit execution and verification loop
- `claude`: stronger emphasis on nuance and codebase pattern matching
- `gemini`: stronger anti-drift rules and clearer step sequencing

Cost-tier fallback:

- `cheap`: narrower scope, stronger bias toward minimal edits
- `expensive`: fuller end-to-end execution discipline

### Research

Base behavior:

- prefer search, docs, and evidence gathering over heavy reasoning
- search broadly enough to avoid false confidence
- return actionable findings
- avoid implementation drift

Family tuning:

- `gpt`: explicit output structure and answer synthesis rules
- `claude`: stronger emphasis on nuanced interpretation of findings
- `gemini`: stronger evidence-check and anti-hallucination guardrails

Cost-tier fallback:

- `cheap`: concise search-first prompt optimized for lower-cost lookup work
- `expensive`: broader synthesis instructions

### Planner

Base behavior:

- clarify ambiguity and assumptions
- break work into concrete steps
- challenge flawed approaches when needed
- block premature implementation

Family tuning:

- `gpt`: more explicit planning structure and checklist behavior
- `claude`: stronger nuance around ambiguity and tradeoff discussion
- `gemini`: stronger anti-shortcut guidance and explicit scope resolution rules

Cost-tier fallback:

- `cheap`: lean plan-focused version
- `expensive`: fuller scope-analysis and risk surfacing guidance

## How Cost Saving Works

Model selection remains the source of cost control.

The user can already save cost by setting:

```json
{
  "autopilot": {
    "agents": {
      "research": {
        "model": "openai/gpt-5-nano"
      }
    }
  }
}
```

This design preserves that behavior.

The prompt system should adapt to the chosen model, not override it.

In other words:

- model choice controls cost
- prompt variant controls behavior quality and fit for that model
- prompt selection must never silently change the user's configured model

## Changes To Existing Files

### `prompts.ts`

This file should stop being the source of hardcoded final prompts.

New responsibility:

- export high-level prompt access helpers
- re-export builder outputs if needed

It may become a thin compatibility layer around the new builder system.

### `defaults.ts`

Defaults should no longer set prompt text by reading static constants.

Recommended change:

- set `prompt` by calling the builder with the default model and cost tier for that role

This ensures defaults, presets, and overrides all flow through the same prompt construction path.

### `resolve.ts`

After merging defaults, preset overrides, and per-agent overrides, recompute the final prompt based on the resolved `model` and `costTier`.

Important rule:

- if the user explicitly overrides `prompt`, keep that exact prompt and skip builder output for that role

This preserves explicit user control.

Algorithm sketch:

```ts
const explicitPrompt = userOverride.prompt

return {
  ...base,
  ...presetOverride,
  ...userOverride,
  prompt: explicitPrompt ?? buildAutopilotAgentPrompt({
    role: id,
    model: resolvedModel,
    costTier: resolvedCostTier,
  }),
}
```

## Testing Strategy

Add focused tests for:

- model family detection
- family-specific variant selection
- cost-tier fallback when no family-specific variant exists
- explicit prompt override winning over builder-generated prompts
- command registration still exposing the resolved role prompt

Expected test files:

- Modify: `tests/agent-config.test.ts`
- Modify: `tests/command-config.test.ts`
- Create: `tests/agent-prompts.test.ts`

`tests/agent-prompts.test.ts` should cover the prompt builder directly so exact prompt assertions do not overload the resolver test file.

## Prompt Size Guidance

Prompts should be large and detailed, but still bounded.

Recommended target:

- each role prompt: roughly 3-6 structured sections
- enough detail to feel OMO-like
- no giant dynamic tables or giant inventories unrelated to this plugin

This preserves readability and maintainability.

## Compatibility Rules

- existing config shape remains valid
- existing `subscription` and per-agent `model` overrides continue to work
- existing prompt overrides continue to work and suppress builder-generated prompt text for that role
- role command wiring remains unchanged

## Recommendation

Implement the builder system in one pass, but keep the prompt family set intentionally small at first:

- `gpt`
- `claude`
- `gemini`
- `generic`

Do not add per-model variants like `gpt-5.4` or `claude-opus-4-6` yet.

That keeps the design flexible without overfitting to today's model list.
