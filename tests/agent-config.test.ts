import { describe, expect, test } from "bun:test"
import {
  getDefaultAgentDefinitions,
  resolveAutopilotAgentConfig,
} from "../.opencode/plugins/autopilot/agents/resolve"

describe("resolveAutopilotAgentConfig", () => {
  test("returns the four built-in roles", () => {
    expect(Object.keys(getDefaultAgentDefinitions())).toEqual([
      "orchestrator",
      "implementer",
      "research",
      "planner",
    ])
  })

  test("applies the subscription preset before per-agent overrides", () => {
    const resolved = resolveAutopilotAgentConfig({
      subscription: "pro",
      agents: {
        implementer: {
          model: "openai/gpt-5.4",
        },
      },
    })

    expect(resolved.implementer.model).toBe("openai/gpt-5.4")
    expect(resolved.research.costTier).toBe("cheap")
    expect(resolved.planner.subscriptionSource).toBe("pro")
  })

  test("falls back to defaults for an unknown preset", () => {
    const resolved = resolveAutopilotAgentConfig({
      subscription: "unknown-preset",
    })

    expect(resolved.orchestrator.subscriptionSource).toBe("default")
  })
})
