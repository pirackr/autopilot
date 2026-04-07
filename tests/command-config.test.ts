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

test("registerAutopilotCommands resolves model and prompt for role commands", () => {
  const config = {
    command: {},
    agent: {},
    autopilot: {
      subscription: "free",
      agents: {
        implementer: {
          model: "openai/gpt-5.4",
        },
      },
    },
  } as Config & {
    agent: Record<string, { model?: string; prompt?: string }>
    autopilot: {
      subscription: string
      agents: {
        implementer: {
          model: string
        }
      }
    }
  }

  registerAutopilotCommands(config)

  expect(config.command?.["autopilot-implementer"]?.agent).toBe(
    "autopilot-implementer",
  )
  expect(config.command?.["autopilot-implementer"]?.model).toBe("openai/gpt-5.4")
  expect(config.agent?.["autopilot-implementer"]?.model).toBe("openai/gpt-5.4")
  expect(config.agent?.["autopilot-implementer"]?.prompt).toBe(
    "You are the autopilot implementer. Once scope is clear, explore enough context to act confidently, then execute code changes end-to-end with minimal churn. Prefer the smallest correct change, follow existing patterns, and verify your work before claiming completion. Do not expand scope with speculative refactors unless the task requires them.",
  )
})
