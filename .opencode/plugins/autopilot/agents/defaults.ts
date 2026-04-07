import { AUTOPILOT_AGENT_PROMPTS } from "./prompts"
import type { AutopilotAgentDefinition, AutopilotAgentID } from "./types"

export function getDefaultAgentDefinitions(): Record<
  AutopilotAgentID,
  AutopilotAgentDefinition
> {
  return {
    orchestrator: {
      id: "orchestrator",
      description: "Top-level routing role for autopilot",
      prompt: AUTOPILOT_AGENT_PROMPTS.orchestrator,
      model: "anthropic/claude-sonnet-4-6",
      costTier: "expensive",
    },
    implementer: {
      id: "implementer",
      description: "Primary end-to-end implementation role",
      prompt: AUTOPILOT_AGENT_PROMPTS.implementer,
      model: "openai/gpt-5.4",
      costTier: "expensive",
    },
    research: {
      id: "research",
      description: "Cheap search and documentation role",
      prompt: AUTOPILOT_AGENT_PROMPTS.research,
      model: "openai/gpt-5-nano",
      costTier: "cheap",
    },
    planner: {
      id: "planner",
      description: "Clarification and planning role",
      prompt: AUTOPILOT_AGENT_PROMPTS.planner,
      model: "anthropic/claude-sonnet-4-6",
      costTier: "standard",
    },
  }
}
