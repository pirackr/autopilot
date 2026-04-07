import { expect, test } from "bun:test"
import type { Config } from "@opencode-ai/plugin"
import { registerAutopilotCommand } from "../.opencode/plugins/autopilot/command"

test("registerAutopilotCommand injects the autopilot slash command", () => {
  const config: Config = {
    command: {
      existing: {
        template: "Keep existing commands untouched.",
      },
    },
  }

  registerAutopilotCommand(config)

  expect(config.command?.existing).toEqual({
    template: "Keep existing commands untouched.",
  })
  expect(config.command?.autopilot?.description).toBe(
    "Execute a markdown checklist autonomously until done",
  )
  expect(config.command?.autopilot?.template).toContain(
    "You are running the OpenCode `autopilot` command.",
  )
})
