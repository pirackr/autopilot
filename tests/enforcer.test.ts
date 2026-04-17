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

function assistantMessage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "message-1",
    sessionID: "session-1",
    role: "assistant",
    time: { created: Date.now(), completed: Date.now() },
    parentID: "parent-1",
    modelID: "model-1",
    providerID: "provider-1",
    mode: "default",
    path: { cwd: "/workspace", root: "/workspace" },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    ...overrides,
  }
}

test("Enforcer does not auto-compact ordinary sessions once usage exceeds 200k tokens", async () => {
  const ctx = createCtx()
  const enforcer = new Enforcer(ctx)

  await enforcer.onMessageUpdated(
    assistantMessage({
      tokens: {
        input: 150_000,
        output: 40_000,
        reasoning: 10_001,
        cache: { read: 0, write: 0 },
      },
    }),
  )

  expect(ctx.client.session.summarize).not.toHaveBeenCalled()
})

test("Enforcer auto-compacts autopilot sessions on idle once usage exceeds 200k tokens", async () => {
  const ctx = createCtx()
  const enforcer = new Enforcer(ctx)
  enforcer.markAutopilotActive("session-1")

  await enforcer.onMessageUpdated(
    assistantMessage({
      tokens: {
        input: 150_000,
        output: 40_000,
        reasoning: 10_001,
        cache: { read: 0, write: 0 },
      },
    }),
  )

  expect(ctx.client.session.summarize).not.toHaveBeenCalled()

  await enforcer.onIdle("session-1")

  expect(ctx.client.session.summarize).toHaveBeenCalledTimes(1)
  expect(ctx.client.session.summarize).toHaveBeenCalledWith({
    path: { id: "session-1" },
    query: { directory: "/workspace" },
  })
})

test("Enforcer continues autopilot work after compaction completes", async () => {
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
  enforcer.markAutopilotActive("session-1")

  await enforcer.onMessageUpdated(
    assistantMessage({
      tokens: {
        input: 150_000,
        output: 40_000,
        reasoning: 10_001,
        cache: { read: 0, write: 0 },
      },
    }),
  )

  await enforcer.onIdle("session-1")
  await enforcer.onSessionCompacted("session-1")

  expect(prompt).toHaveBeenCalledTimes(1)
})

test("Enforcer resets token tracking after compaction", async () => {
  const ctx = createCtx()
  const enforcer = new Enforcer(ctx)
  enforcer.markAutopilotActive("session-1")

  await enforcer.onMessageUpdated(
    assistantMessage({
      id: "message-1",
      tokens: {
        input: 120_000,
        output: 60_000,
        reasoning: 20_001,
        cache: { read: 0, write: 0 },
      },
    }),
  )
  await enforcer.onIdle("session-1")
  await enforcer.onSessionCompacted("session-1")

  await enforcer.onMessageUpdated(
    assistantMessage({
      id: "message-2",
      tokens: {
        input: 120_000,
        output: 60_000,
        reasoning: 20_001,
        cache: { read: 0, write: 0 },
      },
    }),
  )
  await enforcer.onIdle("session-1")

  expect(ctx.client.session.summarize).toHaveBeenCalledTimes(2)
})

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

test("Enforcer injects continuation prompts for autopilot-managed sessions with todos", async () => {
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
  enforcer.markAutopilotActive("session-1")
  await enforcer.onIdle("session-1")

  expect(prompt).toHaveBeenCalledTimes(1)
})

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
    expect(promptInput.body.parts[0].text).toContain(
      "Refresh Current Task, Next Step, Blockers, Recent Progress, and Learnings before yielding control.",
    )
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

test("Enforcer stops quietly and clears the signature marker after successful plan cleanup removes the marker", async () => {
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
    rmSync(join(stateDir, "active-plan-session-1"))
    await enforcer.onIdle("session-1")

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1)
    expect(existsSync(join(stateDir, "active-plan-signature-session-1"))).toBe(false)
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test("Enforcer treats an invalid active plan marker as plan-backed and does not fall back to session todos", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "autopilot-enforcer-"))
  writeFileSync(join(stateDir, "active-plan-session-1"), join(stateDir, "missing-plan.md"))

  const previous = process.env.AUTOPILOT_STATE_DIR
  process.env.AUTOPILOT_STATE_DIR = stateDir

  const todo = mock(async () => [
    { id: "todo-1", content: "pending", status: "pending", priority: "high" },
  ])
  const prompt = mock(async () => true)

  try {
    const ctx = createCtx({ prompt, todo })
    const enforcer = new Enforcer(ctx)
    enforcer.markAutopilotActive("session-1")

    await enforcer.onIdle("session-1")

    expect(todo).not.toHaveBeenCalled()
    expect(prompt).toHaveBeenCalledTimes(1)

    const promptInput = prompt.mock.calls[0][0]
    expect(promptInput.body.parts[0].text).toContain("Autopilot stopped because the active plan for this session could not be resolved")
  } finally {
    process.env.AUTOPILOT_STATE_DIR = previous
    rmSync(stateDir, { recursive: true, force: true })
  }
})
