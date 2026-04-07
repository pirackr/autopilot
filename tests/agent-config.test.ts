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

  test("uses structured default role prompts", () => {
    const resolved = resolveAutopilotAgentConfig()

    expect(resolved.orchestrator.prompt).toContain("<Role>")
    expect(resolved.orchestrator.prompt).toContain("You are the autopilot orchestrator.")
    expect(resolved.research.prompt).toContain("<Operating_Bias>")
    expect(resolved.research.prompt).toContain("Keep the workflow lightweight and search-first")
    expect(resolved.planner.prompt).toContain("<Primary_Responsibility>")
    expect(resolved.planner.prompt).toContain(
      "Clarify ambiguity and produce a concrete implementation plan before code changes begin.",
    )
  })

  test("recomputes prompts from the resolved model when no explicit prompt override is provided", () => {
    const resolved = resolveAutopilotAgentConfig({
      agents: {
        implementer: {
          model: "anthropic/claude-sonnet-4-6",
        },
      },
    })

    expect(resolved.implementer.prompt).toContain("You are the autopilot implementer.")
    expect(resolved.implementer.prompt).toContain("Match the surrounding codebase")
  })

  test("keeps an explicit prompt override instead of builder output", () => {
    const resolved = resolveAutopilotAgentConfig({
      agents: {
        research: {
          prompt: "custom research prompt",
        },
      },
    })

    expect(resolved.research.prompt).toBe("custom research prompt")
  })
})
