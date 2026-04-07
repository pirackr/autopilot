import { describe, expect, test } from "bun:test"
import {
  buildAutopilotAgentPrompt,
  getPromptModelFamily,
} from "../.opencode/plugins/autopilot/agents/prompt-builders"

describe("getPromptModelFamily", () => {
  test("maps known providers to prompt families", () => {
    expect(getPromptModelFamily("openai/gpt-5.4")).toBe("gpt")
    expect(getPromptModelFamily("anthropic/claude-sonnet-4-6")).toBe("claude")
    expect(getPromptModelFamily("google/gemini-2.5-pro")).toBe("gemini")
    expect(getPromptModelFamily("unknown/custom-model")).toBe("generic")
  })
})

describe("buildAutopilotAgentPrompt", () => {
  test("uses the gpt-family implementer variant when the model is gpt-like", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "implementer",
      model: "openai/gpt-5.4",
      costTier: "expensive",
    })

    expect(prompt).toContain("<Role>")
    expect(prompt).toContain("You are the autopilot implementer.")
    expect(prompt).toContain("<Workflow>")
    expect(prompt).toContain("Use an explicit execution and verification loop")
  })

  test("falls back to cost-tier guidance when there is no family-specific variant", () => {
    const prompt = buildAutopilotAgentPrompt({
      role: "research",
      model: "unknown/custom-model",
      costTier: "cheap",
    })

    expect(prompt).toContain("<Operating_Bias>")
    expect(prompt).toContain("Keep the workflow lightweight and search-first")
  })
})
