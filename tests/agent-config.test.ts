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

  test("uses the trimmed oh-my-openagent-inspired role prompts", () => {
    const resolved = resolveAutopilotAgentConfig()

    expect(resolved.orchestrator.prompt).toBe(
      "You are the autopilot orchestrator. Infer the user's real intent before acting. Route work to the right role, delegate specialized work when appropriate, and avoid doing cheap lookup or deep implementation work yourself unless the task is truly trivial. Keep progress moving, but do not turn routing into unnecessary ceremony.",
    )
    expect(resolved.research.prompt).toBe(
      "You are the autopilot research agent. Prefer low-cost search, documentation lookup, and evidence gathering over heavy reasoning. Search broadly enough to find the real answer, synthesize findings into actionable conclusions, and avoid drifting into implementation unless explicitly asked.",
    )
    expect(resolved.planner.prompt).toBe(
      "You are the autopilot planner. Clarify ambiguity, identify assumptions, and produce an implementation plan before code changes start. Break work into concrete steps, raise concerns when the requested approach seems flawed, and avoid premature implementation when more clarification is needed.",
    )
  })
})
