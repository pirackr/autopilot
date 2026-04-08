import { expect, mock, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import AutopilotPlugin from "../.opencode/plugins/autopilot"

function createCtx() {
  return {
    directory: "/workspace",
    client: {
      session: {
        summarize: mock(async () => true),
        prompt: mock(async () => true),
        todo: mock(async () => []),
      },
    },
  } as unknown as PluginInput
}

test("shell.env hook injects AUTOPILOT_SESSION_ID", async () => {
  const ctx = createCtx()
  const hooks = await AutopilotPlugin(ctx)

  const output = { env: {} as Record<string, string> }
  await hooks["shell.env"]!(
    { cwd: "/workspace", sessionID: "sess-123" },
    output,
  )

  expect(output.env.AUTOPILOT_SESSION_ID).toBe("sess-123")
})

test("shell.env hook does nothing without sessionID", async () => {
  const ctx = createCtx()
  const hooks = await AutopilotPlugin(ctx)

  const output = { env: {} as Record<string, string> }
  await hooks["shell.env"]!(
    { cwd: "/workspace" },
    output,
  )

  expect(output.env.AUTOPILOT_SESSION_ID).toBeUndefined()
})
