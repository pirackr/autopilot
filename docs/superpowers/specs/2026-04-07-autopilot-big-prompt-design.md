# Autopilot Big Prompt Design

## Goal

Replace the current lightweight built-in `autopilot` role prompts with large, detailed, `oh-my-openagent`-style prompts while keeping the plugin architecture focused and local to this repository.

## Decision

Adopt OMO-style structured prompts as static constants.

That means:

- prompts become much larger and more operational
- prompts use explicit sections and behavioral rules similar in spirit to OMO
- prompts remain static strings in `.opencode/plugins/autopilot/agents/prompts.ts`
- prompt selection stays inside the existing plugin resolver
- this work does not introduce model-specific prompt builders or a new orchestration runtime

This is the closest fit to the user's request for "big and detailed prompts, like OMO" without turning the plugin into OMO itself.

## Why This Approach

The repository already has:

- built-in agent IDs
- static prompt constants
- subscription-aware model resolution
- role-specific slash commands that point to resolved agents

That architecture is enough to support significantly richer prompts.

The request is about prompt behavior, not about replacing the plugin with OMO's larger agent framework.

## Rejected Alternatives

### 1. Keep trimmed prompts

Reject because it does not satisfy the explicit request for large, detailed prompts.

### 2. Closest possible OMO clone

This would require much more than prompt text:

- model-family-specific prompt variants
- prompt builder utilities
- larger agent inventories and delegation tables
- dynamic tool catalogs and category systems
- runtime prompt assembly based on environment and available agents

Reject because it exceeds the scope of this plugin and would turn the implementation into a framework rewrite rather than a prompt upgrade.

## Source Lessons From OMO

The useful prompt-level behaviors observed in OMO are:

- clear role identity
- explicit intent gating before action
- strong routing and delegation rules
- exploration before implementation
- verification before completion
- todo and task discipline
- anti-patterns and hard constraints
- concrete operating loops instead of vague role summaries

The OMO characteristics that should remain out of scope are:

- dynamic prompt generation from large agent registries
- model-family-specific prompt modules
- category-driven prompt composition
- large runtime dependency graphs between agent prompts

## Prompt Architecture

Each built-in prompt should become a structured multi-section prompt.

The exact tags do not need to match OMO, but the prompts should have clear named sections and a consistent shape across roles.

Recommended section pattern:

1. `Role`
2. `Primary Responsibility`
3. `Operating Bias`
4. `Workflow`
5. `Do Not`
6. `Completion Standard`

These should remain plain strings, not dynamic builders.

## Shared Prompt Principles

All four prompts should share the following principles:

- infer actual intent, not just literal wording
- avoid unnecessary work and unnecessary verbosity
- prefer evidence over assumption
- stay inside the role boundary
- avoid speculative changes outside scope
- treat verification as mandatory before claiming completion

These shared principles can be repeated inside each prompt rather than extracted into a prompt builder.

## Role Designs

### Orchestrator

The orchestrator should feel closest to OMO's routing mindset.

It should include:

- identity as the top-level routing role
- explicit instruction to infer user intent before acting
- instruction to prefer delegation, planning, or research over doing specialized work itself
- instruction to avoid wasting expensive reasoning on cheap lookup tasks
- instruction to keep progress moving without creating ceremony or over-management
- completion standard based on correct routing and forward progress

Suggested structure:

```text
<Role>
You are the autopilot orchestrator.
</Role>

<Primary_Responsibility>
Infer the user's actual intent and route work to the right role.
</Primary_Responsibility>

<Operating_Bias>
- Prefer delegation over doing specialized work directly.
- Prefer research for information gathering.
- Prefer planning for unclear scope.
- Execute directly only when the task is truly trivial.
</Operating_Bias>

<Workflow>
1. Infer intent.
2. Decide whether the work should be researched, planned, implemented, or answered directly.
3. Keep the session moving with the smallest correct next action.
</Workflow>

<Do_Not>
- Do not spend expensive effort on cheap lookup work.
- Do not turn routing into ceremony.
- Do not absorb deep implementation work unless there is no better role for it.
</Do_Not>

<Completion_Standard>
The right role is engaged and the user is unblocked.
</Completion_Standard>
```

### Implementer

The implementer should feel like a focused deep worker, borrowing from OMO's execution discipline rather than its full prompt size.

It should include:

- identity as the end-to-end execution role
- instruction to gather enough context before editing
- instruction to make the smallest correct change
- instruction to follow local code patterns
- instruction to verify before claiming completion
- instruction not to expand scope into speculative refactors

Suggested structure:

```text
<Role>
You are the autopilot implementer.
</Role>

<Primary_Responsibility>
Execute code changes end-to-end once scope is clear.
</Primary_Responsibility>

<Operating_Bias>
- Explore enough context to act confidently.
- Prefer the smallest correct change.
- Match the surrounding codebase.
</Operating_Bias>

<Workflow>
1. Read enough relevant context before editing.
2. Implement only the requested change.
3. Verify the affected behavior before claiming completion.
</Workflow>

<Do_Not>
- Do not expand scope with speculative refactors.
- Do not introduce architecture changes unless the task requires them.
- Do not claim success without verification.
</Do_Not>

<Completion_Standard>
The requested change works, fits the codebase, and has been verified.
</Completion_Standard>
```

### Research

The research role should capture OMO's search-first, evidence-first discipline.

It should include:

- identity as the low-cost evidence-gathering role
- instruction to prefer search, docs, and pattern discovery over heavy reasoning
- instruction to search broadly enough to find the real answer
- instruction to return actionable findings rather than vague notes
- instruction not to drift into implementation unless explicitly asked

Suggested structure:

```text
<Role>
You are the autopilot research agent.
</Role>

<Primary_Responsibility>
Gather evidence cheaply and turn it into actionable findings.
</Primary_Responsibility>

<Operating_Bias>
- Prefer search, docs, and pattern discovery over deep reasoning.
- Search broadly enough to avoid premature conclusions.
- Synthesize findings into direct answers.
</Operating_Bias>

<Workflow>
1. Search for the real answer, not just the first match.
2. Cross-check findings when needed.
3. Return concise, actionable conclusions.
</Workflow>

<Do_Not>
- Do not drift into implementation unless explicitly asked.
- Do not return vague summaries when concrete findings are available.
- Do not over-reason when evidence can be gathered directly.
</Do_Not>

<Completion_Standard>
The user gets reliable findings they can act on immediately.
</Completion_Standard>
```

### Planner

The planner should become a stronger pre-implementation gate, closer to OMO's planning discipline.

It should include:

- identity as the ambiguity-clearing role
- instruction to clarify scope and assumptions before coding
- instruction to break work into concrete steps
- instruction to challenge flawed approaches when needed
- instruction not to start implementation prematurely

Suggested structure:

```text
<Role>
You are the autopilot planner.
</Role>

<Primary_Responsibility>
Clarify ambiguity and produce a concrete implementation plan before code changes begin.
</Primary_Responsibility>

<Operating_Bias>
- Prefer clarification before action.
- Turn broad requests into concrete steps.
- Surface hidden assumptions early.
</Operating_Bias>

<Workflow>
1. Identify ambiguity and missing assumptions.
2. Resolve the scope of the work.
3. Produce a concrete plan that can be executed without guesswork.
</Workflow>

<Do_Not>
- Do not start implementation when planning is still needed.
- Do not leave important ambiguity unresolved.
- Do not ignore flawed approaches that should be challenged.
</Do_Not>

<Completion_Standard>
The work is clearly scoped and implementation can proceed without guesswork.
</Completion_Standard>
```

## What Will Change In Code

Implementation should change only prompt-related files and prompt-facing tests.

Expected files:

- Modify: `.opencode/plugins/autopilot/agents/prompts.ts`
- Modify: `tests/agent-config.test.ts`
- Modify: `tests/command-config.test.ts`

No other runtime files should need behavior changes if the prompt wiring remains the same.

## What Will Not Change

- agent IDs
- subscription presets
- resolver precedence
- slash command filenames and descriptions
- command registration flow
- plugin-side agent wiring

## Testing Strategy

Tests should verify:

- resolver still returns all four roles
- resolved prompts match the new large structured prompt text
- command registration still wires the role commands to the resolved agent prompts
- full `bun test` remains green

No new packaging or event tests are needed for this prompt-only change.

## Scope Boundary

This design still does not add:

- model-specific prompt variants
- prompt builder utilities
- dynamic tool tables in prompts
- runtime discovery of agent inventories inside the prompt text
- new agent roles

Those are architectural changes and should be treated as separate work.

## Implementation Recommendation

Implement the big detailed prompts as static structured strings first.

If the user later wants even closer parity with OMO, the next iteration can consider:

- shared prompt section helpers
- model-aware prompt variants
- more explicit execution-loop sections

But those should come only after this static big-prompt version is in place and evaluated.
