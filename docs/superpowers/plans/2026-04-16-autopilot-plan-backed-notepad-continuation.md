# Autopilot Plan-Backed Notepad Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plan-backed notepad continuation to `/autopilot` so idle recovery uses the active plan, a structured summary file, and a persisted plan signature without regressing standalone `autopilot-*` role commands.

**Architecture:** Introduce one shared plan-state helper under `.opencode/plugins/autopilot/sources/` for marker lookup, checklist parsing, and persisted signature management, plus one summary-file helper for deterministic summary paths and markdown section parsing. Keep `Enforcer` as the lifecycle policy layer: generic `autopilot-*` sessions keep the current todo-based continuation path, while `/autopilot` sessions that resolve a valid active-plan marker switch into plan-backed continuation and build a stronger prompt from plan state plus summary state.

**Tech Stack:** TypeScript, Node ESM, OpenCode plugin hooks, Bun tests

---

### Task 1: Add the shared plan-state helper

**Files:**
- Create: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/sources/plan-state.ts`
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/sources/file-plan.ts`
- Create: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/plan-state.test.ts`
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/file-plan.test.ts`

- [x] **Step 1: Write the failing plan-state helper tests**

```ts
import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  clearPersistedPlanSignature,
  readPersistedPlanSignature,
  readPlanState,
  writePersistedPlanSignature,
} from "../.opencode/plugins/autopilot/sources/plan-state"

const tempDirs: string[] = []

function makeTempStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-plan-state-"))
  tempDirs.push(dir)
  return dir
}

async function withStateDir(stateDir: string, run: () => Promise<void>) {
  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir
  try {
    await run()
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

test("readPlanState returns plan progress, first unchecked task, and signature", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature-plan.md")
  const plan = [
    "- [x] done task",
    "- [ ] first pending task",
    "- [ ] second pending task",
    "",
  ].join("\n")

  writeFileSync(planPath, plan)
  writeFileSync(join(stateDir, "active-plan-session-123"), planPath)

  await withStateDir(stateDir, async () => {
    const planState = readPlanState("session-123")

    expect(planState).toEqual({
      planPath,
      content: plan,
      checked: 1,
      unchecked: 2,
      total: 3,
      firstUncheckedTask: "first pending task",
      planSignature: createHash("sha256").update(plan).digest("hex"),
      context: "1/3 completed, 2 remaining",
    })
  })
})

test("plan signature markers persist until cleared", async () => {
  const stateDir = makeTempStateDir()

  await withStateDir(stateDir, async () => {
    expect(readPersistedPlanSignature("session-123")).toBeNull()

    writePersistedPlanSignature("session-123", "abc123")
    expect(readPersistedPlanSignature("session-123")).toBe("abc123")

    clearPersistedPlanSignature("session-123")
    expect(readPersistedPlanSignature("session-123")).toBeNull()
    expect(existsSync(join(stateDir, "active-plan-signature-session-123"))).toBe(false)
  })
})
```

- [x] **Step 2: Run the helper tests to verify they fail**

Run: `bun test tests/plan-state.test.ts tests/file-plan.test.ts`
Expected: FAIL with a module-not-found error for `../.opencode/plugins/autopilot/sources/plan-state`

- [x] **Step 3: Add the shared plan-state helper**

```ts
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const UNCHECKED_RE = /^\s*- \[ \]\s*(.*)$/gm
const CHECKED_RE = /^\s*- \[x\]/gim

export type PlanState = {
  planPath: string
  content: string
  checked: number
  unchecked: number
  total: number
  firstUncheckedTask: string | null
  planSignature: string
  context: string
}

export function getStateDir(): string {
  return process.env.AUTOPILOT_STATE_DIR
    ?? join(process.env.HOME ?? "", ".config", "opencode", "autopilot")
}

export function getActivePlanMarkerPath(sessionID: string): string {
  return join(getStateDir(), `active-plan-${sessionID}`)
}

export function getPlanSignatureMarkerPath(sessionID: string): string {
  return join(getStateDir(), `active-plan-signature-${sessionID}`)
}

export function computePlanSignature(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

export function readPersistedPlanSignature(sessionID: string): string | null {
  const marker = getPlanSignatureMarkerPath(sessionID)
  if (!existsSync(marker)) return null

  const value = readFileSync(marker, "utf-8").trim()
  return value.length > 0 ? value : null
}

export function writePersistedPlanSignature(sessionID: string, signature: string): void {
  mkdirSync(getStateDir(), { recursive: true })
  writeFileSync(getPlanSignatureMarkerPath(sessionID), `${signature}\n`)
}

export function clearPersistedPlanSignature(sessionID: string): void {
  const marker = getPlanSignatureMarkerPath(sessionID)
  if (existsSync(marker)) rmSync(marker)
}

export function readPlanState(sessionID: string): PlanState | null {
  const marker = getActivePlanMarkerPath(sessionID)
  if (!existsSync(marker)) return null

  const planPath = readFileSync(marker, "utf-8").trim()
  if (!planPath || !existsSync(planPath)) return null

  const content = readFileSync(planPath, "utf-8")
  const uncheckedMatches = [...content.matchAll(UNCHECKED_RE)]
  const checked = content.match(CHECKED_RE)?.length ?? 0
  const unchecked = uncheckedMatches.length
  const total = checked + unchecked

  if (total === 0) return null

  return {
    planPath,
    content,
    checked,
    unchecked,
    total,
    firstUncheckedTask: uncheckedMatches[0]?.[1]?.trim() || null,
    planSignature: computePlanSignature(content),
    context: `${checked}/${total} completed, ${unchecked} remaining`,
  }
}
```

- [x] **Step 4: Update `FilePlanSource` to delegate to the helper**

```ts
import type { IncompleteResult, TodoSource } from "./types"
import { readPlanState } from "./plan-state"

export class FilePlanSource implements TodoSource {
  constructor(private sessionID: string) {}

  async getIncomplete(): Promise<IncompleteResult | null> {
    const planState = readPlanState(this.sessionID)
    if (!planState) return null

    return {
      count: planState.unchecked,
      total: planState.total,
      context: planState.context,
    }
  }
}
```

- [x] **Step 5: Run the helper tests to verify they pass**

Run: `bun test tests/plan-state.test.ts tests/file-plan.test.ts`
Expected: PASS

- [x] **Step 6: Commit the shared plan-state helper**

```bash
git add .opencode/plugins/autopilot/sources/plan-state.ts .opencode/plugins/autopilot/sources/file-plan.ts tests/plan-state.test.ts tests/file-plan.test.ts
git commit -m "feat: add plan state helper for autopilot"
```

### Task 2: Add the plan summary file helper

**Files:**
- Create: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/summary-file.ts`
- Create: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/summary-file.test.ts`

- [x] **Step 1: Write the failing summary helper tests**

```ts
import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { getPlanSummaryPath, readPlanSummary } from "../.opencode/plugins/autopilot/summary-file"

const tempDirs: string[] = []

function makeTempStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-summary-"))
  tempDirs.push(dir)
  return dir
}

async function withStateDir(stateDir: string, run: () => Promise<void>) {
  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir
  try {
    await run()
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

test("getPlanSummaryPath uses the sanitized basename and full hash", async () => {
  const stateDir = makeTempStateDir()
  const planPath = "/tmp/My Feature Plan.md"

  await withStateDir(stateDir, async () => {
    expect(getPlanSummaryPath(planPath)).toBe(
      join(
        stateDir,
        "plan-summaries",
        `my-feature-plan-${createHash("sha256").update(planPath).digest("hex")}.md`,
      ),
    )
  })
})

test("readPlanSummary creates a default summary file when missing", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature plan.md")
  writeFileSync(planPath, "- [ ] write docs\n")

  await withStateDir(stateDir, async () => {
    const summary = readPlanSummary(planPath, "write docs")

    expect(summary.currentTask).toBe("write docs")
    expect(summary.nextStep).toBe("Inspect the current task and take the next concrete action.")
    expect(summary.blockers).toBe("- none")
    expect(summary.missingSections).toEqual([])
    expect(readFileSync(summary.summaryPath, "utf-8")).toContain("## Recent Progress")
  })
})

test("readPlanSummary flags stale tasks and missing sections without rewriting the file", async () => {
  const stateDir = makeTempStateDir()
  const planPath = join(stateDir, "feature-plan.md")
  writeFileSync(planPath, "- [ ] current task\n")

  await withStateDir(stateDir, async () => {
    const summaryPath = getPlanSummaryPath(planPath)
    mkdirSync(dirname(summaryPath), { recursive: true })
    writeFileSync(
      summaryPath,
      [
        "# Autopilot Summary",
        "",
        "## Current Task",
        "outdated task",
        "",
        "## Blockers",
        "- none",
        "",
      ].join("\n"),
    )

    const summary = readPlanSummary(planPath, "current task")

    expect(summary.requiresReconcile).toBe(true)
    expect(summary.missingSections).toEqual(["Next Step", "Recent Progress", "Learnings"])
    expect(readFileSync(summaryPath, "utf-8")).toContain("outdated task")
  })
})
```

- [x] **Step 2: Run the summary helper tests to verify they fail**

Run: `bun test tests/summary-file.test.ts`
Expected: FAIL with a module-not-found error for `../.opencode/plugins/autopilot/summary-file`

- [x] **Step 3: Add the summary helper implementation**

```ts
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { getStateDir } from "./sources/plan-state"

const REQUIRED_SECTIONS = [
  "Current Task",
  "Next Step",
  "Blockers",
  "Recent Progress",
  "Learnings",
] as const

export type PlanSummary = {
  summaryPath: string
  currentTask: string
  nextStep: string
  blockers: string
  recentProgress: string
  learnings: string
  missingSections: string[]
  requiresReconcile: boolean
}

function sanitizePlanBasename(planPath: string): string {
  const raw = basename(planPath, ".md").toLowerCase()
  const sanitized = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return (sanitized || "plan").slice(0, 48)
}

function buildInitialSummary(firstUncheckedTask: string | null): string {
  return [
    "# Autopilot Summary",
    "",
    "## Current Task",
    firstUncheckedTask ?? "Resume the next unchecked task in the active plan.",
    "",
    "## Next Step",
    "Inspect the current task and take the next concrete action.",
    "",
    "## Blockers",
    "- none",
    "",
    "## Recent Progress",
    "- summary initialized from active plan",
    "",
    "## Learnings",
    "- none yet",
    "",
  ].join("\n")
}

function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = content.match(pattern)
    if (match) sections[section] = match[1].trim()
  }
  return sections
}

export function getPlanSummaryPath(planPath: string): string {
  const hash = createHash("sha256").update(planPath).digest("hex")
  return join(getStateDir(), "plan-summaries", `${sanitizePlanBasename(planPath)}-${hash}.md`)
}

export function readPlanSummary(planPath: string, firstUncheckedTask: string | null): PlanSummary {
  const summaryPath = getPlanSummaryPath(planPath)

  if (!existsSync(summaryPath)) {
    mkdirSync(join(getStateDir(), "plan-summaries"), { recursive: true })
    writeFileSync(summaryPath, buildInitialSummary(firstUncheckedTask))
  }

  const content = readFileSync(summaryPath, "utf-8")
  const sections = parseSections(content)
  const missingSections = REQUIRED_SECTIONS.filter((section) => !sections[section])
  const currentTask = sections["Current Task"] ?? ""
  const requiresReconcile = missingSections.length > 0 || (
    firstUncheckedTask !== null
    && currentTask.length > 0
    && currentTask !== firstUncheckedTask
  )

  return {
    summaryPath,
    currentTask,
    nextStep: sections["Next Step"] ?? "",
    blockers: sections["Blockers"] ?? "",
    recentProgress: sections["Recent Progress"] ?? "",
    learnings: sections["Learnings"] ?? "",
    missingSections: [...missingSections],
    requiresReconcile,
  }
}
```

- [x] **Step 4: Run the summary helper tests to verify they pass**

Run: `bun test tests/summary-file.test.ts`
Expected: PASS

- [x] **Step 5: Commit the summary helper**

```bash
git add .opencode/plugins/autopilot/summary-file.ts tests/summary-file.test.ts
git commit -m "feat: add autopilot plan summary helper"
```

### Task 3: Switch `Enforcer` into generic vs plan-backed continuation modes

**Files:**
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/.opencode/plugins/autopilot/enforcer.ts`
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/enforcer.test.ts`

- [x] **Step 1: Extend `tests/enforcer.test.ts` with failing plan-backed coverage**

```ts
import { expect, mock, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import type { PluginInput } from "@opencode-ai/plugin"
import { Enforcer } from "../.opencode/plugins/autopilot/enforcer"
import { getPlanSummaryPath } from "../.opencode/plugins/autopilot/summary-file"

function createCtx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    directory: "/workspace",
    client: {
      session: {
        prompt: mock(async () => true),
        summarize: mock(async () => true),
        todo: mock(async () => []),
        ...overrides,
      },
    },
  } as unknown as PluginInput
}

test("Enforcer injects a plan-backed continuation prompt and skips session todos", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "autopilot-enforcer-"))
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [x] done\n- [ ] ship feature\n")
  writeFileSync(join(stateDir, "active-plan-session-1"), planPath)

  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir

  const summaryPath = getPlanSummaryPath(planPath)
  mkdirSync(dirname(summaryPath), { recursive: true })
  writeFileSync(
    summaryPath,
    [
      "# Autopilot Summary",
      "",
      "## Current Task",
      "ship feature",
      "",
      "## Next Step",
      "update the final implementation branch",
      "",
      "## Blockers",
      "- none",
      "",
      "## Recent Progress",
      "- tests are passing",
      "",
      "## Learnings",
      "- none yet",
      "",
    ].join("\n"),
  )

  try {
    const ctx = createCtx()
    const enforcer = new Enforcer(ctx)
    enforcer.markAutopilotActive("session-1")
    await enforcer.onIdle("session-1")

    expect(ctx.client.session.todo).not.toHaveBeenCalled()

    const promptInput = ctx.client.session.prompt.mock.calls[0][0]
    expect(promptInput.body.parts[0].text).toContain("[Plan Status: 1/2 completed, 1 remaining]")
    expect(promptInput.body.parts[0].text).toContain("[Current Task: ship feature]")
    expect(promptInput.body.parts[0].text).toContain("[Next Step: update the final implementation branch]")
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test("Enforcer falls back to the existing non-plan path for standalone autopilot role sessions", async () => {
  const todo = mock(async () => [
    { id: "todo-1", content: "pending", status: "pending", priority: "high" },
  ])
  const prompt = mock(async () => true)

  const ctx = createCtx({ prompt, todo })
  const enforcer = new Enforcer(ctx)
  enforcer.markAutopilotActive("session-1")

  await enforcer.onIdle("session-1")

  expect(todo).toHaveBeenCalledTimes(1)
  expect(prompt).toHaveBeenCalledTimes(1)
})

test("Enforcer re-reads the persisted signature marker after restart and asks for reconciliation", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "autopilot-enforcer-"))
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [ ] first task\n- [ ] second task\n")
  writeFileSync(join(stateDir, "active-plan-session-1"), planPath)

  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir

  try {
    const firstCtx = createCtx()
    const firstEnforcer = new Enforcer(firstCtx)
    firstEnforcer.markAutopilotActive("session-1")
    await firstEnforcer.onIdle("session-1")

    writeFileSync(planPath, "- [ ] first task\n- [ ] second task updated\n")

    const secondCtx = createCtx()
    const secondEnforcer = new Enforcer(secondCtx)
    secondEnforcer.markAutopilotActive("session-1")
    await secondEnforcer.onIdle("session-1")

    const promptInput = secondCtx.client.session.prompt.mock.calls[0][0]
    expect(promptInput.body.parts[0].text).toContain("reconcile the summary with the current checklist")
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test("Enforcer re-reads the summary file after compaction before continuing", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "autopilot-enforcer-"))
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [ ] ship feature\n")
  writeFileSync(join(stateDir, "active-plan-session-1"), planPath)

  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir

  const summaryPath = getPlanSummaryPath(planPath)
  mkdirSync(dirname(summaryPath), { recursive: true })
  writeFileSync(summaryPath, "# Autopilot Summary\n\n## Current Task\nship feature\n\n## Next Step\nfirst draft\n\n## Blockers\n- none\n\n## Recent Progress\n- summary initialized\n\n## Learnings\n- none yet\n")

  try {
    const ctx = createCtx()
    const enforcer = new Enforcer(ctx)
    enforcer.markAutopilotActive("session-1")

    await enforcer.onMessageUpdated(assistantMessage({
      tokens: {
        input: 150_000,
        output: 40_000,
        reasoning: 10_001,
        cache: { read: 0, write: 0 },
      },
    }))

    await enforcer.onIdle("session-1")
    writeFileSync(summaryPath, "# Autopilot Summary\n\n## Current Task\nship feature\n\n## Next Step\npost-compaction task\n\n## Blockers\n- none\n\n## Recent Progress\n- refreshed after compaction\n\n## Learnings\n- none yet\n")
    await enforcer.onSessionCompacted("session-1")

    const promptInput = ctx.client.session.prompt.mock.calls[0][0]
    expect(promptInput.body.parts[0].text).toContain("[Next Step: post-compaction task]")
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test("Enforcer disables plan-backed continuation and clears the signature marker when the plan disappears", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "autopilot-enforcer-"))
  const planPath = join(stateDir, "plan.md")
  writeFileSync(planPath, "- [ ] ship feature\n")
  writeFileSync(join(stateDir, "active-plan-session-1"), planPath)

  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir

  try {
    const ctx = createCtx()
    const enforcer = new Enforcer(ctx)
    enforcer.markAutopilotActive("session-1")

    await enforcer.onIdle("session-1")
    rmSync(planPath)
    await enforcer.onIdle("session-1")

    const promptInput = ctx.client.session.prompt.mock.calls[1][0]
    expect(promptInput.body.parts[0].text).toContain("Autopilot stopped because the active plan for this session could not be resolved")
    expect(existsSync(join(stateDir, "active-plan-signature-session-1"))).toBe(false)
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})
```

- [x] **Step 2: Run the enforcer tests to verify they fail**

Run: `bun test tests/enforcer.test.ts`
Expected: FAIL because `Enforcer` still uses the old generic prompt path and does not know about summaries or persisted plan signatures

- [x] **Step 3: Update `Enforcer` to support both generic and plan-backed continuation**

```ts
import type { AssistantMessage, Message, PluginInput } from "@opencode-ai/plugin"
import { readPlanSummary } from "./summary-file"
import {
  clearPersistedPlanSignature,
  readPersistedPlanSignature,
  readPlanState,
  writePersistedPlanSignature,
} from "./sources/plan-state"
import { FilePlanSource } from "./sources/file-plan"
import { SessionTodoSource } from "./sources/session-todo"
import type { TodoSource } from "./sources/types"

const CONTINUATION_PROMPT = `Incomplete tasks remain. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`

const INVALID_PLAN_PROMPT = `Autopilot stopped because the active plan for this session could not be resolved.

- The plan marker exists, but the referenced plan is missing, unreadable, or no longer contains checklist tasks.
- I am not continuing from session todos because this session is in plan-backed mode.

Please tell me what changed and restart /autopilot with a valid plan if you want to continue.`

interface SessionState {
  autopilotActive?: boolean
  planBacked?: boolean
  abortDetectedAt?: number
  compacting?: boolean
  compactionPending?: boolean
  continueAfterCompaction?: boolean
  tokensSinceCompaction: number
  compactedMessageIDs: Set<string>
}

function buildPlanContinuationPrompt(args: {
  status: string
  currentTask: string
  nextStep: string
  blockers: string
  recentProgress: string
  shouldReconcile: boolean
  missingSections: string[]
}): string {
  const lines = [
    "Incomplete tasks remain in the active plan. Continue working on the next pending task.",
    "",
    "- Proceed without asking for permission.",
    "- Use the active plan as the source of truth.",
    "- Update the summary file after every completed task and after any meaningful progress.",
    "- Refresh Current Task, Next Step, Blockers, and Recent Progress before yielding control.",
  ]

  if (args.shouldReconcile) {
    lines.push("- Reconcile the summary with the current checklist before proceeding.")
  }

  if (args.missingSections.length > 0) {
    lines.push(`- Restore the canonical summary sections: ${args.missingSections.join(", ")}.`)
  }

  lines.push(
    `- If blockers changed, record them before stopping.`,
    "",
    `[Plan Status: ${args.status}]`,
    `[Current Task: ${args.currentTask || "(missing)"}]`,
    `[Next Step: ${args.nextStep || "(missing)"}]`,
    `[Blockers: ${args.blockers || "(missing)"}]`,
  )

  if (args.recentProgress) lines.push(`[Recent Progress: ${args.recentProgress}]`)

  return lines.join("\n")
}

export class Enforcer {
  private async injectPrompt(sessionID: string, prompt: string): Promise<void> {
    await this.ctx.client.session.prompt({
      path: { id: sessionID },
      body: { parts: [{ type: "text", text: prompt }] },
      query: { directory: this.ctx.directory },
    })
  }

  private async continueGeneric(sessionID: string): Promise<void> {
    const sources = this.getSources(sessionID)
    let result = null
    for (const source of sources) {
      result = await source.getIncomplete()
      if (result && result.count > 0) break
    }

    if (!result || result.count === 0) return
    await this.injectPrompt(sessionID, `${CONTINUATION_PROMPT}\n\n[Status: ${result.context}]`)
  }

  private async continuePlanBacked(sessionID: string, state: SessionState): Promise<void> {
    const planState = readPlanState(sessionID)

    if (!planState) {
      state.autopilotActive = false
      state.planBacked = false
      clearPersistedPlanSignature(sessionID)
      await this.injectPrompt(sessionID, INVALID_PLAN_PROMPT)
      return
    }

    if (planState.unchecked === 0) return

    state.planBacked = true

    const previousSignature = readPersistedPlanSignature(sessionID)
    const summary = readPlanSummary(planState.planPath, planState.firstUncheckedTask)
    const shouldReconcile = (
      previousSignature !== null && previousSignature !== planState.planSignature
    ) || summary.requiresReconcile

    const prompt = buildPlanContinuationPrompt({
      status: planState.context,
      currentTask: summary.currentTask,
      nextStep: summary.nextStep,
      blockers: summary.blockers,
      recentProgress: summary.recentProgress,
      shouldReconcile,
      missingSections: summary.missingSections,
    })

    writePersistedPlanSignature(sessionID, planState.planSignature)
    await this.injectPrompt(sessionID, prompt)
  }

  async onIdle(sessionID: string): Promise<void> {
    const state = this.getState(sessionID)
    if (!state.autopilotActive) return

    if (state.abortDetectedAt) {
      const elapsed = Date.now() - state.abortDetectedAt
      if (elapsed < ABORT_WINDOW_MS) return
      state.abortDetectedAt = undefined
    }

    if (state.compactionPending && !state.compacting) {
      state.compacting = true
      state.compactionPending = false
      state.continueAfterCompaction = true

      try {
        await this.ctx.client.session.summarize({
          path: { id: sessionID },
          query: { directory: this.ctx.directory },
        })
      } catch {
        state.compacting = false
        state.compactionPending = true
        state.continueAfterCompaction = false
      }

      return
    }

    const planState = readPlanState(sessionID)
    if (!planState && !state.planBacked) {
      await this.continueGeneric(sessionID)
      return
    }

    await this.continuePlanBacked(sessionID, state)
  }
}
```

- [x] **Step 4: Run the enforcer tests to verify they pass**

Run: `bun test tests/enforcer.test.ts`
Expected: PASS

- [x] **Step 5: Commit the plan-backed enforcer flow**

```bash
git add .opencode/plugins/autopilot/enforcer.ts tests/enforcer.test.ts
git commit -m "feat: add plan-backed autopilot continuation"
```

### Task 4: Update `/autopilot` command instructions and user-facing docs

**Files:**
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/.opencode/commands/autopilot.md`
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/command-config.test.ts`
- Modify: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/README.md`

- [ ] **Step 1: Extend the command-config test with the new summary and cleanup requirements**

```ts
test("registerAutopilotCommands includes the plan summary workflow in the main command", () => {
  const config: Config = { command: {} }

  registerAutopilotCommands(config)

  expect(config.command?.autopilot?.template).toContain("plan-summaries")
  expect(config.command?.autopilot?.template).toContain("Current Task")
  expect(config.command?.autopilot?.template).toContain("active-plan-signature-$AUTOPILOT_SESSION_ID")
})
```

- [ ] **Step 2: Run the command-config test to verify it fails**

Run: `bun test tests/command-config.test.ts`
Expected: FAIL because `.opencode/commands/autopilot.md` does not yet mention summary-file maintenance or the signature marker cleanup

- [ ] **Step 3: Update `.opencode/commands/autopilot.md` and `README.md`**

````md
Required behavior:

1. Treat the first argument as the path to a markdown plan file.
2. Resolve it to an absolute path and verify the file exists before doing any work.
3. Write that absolute path to the active plan marker file so the OpenCode autopilot plugin can keep the session moving if it goes idle:

```text
$AUTOPILOT_STATE_DIR/active-plan-$AUTOPILOT_SESSION_ID
```

4. Derive the plan summary path from the absolute plan path and keep it current for the full `/autopilot` run:

```text
$AUTOPILOT_STATE_DIR/plan-summaries/<lowercase-basename-with-non-alnum-runs-replaced-by->-<sha256-of-absolute-plan-path>.md
```

5. After every completed task and after any meaningful progress, refresh the summary file sections:

- `## Current Task`
- `## Next Step`
- `## Blockers`
- `## Recent Progress`

6. When delegating to `/autopilot-planner`, `/autopilot-research`, or `/autopilot-implementer`, pass the summary path and require the subagent to update or reconcile the summary before returning control.
7. Update the plan file as tasks complete.
8. Continue without asking for confirmation between tasks unless a real blocker prevents progress.
9. When all tasks are complete, remove both session marker files:

```text
$AUTOPILOT_STATE_DIR/active-plan-$AUTOPILOT_SESSION_ID
$AUTOPILOT_STATE_DIR/active-plan-signature-$AUTOPILOT_SESSION_ID
```
````

````md
## Active Plan State

The plugin stores session-scoped plan markers and plan-backed summary state under:

```text
~/.config/opencode/autopilot/
```

Important files:

- `active-plan-$AUTOPILOT_SESSION_ID`: the absolute plan path for the current `/autopilot` run
- `active-plan-signature-$AUTOPILOT_SESSION_ID`: the last observed SHA-256 hash of the plan contents
- `plan-summaries/<sanitized-plan-name>-<sha256-of-plan-path>.md`: the structured notepad summary for that plan

Set `AUTOPILOT_STATE_DIR` to override that location.
````

- [ ] **Step 4: Run the command and docs tests to verify they pass**

Run: `bun test tests/command-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the command and README updates**

```bash
git add .opencode/commands/autopilot.md tests/command-config.test.ts README.md
git commit -m "docs: describe autopilot plan summary workflow"
```

### Task 5: Run the verification suite for the whole feature

**Files:**
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/plan-state.test.ts`
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/summary-file.test.ts`
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/file-plan.test.ts`
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/enforcer.test.ts`
- Test: `/Users/hhnguyen/Working/github.com/pirackr/autopilot/tests/command-config.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run: `bun test tests/plan-state.test.ts tests/summary-file.test.ts tests/file-plan.test.ts tests/enforcer.test.ts tests/command-config.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full repository test suite**

Run: `bun test`
Expected: PASS

- [ ] **Step 3: Check the final worktree state**

Run: `git status --short`
Expected: only the files from Tasks 1-4 are modified and the worktree is otherwise clean

- [ ] **Step 4: Record the verification result in the summary before handing off**

```md
## Recent Progress
- verified plan-backed continuation helpers, enforcer flow, and command/docs updates with `bun test`

## Learnings
- standalone `autopilot-*` role commands must stay on the generic continuation path unless they establish plan markers themselves
```
