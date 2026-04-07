import { expect, mock, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { Enforcer } from "../.opencode/plugins/autopilot/enforcer"

function createCtx() {
  return {
    directory: "/workspace",
    client: {
      session: {
        summarize: mock(async () => true),
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

test("Enforcer auto-compacts a session once usage exceeds 200k tokens", async () => {
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

  expect(ctx.client.session.summarize).toHaveBeenCalledTimes(1)
  expect(ctx.client.session.summarize).toHaveBeenCalledWith({
    path: { id: "session-1" },
    query: { directory: "/workspace" },
  })
})

test("Enforcer resets token tracking after compaction", async () => {
  const ctx = createCtx()
  const enforcer = new Enforcer(ctx)

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
  enforcer.onSessionCompacted("session-1")

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
