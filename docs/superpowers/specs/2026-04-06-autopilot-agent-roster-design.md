# Autopilot Agent Roster Design

## Goal

Add four built-in `autopilot` agents inspired by Oh My OpenAgent while keeping the implementation small enough for this repository: `orchestrator`, `implementer`, `research`, and `planner`. The design must also let the user choose models based on subscription level without hard-coding one provider's pricing model into the runtime.

## Current Context

- The current plugin only registers slash commands and enforces idle-session continuation.
- There is no existing built-in agent registry, model fallback resolver, or agent-specific configuration surface.
- `.opencode/commands/*.md` is the source of truth for shipped commands.
- Plugin logic is intentionally shallow and should stay focused by responsibility.

## Options Considered

### Option 1: Command-only agent prompts

Create four markdown commands with embedded prompts and no central registry.

Trade-offs:

- Smallest implementation.
- Fits the current command-centric shape.
- Makes subscription-aware model resolution awkward or duplicated.
- Makes it harder to keep role definitions consistent across commands.
- Pushes configuration logic into markdown, which is the wrong layer.

### Option 2: Plugin-managed agent registry with command wrappers

Add a small agent-definition and config-resolution layer in plugin code, then expose thin slash commands for each built-in role.

Trade-offs:

- Keeps role definitions, prompt templates, and model selection in one place.
- Supports subscription presets plus explicit per-agent overrides cleanly.
- Lets command markdown stay thin and descriptive.
- Adds some code structure, but still much smaller than a full orchestration framework.

### Option 3: Full Oh My OpenAgent-style orchestration system

Recreate built-in agent factories, category routing, dynamic prompt builders, model-requirement tables, and multi-agent orchestration behavior.

Trade-offs:

- Most powerful.
- Closest to Oh My OpenAgent's architecture.
- Much too large for the current repository scope.
- Would turn a focused plugin into a competing orchestration framework.

## Recommendation

Choose Option 2.

This repository is too small and too focused to justify a full orchestration system, but command-only prompts would make subscription-based model assignment messy. A small plugin-managed agent registry gives the project a clean center of gravity for agent roles and model resolution while respecting the repo's current architecture.

## Final Design

### Agent Roles

Add four built-in roles:

1. `orchestrator`
   - Routes work.
   - Decides whether to answer directly, delegate, or switch to planning.
   - Intended to be the default top-level role.

2. `implementer`
   - Executes code changes end-to-end once scope is clear.
   - Favored for most actual implementation work.

3. `research`
   - Handles cheap search and lookup tasks.
   - Covers both internal codebase lookup and external documentation/reference discovery in the initial version.

4. `planner`
   - Clarifies ambiguous work and produces plans before implementation.
   - Used when the request is underspecified, risky, or clearly multi-step.

### Files and Responsibilities

Add a new subtree under `.opencode/plugins/autopilot/agents/`.

Suggested file layout:

- `.opencode/plugins/autopilot/agents/types.ts`
  - shared types for agent ids, definitions, preset names, and resolved config
- `.opencode/plugins/autopilot/agents/defaults.ts`
  - built-in role definitions and default prompt text references
- `.opencode/plugins/autopilot/agents/presets.ts`
  - subscription preset defaults such as `free`, `pro`, and `max`
- `.opencode/plugins/autopilot/agents/resolve.ts`
  - resolves effective agent config from defaults + preset + overrides
- `.opencode/plugins/autopilot/agents/prompts.ts`
  - role prompt builders or prompt constants

The command loader should stay separate. Commands should ask the plugin for the effective agent settings rather than carrying that logic themselves.

### Configuration Model

Expose a new `autopilot` config section in `opencode.json` with this shape:

```json
{
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

Effective precedence:

1. Built-in role defaults.
2. Subscription preset defaults.
3. Explicit per-agent overrides.

This allows a user to pick a coarse subscription profile, then override only the agents that matter.

### Subscription Presets

Support a small initial preset set:

1. `free`
   - Bias toward cheap search and lower-cost general models.
2. `pro`
   - Use stronger default models for `orchestrator`, `implementer`, and `planner`, while keeping `research` cheap.
3. `max`
   - Prefer the strongest configured models for all expensive roles.

The preset names are intentionally generic. They describe intent, not any single provider's branding.

### Prompt Strategy

Do not replicate Oh My OpenAgent's huge prompts.

Instead:

- Give each role a concise, purpose-specific prompt.
- Keep prompts static in the first version.
- Keep the `research` prompt biased toward cheap search and evidence gathering.
- Keep the `implementer` prompt biased toward autonomous end-to-end execution.
- Keep the `planner` prompt biased toward clarification and plan generation before code changes.
- Keep the `orchestrator` prompt biased toward routing and delegation, not doing everything itself.

If future work proves that model-family-specific prompts are necessary, add them later behind the same resolver.

### Command Surface

Add thin commands for each role, sourced from `.opencode/commands/` and mirrored into `commands/`:

- `/autopilot-orchestrator`
- `/autopilot-implementer`
- `/autopilot-research`
- `/autopilot-planner`

Each command should:

- identify the target role
- rely on plugin-side resolution for prompt and model selection
- keep markdown content focused on usage, not runtime policy

The existing `/autopilot` command remains separate and continues to represent checklist execution, not agent selection.

### Runtime Scope

This work should not add a full agent execution framework.

The plugin should provide:

- role definitions
- effective config resolution
- command registration for the role-specific commands

The plugin should not add:

- dynamic category-based delegation
- background subagent orchestration
- provider availability discovery
- giant fallback chains copied from Oh My OpenAgent

Those are intentionally out of scope for the first version.

## Error Handling

### Invalid preset name

If the user specifies an unknown preset, fall back to the built-in default preset and surface a clear configuration error or warning.

### Partial per-agent override

If a user overrides only one field, merge that field onto the effective preset value instead of requiring a full object replacement.

### Missing model override

If a preset or override omits a model, fall back to the role's built-in default.

## Testing

Add tests for:

- built-in role registration
- subscription preset resolution
- per-agent override precedence
- command registration for the four new commands
- shipped asset mirroring for new markdown command files

## Scope

This design covers the first built-in `autopilot` agent roster and config model.

It does not cover:

- dynamic provider capability detection
- automatic fallback-chain selection based on authenticated providers
- advanced review or architecture specialist agents
- execution-time multi-agent orchestration comparable to Oh My OpenAgent
