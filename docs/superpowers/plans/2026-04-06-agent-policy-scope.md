# Agent Policy Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put implementer-agent and cost-saving tool preferences in the right layer so they apply broadly without forcing all repositories to inherit `autopilot`-specific rules.

**Architecture:** Treat global config as the default policy source, use each repository's `AGENTS.md` only for deltas from that default, and keep `.opencode/plugins/autopilot/AGENTS.md` limited to plugin-internal guidance. Verification is done by inspecting the effective text at each layer rather than by changing plugin runtime code.

**Tech Stack:** Markdown config files, OpenCode `AGENTS.md` guidance, `rg`, `git diff`

---

### Task 1: Set the global default policy

**Files:**
- Modify: `/home/pirackr/.config/opencode/AGENTS.md`
- Test: `/home/pirackr/.config/opencode/AGENTS.md`

- [ ] **Step 1: Write the global policy block**

```md
## Default Agent Policy

- Prefer assigning implementation work to an implementer-focused agent when the task can be delegated cleanly.
- Prefer tool calls for repository inspection, verification, and command execution when that reduces model cost or keeps results grounded.
- Escalate to project-local guidance when a repository defines stricter rules.
```

- [ ] **Step 2: Insert the block into `/home/pirackr/.config/opencode/AGENTS.md`**

```bash
apply_patch <<'PATCH'
*** Begin Patch
*** Update File: /home/pirackr/.config/opencode/AGENTS.md
@@
+## Default Agent Policy
+
+- Prefer assigning implementation work to an implementer-focused agent when the task can be delegated cleanly.
+- Prefer tool calls for repository inspection, verification, and command execution when that reduces model cost or keeps results grounded.
+- Escalate to project-local guidance when a repository defines stricter rules.
*** End Patch
PATCH
```

- [ ] **Step 3: Verify the new global policy exists**

Run: `rg -n "Default Agent Policy|implementer-focused agent|Prefer tool calls" /home/pirackr/.config/opencode/AGENTS.md`
Expected: three matches in `/home/pirackr/.config/opencode/AGENTS.md`

- [ ] **Step 4: Commit if this global config is versioned**

```bash
git -C /home/pirackr/.config/opencode status --short
git -C /home/pirackr/.config/opencode add AGENTS.md
git -C /home/pirackr/.config/opencode commit -m "docs: add default agent policy"
```

### Task 2: Add only project-specific overrides in repository `AGENTS.md`

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/AGENTS.md`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/AGENTS.md`

- [ ] **Step 1: Write the repo-specific override block**

```md
## Agent Policy Overrides

- Follow the global default agent policy unless this repository needs a stricter rule.
- Put only `autopilot` repository exceptions here.
- Do not restate generic cost-saving preferences that already live in global config.
```

- [ ] **Step 2: Insert the block only if this repo truly needs an override**

```bash
apply_patch <<'PATCH'
*** Begin Patch
*** Update File: /home/pirackr/Working/github.com/pirackr/autopilot/AGENTS.md
@@
+## Agent Policy Overrides
+
+- Follow the global default agent policy unless this repository needs a stricter rule.
+- Put only `autopilot` repository exceptions here.
+- Do not restate generic cost-saving preferences that already live in global config.
*** End Patch
PATCH
```

- [ ] **Step 3: Verify the repo file only contains override language, not duplicated defaults**

Run: `rg -n "Agent Policy Overrides|global default agent policy|generic cost-saving preferences" /home/pirackr/Working/github.com/pirackr/autopilot/AGENTS.md`
Expected: matches for the override block, with no need to duplicate the full global policy text.

- [ ] **Step 4: Commit the repo override if added**

```bash
git -C /home/pirackr/Working/github.com/pirackr/autopilot add AGENTS.md
git -C /home/pirackr/Working/github.com/pirackr/autopilot commit -m "docs: clarify agent policy override scope"
```

### Task 3: Keep `autopilot` plugin guidance scoped to plugin internals

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/AGENTS.md`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/AGENTS.md`

- [ ] **Step 1: Write the plugin-local scope note**

```md
## Policy Scope

- This file governs `autopilot` plugin internals only.
- Do not place cross-project default agent-routing policy here.
- Only describe fallback behavior that is specific to `autopilot`.
```

- [ ] **Step 2: Insert the scope note if the file currently mixes plugin and global guidance**

```bash
apply_patch <<'PATCH'
*** Begin Patch
*** Update File: /home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/AGENTS.md
@@
+## Policy Scope
+
+- This file governs `autopilot` plugin internals only.
+- Do not place cross-project default agent-routing policy here.
+- Only describe fallback behavior that is specific to `autopilot`.
*** End Patch
PATCH
```

- [ ] **Step 3: Verify plugin guidance stays plugin-local**

Run: `rg -n "Policy Scope|plugin internals only|cross-project default agent-routing policy" /home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/AGENTS.md`
Expected: matches only in the plugin-local AGENTS file.

- [ ] **Step 4: Commit the plugin-doc change if needed**

```bash
git -C /home/pirackr/Working/github.com/pirackr/autopilot add .opencode/plugins/autopilot/AGENTS.md
git -C /home/pirackr/Working/github.com/pirackr/autopilot commit -m "docs: scope autopilot agent guidance"
```

### Task 4: Verify precedence and document the outcome

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/docs/superpowers/specs/2026-04-06-agent-policy-scope-design.md`
- Test: `/home/pirackr/Working/github.com/pirackr/autopilot/docs/superpowers/specs/2026-04-06-agent-policy-scope-design.md`

- [ ] **Step 1: Compare the three layers side by side**

```bash
rg -n "Default Agent Policy|Agent Policy Overrides|Policy Scope" \
  /home/pirackr/.config/opencode/AGENTS.md \
  /home/pirackr/Working/github.com/pirackr/autopilot/AGENTS.md \
  /home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/AGENTS.md
```

- [ ] **Step 2: Add a short verification note to the design spec**

```md
## Verification Note

- Global config holds the default agent/tool policy.
- Repository `AGENTS.md` contains only repo-specific overrides.
- Plugin-local `AGENTS.md` stays limited to `autopilot` internals.
```

- [ ] **Step 3: Insert the verification note into the spec**

```bash
apply_patch <<'PATCH'
*** Begin Patch
*** Update File: /home/pirackr/Working/github.com/pirackr/autopilot/docs/superpowers/specs/2026-04-06-agent-policy-scope-design.md
@@
+## Verification Note
+
+- Global config holds the default agent/tool policy.
+- Repository `AGENTS.md` contains only repo-specific overrides.
+- Plugin-local `AGENTS.md` stays limited to `autopilot` internals.
*** End Patch
PATCH
```

- [ ] **Step 4: Verify the spec reflects the implemented precedence**

Run: `rg -n "Verification Note|default agent/tool policy|repo-specific overrides|autopilot internals" /home/pirackr/Working/github.com/pirackr/autopilot/docs/superpowers/specs/2026-04-06-agent-policy-scope-design.md`
Expected: four matches confirming the final documented state.

- [ ] **Step 5: Commit the verification note**

```bash
git -C /home/pirackr/Working/github.com/pirackr/autopilot add docs/superpowers/specs/2026-04-06-agent-policy-scope-design.md docs/superpowers/plans/2026-04-06-agent-policy-scope.md
git -C /home/pirackr/Working/github.com/pirackr/autopilot commit -m "docs: document agent policy precedence"
```

### Task 5: Scope the autopilot runtime to explicit autopilot sessions only

**Files:**
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/enforcer.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/sources/session-todo.ts`
- Modify: `/home/pirackr/Working/github.com/pirackr/autopilot/tests/enforcer.test.ts`

- [ ] **Step 1: Add a failing regression test for non-autopilot sessions**

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
Expected: FAIL because `prompt` is called for a normal session that merely has pending todos.

- [ ] **Step 3: Gate idle continuation on explicit autopilot activation**

```ts
// Example shape - final implementation may use a dedicated helper or state map.
interface SessionState {
  autopilotActive?: boolean
  abortDetectedAt?: number
  compacting?: boolean
  tokensSinceCompaction: number
  compactedMessageIDs: Set<string>
}

// Only permit SessionTodoSource when the session is explicitly under autopilot control.
private getSources(sessionID: string): TodoSource[] {
  const state = this.getState(sessionID)
  const sources: TodoSource[] = [new FilePlanSource()]

  if (state.autopilotActive) {
    sources.push(new SessionTodoSource(this.ctx, sessionID))
  }

  return sources
}
```

- [ ] **Step 4: Mark sessions autopilot-active only from explicit autopilot entrypoints**

```ts
// Example intent: hook activation to the autopilot command/session marker instead of all sessions.
// If the current plugin cannot observe command start directly, use the active-plan marker as the first guard
// and defer session-todo continuation until an explicit autopilot session flag exists.
```

- [ ] **Step 5: Re-run the enforcer tests**

Run: `bun test tests/enforcer.test.ts`
Expected: PASS, including the regression that ordinary sessions with todos do not trigger autopilot prompts.

- [ ] **Step 6: Commit the runtime scoping fix**

```bash
git -C /home/pirackr/Working/github.com/pirackr/autopilot add .opencode/plugins/autopilot.ts .opencode/plugins/autopilot/enforcer.ts .opencode/plugins/autopilot/sources/session-todo.ts tests/enforcer.test.ts docs/superpowers/plans/2026-04-06-agent-policy-scope.md
git -C /home/pirackr/Working/github.com/pirackr/autopilot commit -m "fix: scope autopilot continuation to autopilot sessions"
```
