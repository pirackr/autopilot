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

- a valid active plan becomes required for plan-backed `/autopilot` continuation
- when a valid plan exists, continuation uses only the plan checklist and the plan summary file
- standalone `autopilot-*` role-command sessions remain on the existing non-plan continuation path unless they independently establish plan state
- session todos stop contributing to continuation decisions in plan-backed sessions
- the plugin auto-creates the summary file if it is missing
- the plugin reads and parses the summary file on idle
- the agent owns updates after creation; the plugin only creates, reads, and interprets the file
- if a plan-backed session loses its active plan, `autopilot` disables plan-backed continuation for that session and asks the user what happened

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

`Enforcer` must distinguish between:

- generic `autopilot`-active sessions, which keep the current continuation behavior
- plan-backed `/autopilot` sessions, which use the new summary-driven flow

Only sessions that resolve a valid active plan marker enter plan-backed mode.

This matters because the plugin currently marks any `autopilot-*` command as `autopilot`-active, while only `/autopilot` establishes plan state. Standalone `/autopilot-planner`, `/autopilot-research`, `/autopilot-implementer`, and `/autopilot-orchestrator` sessions must not be treated as invalid plan-backed sessions just because they do not have an active plan marker.

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

If a session has not entered plan-backed mode, it should continue using the existing non-plan continuation path.

If a session was already in plan-backed mode and those conditions stop being true later, `autopilot` should not silently fall back to session todos. Instead, it should disable plan-backed continuation for that session and send a recovery message asking the user to explain or re-establish the plan state.

## Summary File Model

Each plan gets exactly one summary file stored under the `autopilot` state directory.

Recommended path pattern:

```text
$AUTOPILOT_STATE_DIR/plan-summaries/<plan-basename>-<plan-hash>.md
```

Where:

- `plan-basename` is the lowercase plan basename with every run of non-alphanumeric characters replaced by `-`, trimmed of leading and trailing `-`, and truncated to 48 characters
- `plan-hash` is the full 64-character lowercase hex SHA-256 hash of the absolute plan path, used to avoid collisions between plans with the same filename in different directories

This keeps the summary plan-scoped rather than session-scoped while avoiding writes into the project tree.

Because the full SHA-256 hash of the absolute plan path is used, hash-collision handling is out of scope for this design. The path derivation treats a matching full hash as the same plan identity.

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

## Enforcement Model

This is a soft enforcement design, not a hard write gate.

The plugin enforces summary maintenance by:

- always injecting update instructions in continuation prompts
- escalating reconcile instructions when the plan or summary appears stale
- making the summary the primary recovery artifact after interruption or compaction

The plugin does not block tool use, reject task completion, or rewrite the summary file if the agent ignores the contract. Hard enforcement is out of scope for this design.

## Plan Change Detection

Plan edits are expected to happen, and summary staleness must be detected even when the summary file is well-formed.

Required behavior:

- the plan-state helper computes a `planSignature` as the SHA-256 hash of the full plan file contents
- the plugin persists the last observed signature in a plugin-managed marker file at `$AUTOPILOT_STATE_DIR/active-plan-signature-$AUTOPILOT_SESSION_ID`
- `Enforcer` may cache the last observed signature in memory, but the marker file is the durable source of truth across plugin or process restarts
- when the persisted signature differs from the current plan signature, the next continuation prompt must explicitly instruct the agent to reconcile the summary with the current plan before proceeding
- if the summary `Current Task` no longer matches the first unchecked task in the plan, the prompt must also include the same reconcile instruction even if the plan signature did not change during the current process lifetime

This makes plan-edit drift a first-class recovery path rather than a malformed-summary special case.

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
- If the plan changed, reconcile the summary with the current checklist before proceeding.
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
- add a reconcile instruction whenever the observed plan signature changed or the summary task no longer matches the plan
- tell the agent to normalize the summary file if required headings are missing
- tell the agent to reconcile the summary with the current plan if the notes appear stale or mismatched
- stay short and imperative, consistent with this plugin's current style

`Recent Progress` and `Learnings` do not need to appear verbatim in every prompt, but they should be available to the prompt builder for concise summary lines when useful after compaction or drift.

## Runtime Flow

On `session.idle` for an `autopilot`-active session:

1. honor the existing abort debounce window
2. honor pending auto-compaction behavior
3. resolve the active plan marker and plan path
4. if no valid plan marker exists and the session was never plan-backed, use the existing non-plan continuation path
5. if the session was plan-backed and the plan is now invalid, disable plan-backed continuation for the session and send a recovery message
6. count checked and unchecked checklist items
7. compute the current `planSignature` and compare it with the persisted signature marker for the session
8. if there are no unchecked items, do nothing
9. resolve the summary file path
10. if the summary file is missing, create it from the initialization template
11. parse the summary headings into structured fields
12. detect whether the prompt must include a reconcile instruction because the plan changed or the summary task is stale
13. build the strong continuation prompt from plan progress and summary fields
14. persist the current `planSignature` to the signature marker file and optionally cache it in memory
15. inject that prompt into the session

This preserves the current `Enforcer` lifecycle loop while replacing the generic continuation payload with plan-aware context.

## Compaction Interaction

Compaction does not change summary ownership or summary format. It changes how strongly the summary matters.

Required behavior after compaction:

- when auto-compaction completes and `Enforcer` resumes continuation, it must re-read the plan and summary file fresh from disk rather than relying on any pre-compaction in-memory snapshot
- it must also re-read the persisted plan-signature marker rather than relying on any in-memory signature cache
- the first post-compaction continuation prompt should include the latest `Current Task`, `Next Step`, and `Blockers`, and may include a concise `Recent Progress` line when helpful for reorientation
- compaction itself does not rewrite, normalize, or validate the summary beyond the normal parse-and-degrade rules already defined for idle continuation

This makes the summary file the primary recovery artifact after compaction without introducing a separate compaction-only file flow.

## Orchestrator And Delegation Contract

The `/autopilot` command contract must explicitly require summary updates as part of normal orchestration.

Required command-level behavior:

- when `/autopilot` starts a plan-backed run, it must tell the active role where the summary file lives
- before moving from one unchecked task to the next, the active role must update the summary file
- when a task is delegated to `/autopilot-planner`, `/autopilot-research`, or `/autopilot-implementer`, the handoff must include the summary path and the requirement to update or reconcile the summary before returning control
- if delegated work discovers a blocker or changes the next step, that update must be written into the summary before the parent flow continues

If delegation uses separate role-command sessions, those sessions should be treated as task-specific workers rather than plan-backed owners. They receive the summary path and update contract as prompt context, but they do not rely on plugin-side plan-backed continuation unless they independently establish plan state.

This keeps the plugin-side prompt enforcement and the command-side agent instructions aligned. The plugin reads and nudges; the agents are explicitly responsible for keeping the summary current.

## Concurrent Sessions

Concurrent `/autopilot` sessions may point at the same plan and therefore the same summary file.

This design does not introduce locking or merge resolution.

Defined behavior:

- the summary file is shared plan-scoped state
- concurrent writers follow a last-write-wins model
- each continuation cycle should re-read the current summary from disk before building the next prompt
- the system should recommend a single active `/autopilot` session per plan for predictable behavior

Concurrent coordination beyond last-write-wins semantics is out of scope.

## Invalid Plan Recovery

When the active plan cannot be resolved, `autopilot` should stop autonomous continuation instead of guessing.

Required behavior:

- mark the session as no longer `autopilot`-active
- remove the persisted plan-signature marker for that session if it exists
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

- the active role should perform a final summary update before cleanup
- `Enforcer` should stop injecting continuation prompts
- the existing `/autopilot` command behavior remains responsible for removing the active plan marker file and the persisted plan-signature marker after that final summary update
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
- tracking whether a session is generic or plan-backed
- assembling the final continuation or recovery prompt

Does not own:

- summary file path derivation details
- markdown section parsing details
- summary template generation details

### `FilePlanSource`

Should continue to own:

- the `TodoSource` adapter that reports incomplete-count context for plan-backed sessions

`FilePlanSource` should call a sibling helper rather than growing its own path-resolution and signature-parsing API.

### New Plan-State Helper

Add a sibling helper, for example `plan-state.ts`, responsible for:

- resolving the active plan marker to an absolute plan path
- reading the plan contents
- computing checklist progress and the first unchecked task
- computing the current `planSignature`
- reading and writing the persisted session signature marker

This helper becomes the single plan-introspection entry point used by both `FilePlanSource` and `Enforcer`.

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
- plan content changes between idle checks and the next prompt includes an explicit reconcile instruction
- plan content changes across a plugin or process restart and the next prompt still includes an explicit reconcile instruction because the signature marker persisted
- malformed summary file still yields a continuation prompt and requests normalization
- active plan becomes invalid and disables `autopilot` for the session
- plan-backed mode does not consult session todos
- standalone `autopilot-planner`, `autopilot-research`, and `autopilot-implementer` sessions remain on the existing non-plan continuation path when no plan marker exists
- existing abort debounce still prevents immediate reinjection after abort
- after `session.compacted`, continuation re-reads the latest summary from disk and resumes with the plan-backed prompt

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
