# Autopilot Smoke Script Design

## Goal

Add a runnable smoke-test script that exercises the real `/autopilot` command through `opencode run`, verifies the plan-backed continuation artifacts it creates, and fails clearly when the end-to-end flow regresses.

## Scope

In scope:
- one repo-local script at `scripts/smoke-autopilot.mjs`
- creation of a temporary markdown plan outside the repository
- invocation of `/autopilot` through `opencode run`
- verification of plan completion, summary-file creation, required summary sections, marker cleanup, and repo-worktree safety
- concise pass/fail terminal output with non-zero exit on failure

Out of scope:
- adding the smoke run to `package.json` test scripts
- replacing existing Bun tests
- making the script a CI requirement
- broad documentation changes beyond minimal usage guidance if needed during implementation

## Approach

Implement a Node ESM script, matching the repo's existing `scripts/*.mjs` pattern.

The script will:
1. Create a temporary directory under the system temp root.
2. Write a small markdown plan into that directory.
3. Launch `opencode run --command autopilot` against the current repository with that temp plan.
4. Observe the autopilot state directory under `~/.config/opencode/autopilot` unless overridden by environment.
5. Verify that:
   - the temporary plan's checklist items were marked complete
   - a matching summary file was created in `plan-summaries/`
   - the summary includes `## Current Task`, `## Next Step`, `## Blockers`, `## Recent Progress`, and `## Learnings`
   - the session-scoped active-plan marker was removed after completion
   - the repository worktree was not modified by the smoke run beyond pre-existing local state
6. Exit `0` on success and non-zero on any failed check.

## Script Behavior

### Inputs

The script takes no required arguments.

It may honor existing environment variables where useful:
- `AUTOPILOT_STATE_DIR` to locate state files
- the ambient OpenCode/auth environment needed for `opencode run`

### Temporary Plan

The generated plan should be intentionally minimal and should not edit tracked repository files. Its checklist should focus on read-only actions such as confirming the branch and recording that result in the summary.

### Summary Matching

The summary filename should be derived the same way the runtime derives it: sanitized lowercase basename plus SHA-256 of the absolute plan path. The script should compute that expected path directly instead of scanning loosely for recent files.

### Completion Detection

Because the headless `opencode run` process may outlive a thin shell timeout wrapper, the script should treat artifact state as the source of truth. Success means the plan is complete, the summary is present and populated, and the active marker is gone.

### Worktree Safety

The script should snapshot `git status --short` before the smoke run and compare it after the smoke run. It should tolerate unchanged pre-existing dirt but fail if the smoke run adds new repository modifications.

## Failure Handling

The script should fail with direct, specific messages for:
- missing `opencode` CLI
- failed `opencode run` launch
- incomplete temp plan
- missing summary file
- missing required summary sections
- leaked active-plan marker
- unexpected repository worktree changes

When possible, the script should leave the generated temp plan and summary path visible in output to help inspection.

## Testing Strategy

This script is itself the smoke-test entrypoint and is not required to be covered by Bun unit tests initially.

Verification for implementation should be:
- run `node ./scripts/smoke-autopilot.mjs`
- confirm it exits successfully in a working local environment
- re-run `bun test` to ensure no repository regressions

## Why This Shape

Using a Node script is the least brittle fit for this repo because it matches the existing script style, can compute summary paths deterministically, and can perform structured assertions without relying on shell-only parsing.
