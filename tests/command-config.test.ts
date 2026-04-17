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
  expect(config.command?.autopilot?.agent).toBe("autopilot-orchestrator")
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
  expect(config.command?.autopilot?.template).toContain(
    "Use the built-in `orchestrator` role via the `autopilot-orchestrator` agent.",
  )
  expect(config.command?.autopilot?.template).toContain(
    "Remain in that role for the full `/autopilot` run.",
  )
})

test("registerAutopilotCommands resolves model and prompt for role commands", () => {
  const config = {
    command: {},
    agent: {},
  } as Config & {
    agent: Record<string, { model?: string; prompt?: string }>
  }

  config.agent["autopilot-implementer"] = {
    model: "openai/gpt-5.4",
  }

  registerAutopilotCommands(config)

  expect(config.command?.["autopilot-implementer"]?.agent).toBe(
    "autopilot-implementer",
  )
  expect(config.command?.["autopilot-implementer"]?.model).toBe("openai/gpt-5.4")
  expect(config.agent?.["autopilot-implementer"]?.model).toBe("openai/gpt-5.4")
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain("<Role>")
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain(
    "You are the autopilot implementer.",
  )
  expect(config.agent?.["autopilot-implementer"]?.prompt).toContain(
    "Use an explicit execution and verification loop",
  )
})

test("registerAutopilotCommands uses agent config overrides for the main autopilot command", () => {
  const config = {
    command: {},
    agent: {
      "autopilot-orchestrator": {
        model: "anthropic/claude-haiku-4-5",
      },
    },
  } as Config & {
    agent: Record<string, { model?: string; prompt?: string }>
  }

  registerAutopilotCommands(config)

  expect(config.command?.autopilot?.agent).toBe("autopilot-orchestrator")
  expect(config.command?.autopilot?.model).toBe("anthropic/claude-haiku-4-5")
  expect(config.agent?.["autopilot-orchestrator"]?.model).toBe(
    "anthropic/claude-haiku-4-5",
  )
})

test("registerAutopilotCommands includes the plan summary workflow in the main command", () => {
  const config: Config = { command: {} }

  registerAutopilotCommands(config)

  expect(config.command?.autopilot?.template).toContain("plan-summaries")
  expect(config.command?.autopilot?.template).toContain("Current Task")
  expect(config.command?.autopilot?.template).toContain("Learnings")
  expect(config.command?.autopilot?.template).toContain(
    "active-plan-signature-$AUTOPILOT_SESSION_ID",
  )
})
