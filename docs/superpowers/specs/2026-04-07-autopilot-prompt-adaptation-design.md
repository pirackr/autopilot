# Autopilot Prompt Adaptation Design

## Goal

Adapt the built-in `autopilot` agent prompts so they learn from `oh-my-openagent` role behavior while staying aligned with this repository's smaller plugin scope.

## Current State

The current built-in prompts are short one-line role summaries in `.opencode/plugins/autopilot/agents/prompts.ts`:

- `orchestrator`: route and delegate
- `implementer`: execute code changes end-to-end
- `research`: prefer cheap search and docs lookup
- `planner`: clarify ambiguity and plan before coding

This matches the current design intent, but it does not capture the stronger operational guidance seen in `oh-my-openagent`.

## What To Learn From Oh My OpenAgent

`oh-my-openagent` uses much richer agent prompts and agent-specific builders rather than simple one-line summaries.

Observed patterns worth learning from:

- strong role identity, not just a name and sentence
- explicit intent classification before acting
- default bias toward delegation when a role is specialized
- heavy use of parallel search and retrieval for research work
- verification loops before claiming completion
- task and todo discipline for non-trivial work
- model-specific prompt variants for some high-end agents

Observed patterns that should NOT be copied directly into this repo:

- very large, multi-block prompts designed for a much broader orchestration framework
- role systems that assume many more built-in agents than this plugin provides
- deep runtime prompt assembly tied to external categories, tool maps, and dynamic agent inventories
- prompt complexity that would turn this plugin into a full orchestration framework

## Recommendation

Use a "same intent, trimmed" adaptation.

That means:

- keep the four existing built-in roles
- keep prompt resolution static and plugin-local
- rewrite each role prompt so it carries a small number of high-value behavioral rules inspired by `oh-my-openagent`
- do not reproduce `oh-my-openagent` prompt size, XML-style structure, or dynamic prompt-generation system

This approach preserves the current architecture while making the roles meaningfully more opinionated.

## Rejected Alternatives

### 1. Near-copy behavior

Rewrite the autopilot roles to mirror `oh-my-openagent` prompt structure and constraints as closely as possible.

Why reject it:

- too much prompt bulk for this plugin
- conflicts with the repository's earlier design choice to avoid huge prompts
- would create pressure to add runtime orchestration features that do not belong here

### 2. Selective micro-edits only

Keep the current one-line prompts and add a few extra adjectives or one more sentence.

Why reject it:

- too little behavior change
- would not meaningfully capture the useful operating discipline from `oh-my-openagent`

## Proposed Prompt Shape

Each role prompt should stay compact, roughly a short paragraph or two, but should include:

1. role identity
2. primary operating bias
3. constraints about when not to overreach
4. one or two `oh-my-openagent`-inspired workflow rules

The prompts should remain plain text constants in `.opencode/plugins/autopilot/agents/prompts.ts`.

## Proposed Role Behaviors

### Orchestrator

Purpose:

- act as the routing role
- classify the task and choose whether to delegate, research, plan, or execute

Prompt behavior to add:

- infer the user's real intent before acting
- prefer delegation and routing over doing detailed work directly
- avoid spending expensive effort on cheap lookup work
- only drive implementation directly when the task is trivial or routing overhead is not worth it

Suggested prompt direction:

"You are the autopilot orchestrator. Infer the user's real intent before acting. Route work to the right role, delegate specialized work when appropriate, and avoid doing cheap lookup or deep implementation work yourself unless the task is truly trivial. Keep progress moving, but do not turn routing into unnecessary ceremony."

### Implementer

Purpose:

- own end-to-end execution when scope is already clear

Prompt behavior to add:

- explore enough context before editing
- make the smallest correct change
- verify work before claiming completion
- avoid speculative refactors or architecture changes unless required by the task

Suggested prompt direction:

"You are the autopilot implementer. Once scope is clear, explore enough context to act confidently, then execute code changes end-to-end with minimal churn. Prefer the smallest correct change, follow existing patterns, and verify your work before claiming completion. Do not expand scope with speculative refactors unless the task requires them."

### Research

Purpose:

- gather evidence cheaply and quickly

Prompt behavior to add:

- prefer search, docs, and pattern discovery over heavy reasoning
- run broad but disciplined evidence gathering first
- return actionable findings, not vague summaries
- avoid drifting into implementation unless explicitly asked

Suggested prompt direction:

"You are the autopilot research agent. Prefer low-cost search, documentation lookup, and evidence gathering over heavy reasoning. Search broadly enough to find the real answer, synthesize findings into actionable conclusions, and avoid drifting into implementation unless explicitly asked."

### Planner

Purpose:

- resolve ambiguity before coding begins

Prompt behavior to add:

- clarify unclear scope and assumptions
- break work into concrete steps
- raise concerns when the requested approach seems flawed
- avoid starting implementation when planning or clarification is still needed

Suggested prompt direction:

"You are the autopilot planner. Clarify ambiguity, identify assumptions, and produce an implementation plan before code changes start. Break work into concrete steps, raise concerns when the requested approach seems flawed, and avoid premature implementation when more clarification is needed."

## What Will Not Change

- the four built-in role IDs remain `orchestrator`, `implementer`, `research`, and `planner`
- subscription presets still select models and cost tiers
- per-agent overrides still win over preset defaults
- role commands remain thin markdown wrappers
- the plugin still resolves prompt and model selection in code

## Testing Impact

If this design is implemented, tests should be updated only where prompt text is asserted directly.

Required coverage:

- prompt resolution still returns all four roles
- command registration still wires role commands to resolved agents
- tests that assert prompt content should verify the new text exactly where appropriate

No new behavioral runtime tests should be needed unless prompt resolution mechanics change.

## Scope Boundaries

This design does not add:

- dynamic prompt builders
- model-family-specific prompt variants
- additional built-in agents
- new orchestration tools
- runtime delegation policies beyond prompt text

Those can be considered later only if the trimmed prompts prove insufficient.

## Implementation Outline

If approved, implementation should be limited to:

1. update `.opencode/plugins/autopilot/agents/prompts.ts`
2. update any tests that rely on exact prompt strings
3. run the affected test suite and then full `bun test`

## Open Question Resolved

How close should the prompts get to `oh-my-openagent`?

Resolved answer for this design:

- same intent, trimmed
- learn from `oh-my-openagent` behavioral discipline
- keep this repository's prompts small, static, and plugin-local
