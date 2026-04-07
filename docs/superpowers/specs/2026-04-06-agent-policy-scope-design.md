# Agent Policy Scope Design

## Goal

Decide where agent-assignment and tool-usage policy should live so cost-saving defaults are reusable without forcing unrelated repositories to inherit `autopilot`-specific behavior.

## Current Context

- This repository already has a root `AGENTS.md` that acts as published project guidance.
- This repository also has `.opencode/plugins/autopilot/AGENTS.md` for plugin-internal rules.
- `package.json` publishes `AGENTS.md`, which means repo-level guidance is part of the shipped package surface.
- The user wants to steer work toward an implementer agent and tool calls to save cost.

## Options Considered

### Option 1: Put the policy in `autopilot` only

Keep agent/tool routing rules inside `autopilot` command prompts, plugin docs, or plugin-local `AGENTS.md`.

Trade-offs:

- Smallest change for this package.
- Works when the only concern is how `autopilot` behaves.
- Couples a general working preference to one plugin.
- Does not help on repositories that do not use `autopilot`.
- Makes it harder for projects to express their own exceptions cleanly.

### Option 2: Put the policy in each project's `AGENTS.md`

Treat agent/tool assignment as repository policy and document it separately in every project.

Trade-offs:

- Clear ownership: each repo defines what is appropriate for its own codebase.
- Best fit when different repos need different cost, quality, or tool-use constraints.
- Avoids leaking plugin-specific assumptions into unrelated projects.
- Repetitive if the desired policy is mostly the same everywhere.
- Requires bootstrapping every new repository with similar guidance.

### Option 3: Use a layered model with global defaults and project overrides

Keep your personal default policy in global configuration, allow each project `AGENTS.md` to override it when needed, and keep `autopilot` limited to its own fallback behavior.

Trade-offs:

- Best match for the stated goal of saving cost consistently across repos.
- Avoids repeating the same baseline policy in every repository.
- Keeps project-specific exceptions close to the codebase that needs them.
- Preserves `autopilot` as a focused plugin instead of a global policy container.
- Requires being explicit about precedence: global default, then project override, then plugin-local guidance for plugin internals only.

## Recommendation

Choose Option 3.

The desired preference, assigning an implementer agent and preferring tool calls to control cost, sounds like a personal working default rather than something unique to `autopilot`. That makes global configuration the right home for the baseline behavior. Project `AGENTS.md` files should exist when a repository needs to tighten, loosen, or specialize that default. `autopilot` should only describe behavior that is intrinsic to `autopilot` itself.

## Final Design

### Global Configuration

Store the default agent-routing and tool-usage preference in your global config layer. This is where rules such as preferring an implementer agent, preferring tool calls over long in-model work, or other personal cost controls belong.

### Project `AGENTS.md`

Add repository-level `AGENTS.md` guidance only when the repo has requirements that differ from the global default. Examples include stricter review expectations, mandatory local verification, repository-specific subagent preferences, or exceptions caused by unsafe automation in that codebase.

### `autopilot` Scope

Keep `autopilot` instructions scoped to `autopilot` behavior. That includes how `/autopilot` should continue work, how the plugin should inspect incomplete tasks, and any fallback heuristics that apply only when no stronger project or global guidance exists.

### Precedence

Use this order:

1. Global default for your personal baseline.
2. Project `AGENTS.md` for repository-specific overrides.
3. `autopilot`-local guidance only for `autopilot` internals and fallback behavior.

This prevents `autopilot` from becoming the de facto policy owner for unrelated repositories.

## Error Handling

The main failure mode is policy duplication with conflicting instructions. To avoid that:

- Keep global guidance short and generic.
- Put only repository-specific deltas in project `AGENTS.md`.
- Keep plugin-local `AGENTS.md` limited to plugin implementation details.

If the same rule appears in multiple layers, the more specific layer should win.

## Testing

- Verify the global config can express the desired implementer/tool preference.
- Verify a project `AGENTS.md` can override that default with repository-specific rules.
- Verify `autopilot` still behaves correctly when no project override exists.
- Verify `autopilot` does not override unrelated project policy by default.

## Scope

This design covers where policy should live. It does not define the exact syntax of the global configuration or implement runtime merging logic.
