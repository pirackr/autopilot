# Autopilot Plan-Backed Notepad Continuation Design

## Goal

Add a plan-scoped notepad system to `autopilot` so idle continuation can resume work with concrete context rather than a generic "continue working" prompt.

The feature should stay close to the `oh-my-openagent` orchestrator model while fitting this repository's smaller `Enforcer`-driven architecture.

## Current State

Today, `autopilot` keeps an idle session moving by:

- reading the active plan marker at `$AUTOPILOT_STATE_DIR/active-plan-$AUTOPILOT_SESSION_ID`
- counting unchecked checklist items in the referenced markdown plan
- optionally consulting session todos when `autopilot` is active
- injecting a short generic continuation prompt when incomplete work remains

This works for simple forward progress, but it loses task-local context after drift, interruption, or compaction. There is no durable place for the orchestrator to record the current task, blockers, next step, or useful learnings for the rest of the run.

## Decision

Adopt a plan-backed continuation mode with a single structured summary file per plan.

That means:

- a valid active plan becomes required for `autopilot` continuation
- when a valid plan exists, continuation uses only the plan checklist and the plan summary file
- session todos stop contributing to continuation decisions in `autopilot` sessions
- the plugin auto-creates the summary file if it is missing
- the plugin reads and parses the summary file on idle
- the agent owns updates after creation; the plugin only creates, reads, and interprets the file
- if the active plan becomes invalid or disappears, `autopilot` disables itself for that session and asks the user what happened

## Why This Approach

This is the closest fit to the approved design direction:

- plan-scoped only, not session-scoped
- strongly guided continuation, not advisory notes
- structured sections, not free-form diary parsing
- one summary file, not a multi-file notes folder
- behavior modeled after `oh-my-openagent`'s plan-plus-notepad flow, but trimmed to this plugin's smaller surface area

It also fits the current repository boundaries:

- `Enforcer` already owns lifecycle policy
- `FilePlanSource` already owns active plan lookup
- the command contract already assumes `/autopilot` runs against a markdown plan file

The missing piece is persistent plan context, not a larger orchestration framework.

## Rejected Alternatives

### 1. Keep generic continuation and add optional notes

Reject because it does not satisfy the requirement for continuation to become blocker-aware and resume-aware.

### 2. Plan plus session todo merging

Reject because it creates two competing sources of truth. Once a session is running the `/autopilot` command against a plan, the plan should fully drive continuation.

### 3. Multi-file notepad folder like `oh-my-openagent`

Reject because it adds more file-management and parsing complexity than this plugin needs. A single fixed-shape summary file is enough for the smaller `autopilot` loop.

### 4. Free-form notes with inference

Reject because the plugin would have to guess which prose matters. Fixed headings are more reliable and easier to recover when malformed.

## Plan-Backed Session Mode

`autopilot` should treat the active plan marker file as the entry point into plan-backed mode.

Plan-backed mode activates only when all of the following are true:

1. the session is marked `autopilot`-active
2. the active plan marker file exists
3. the marker resolves to a readable plan path
4. the plan file exists and contains checklist items

If those conditions are met, `Enforcer` should:

- skip `SessionTodoSource`
- resolve the plan summary file
- read plan progress from the plan file
- build continuation prompts from the plan plus summary file

If those conditions are not met, `autopilot` should not silently fall back to session todos. Instead, it should disable itself for that session and send a recovery message asking the user to explain or re-establish the plan state.

## Summary File Model

Each plan gets exactly one summary file stored under the `autopilot` state directory.

Recommended path pattern:

```text
$AUTOPILOT_STATE_DIR/plan-summaries/<plan-basename>-<plan-hash>.md
```

Where:

- `plan-basename` is a sanitized basename of the plan file without spaces or path separators
- `plan-hash` is the first 12 lowercase hex characters of the SHA-256 hash of the absolute plan path, used to avoid collisions between plans with the same filename in different directories

This keeps the summary plan-scoped rather than session-scoped while avoiding writes into the project tree.

## Summary File Format

The summary file is markdown with fixed `##` headings.

Required shape:

```md
# Autopilot Summary

## Current Task
Resume the next unchecked task in the active plan.

## Next Step
Inspect the current task and take the next concrete action.

## Blockers
- none

## Recent Progress
- summary initialized from active plan

## Learnings
- none yet
```

Parsing rules:

- the plugin parses by exact heading names
- section content is everything until the next `##` heading or end of file
- section order should be fixed in the template, but parsing should not depend on order
- missing sections degrade gracefully, but the continuation prompt should tell the agent to restore the canonical structure

## Summary File Ownership

Ownership is intentionally split:

- the plugin may create the summary file from a template when it is missing
- after creation, the agent owns updates to the section contents
- the plugin must not rewrite or normalize user or agent edits except through first-time file creation

This preserves the user's preference for agent-owned notes while still giving the plugin a reliable file to read.

## Agent Update Contract

Summary maintenance is mandatory agent work, not optional hygiene.

Required agent behavior:

- after every completed task, update the summary before moving to the next task
- after any meaningful progress that changes direction or context, update the summary before yielding control
- keep `Current Task` aligned with the active task being worked
- keep `Next Step` concrete and immediately actionable
- keep `Blockers` accurate, including `- none` when there are no blockers
- append or refresh `Recent Progress` so the latest completed work is visible after interruption or compaction
- update `Learnings` when a constraint, convention, or gotcha would help the next continuation step

The summary file must be treated as part of task completion, not as a best-effort note.

## First-Run Initialization

If a valid plan exists but the summary file does not, the plugin should auto-create the summary file before injecting the next idle prompt.

Initial content should be populated, not left blank:

- `Current Task`: the first unchecked checklist item from the plan
- `Next Step`: `Inspect the current task and take the next concrete action.`
- `Blockers`: `- none`
- `Recent Progress`: `- summary initialized from active plan`
- `Learnings`: `- none yet`

This gives the first continuation prompt real structure immediately, without requiring the agent to bootstrap the file itself.

## Continuation Prompt Behavior

The current static continuation prompt should be replaced in plan-backed mode by a structured prompt assembled from the plan and summary file.

Recommended shape:

```text
Incomplete tasks remain in the active plan. Continue working on the next pending task.

- Proceed without asking for permission.
- Use the active plan as the source of truth.
- Update the summary file after every completed task and after any meaningful progress.
- Refresh `Current Task`, `Next Step`, `Blockers`, and `Recent Progress` before yielding control.
- If blockers changed, record them before stopping.

[Plan Status: 3/8 completed, 5 remaining]
[Current Task: ...]
[Next Step: ...]
[Blockers: ...]
```

Prompt requirements:

- include plan progress from the checklist count
- include `Current Task`, `Next Step`, and `Blockers` every time they are available
- explicitly require the agent to refresh the summary file before stopping, idling, or moving to the next task
- tell the agent to normalize the summary file if required headings are missing
- tell the agent to reconcile the summary with the current plan if the notes appear stale or mismatched
- stay short and imperative, consistent with this plugin's current style

`Recent Progress` and `Learnings` do not need to appear verbatim in every prompt, but they should be available to the prompt builder for concise summary lines when useful after compaction or drift.

## Runtime Flow

On `session.idle` for an `autopilot`-active session:

1. honor the existing abort debounce window
2. honor pending auto-compaction behavior
3. resolve the active plan marker and plan path
4. if the plan is invalid, disable `autopilot` for the session and send a recovery message
5. count checked and unchecked checklist items
6. if there are no unchecked items, do nothing
7. resolve the summary file path
8. if the summary file is missing, create it from the initialization template
9. parse the summary headings into structured fields
10. build the strong continuation prompt from plan progress and summary fields
11. inject that prompt into the session

This preserves the current `Enforcer` lifecycle loop while replacing the generic continuation payload with plan-aware context.

## Orchestrator And Delegation Contract

The `/autopilot` command contract must explicitly require summary updates as part of normal orchestration.

Required command-level behavior:

- when `/autopilot` starts a plan-backed run, it must tell the active role where the summary file lives
- before moving from one unchecked task to the next, the active role must update the summary file
- when a task is delegated to `/autopilot-planner`, `/autopilot-research`, or `/autopilot-implementer`, the handoff must include the summary path and the requirement to update or reconcile the summary before returning control
- if delegated work discovers a blocker or changes the next step, that update must be written into the summary before the parent flow continues

This keeps the plugin-side prompt enforcement and the command-side agent instructions aligned. The plugin reads and nudges; the agents are explicitly responsible for keeping the summary current.

## Invalid Plan Recovery

When the active plan cannot be resolved, `autopilot` should stop autonomous continuation instead of guessing.

Required behavior:

- mark the session as no longer `autopilot`-active
- do not fall back to `SessionTodoSource`
- send a message that explains the active plan could not be found or used
- ask the user what changed and require a fresh `/autopilot` setup before continuation resumes

Recommended recovery message shape:

```text
Autopilot stopped because the active plan for this session could not be resolved.

- The plan marker exists, but the referenced plan is missing, unreadable, or no longer contains checklist tasks.
- I am not continuing from session todos because this session is in plan-backed mode.

Please tell me what changed and restart `/autopilot` with a valid plan if you want to continue.
```

## Malformed Summary Recovery

If the summary file exists but is malformed, `autopilot` should degrade gracefully rather than stopping.

Required behavior:

- parse whatever required sections are still recoverable
- continue prompt injection when the plan itself is valid and incomplete
- include an instruction telling the agent to restore the canonical heading structure
- avoid rewriting the summary file directly

Malformed summary data is a note-shape problem, not a plan-validity problem.

## Completion Behavior

When the plan reaches zero unchecked checklist items:

- `Enforcer` should stop injecting continuation prompts
- the existing `/autopilot` command behavior remains responsible for removing the active plan marker file
- the summary file should be left in place for inspection rather than deleted automatically

Leaving the summary file behind keeps a record of how the plan was executed and matches the intent of plan-scoped tracking.

## Architecture Boundaries

To keep the implementation aligned with repository guidance, `Enforcer` should remain policy-focused and delegate file-shape work to helpers.

Recommended module split:

### `Enforcer`

Owns:

- session lifecycle state
- abort debounce and compaction flow
- deciding whether to continue or stop
- choosing plan-backed mode
- assembling the final continuation or recovery prompt

Does not own:

- summary file path derivation details
- markdown section parsing details
- summary template generation details

### `FilePlanSource`

Should continue to own:

- active plan marker lookup
- plan existence checks
- checklist progress counts

It may grow a helper that returns the resolved active plan path and progress together, or that logic can live in a sibling helper as long as `Enforcer` does not absorb raw plan parsing details.

### New Summary Helper

Add a focused helper or sibling source module responsible for:

- deriving the summary file path from the plan path
- creating parent directories for summary files
- writing the initial template when the summary file is missing
- parsing fixed markdown headings into a structured object

This keeps source-specific parsing logic out of `Enforcer`.

## Testing Impact

This feature changes continuation behavior and should add targeted regression coverage.

Minimum coverage:

- valid active plan plus missing summary file creates the summary template
- valid active plan plus valid summary file yields a prompt containing plan status, current task, next step, and blockers
- malformed summary file still yields a continuation prompt and requests normalization
- active plan becomes invalid and disables `autopilot` for the session
- plan-backed mode does not consult session todos
- existing abort debounce still prevents immediate reinjection after abort
- existing compaction path still resumes with the new plan-backed prompt

Prompt-shape assertions are appropriate here because the main behavior change is the prompt content itself.

## Scope Boundaries

This design does not add:

- a multi-file notepad directory like `.sisyphus/notepads/{plan-name}/`
- project-tree note files committed to the repository
- automatic summary file rewrites after the initial template creation
- session-todo fallback once plan-backed mode is active
- a new orchestration runtime or additional built-in agent roles

This is a focused upgrade to idle continuation, not a broader rewrite of the `autopilot` command model.

## Implementation Outline

If approved for planning, implementation should be limited to:

1. extend the active plan handling path so `Enforcer` can distinguish valid plan-backed mode from invalid plan state
2. add a plan summary helper for path resolution, template creation, and markdown parsing
3. replace the generic continuation prompt with a plan-aware prompt builder
4. stop consulting `SessionTodoSource` for `autopilot` plan sessions
5. add or update tests for the new continuation and recovery paths

## Open Questions Resolved

The approved answers captured in this design are:

- the feature combines notepad tracking and smarter continuation as one workflow
- the notepad is plan-scoped only
- continuation is strongly guided by the plugin, not merely reminded
- the notepad format is structured rather than free-form
- the notepad is agent-owned after creation
- missing or invalid active plans disable `autopilot` for the session and ask the user what changed
- the notepad is a single markdown summary file, not a folder of files
- the plugin auto-creates the initial summary template
- the summary format uses markdown headings, not YAML or JSON
- in plan-backed mode, continuation uses the plan and summary only, not session todos
