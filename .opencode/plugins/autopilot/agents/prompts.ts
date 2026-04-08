import { buildAutopilotAgentPrompt } from "./prompt-builders"

export const AUTOPILOT_AGENT_PROMPTS = {
  orchestrator: buildAutopilotAgentPrompt({
    role: "orchestrator",
    model: "anthropic/claude-sonnet-4-6",
    costTier: "expensive",
  }),
  implementer: buildAutopilotAgentPrompt({
    role: "implementer",
    model: "openai/gpt-5.4",
    costTier: "expensive",
  }),
  research: buildAutopilotAgentPrompt({
    role: "research",
    model: "opencode/gpt-5-nano",
    costTier: "cheap",
  }),
  planner: buildAutopilotAgentPrompt({
    role: "planner",
    model: "anthropic/claude-sonnet-4-6",
    costTier: "standard",
  }),
} as const
