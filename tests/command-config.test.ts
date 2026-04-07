import { expect, test } from "bun:test"
import type { Config } from "@opencode-ai/plugin"
import { registerAutopilotCommands } from "../.opencode/plugins/autopilot/command"

test("registerAutopilotCommands injects all autopilot slash commands", () => {
  const config: Config = {
    command: {
      existing: {
        template: "Keep existing commands untouched.",
      },
    },
  }

  registerAutopilotCommands(config)

  expect(config.command?.existing).toEqual({
    template: "Keep existing commands untouched.",
  })
  expect(config.command?.autopilot?.description).toBeDefined()
  expect(config.command?.["autopilot-orchestrator"]?.description).toBe(
    "Run the autopilot orchestrator role",
  )
  expect(config.command?.["autopilot-implementer"]?.description).toBe(
    "Run the autopilot implementer role",
  )
  expect(config.command?.["autopilot-research"]?.description).toBe(
    "Run the autopilot research role",
  )
  expect(config.command?.["autopilot-planner"]?.description).toBe(
    "Run the autopilot planner role",
  )
  expect(config.command?.autopilot?.template).toContain(
    "You are running the OpenCode `autopilot` command.",
  )
})
