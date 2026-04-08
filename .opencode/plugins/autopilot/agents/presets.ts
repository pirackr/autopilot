import type {
  AutopilotAgentID,
  AutopilotAgentOverride,
  AutopilotSubscriptionPreset,
} from "./types"

export const AUTOPILOT_SUBSCRIPTION_PRESETS: Record<
  AutopilotSubscriptionPreset,
  Record<AutopilotAgentID, AutopilotAgentOverride>
> = {
  free: {
    orchestrator: {
      model: "anthropic/claude-haiku-4-5",
      costTier: "standard",
    },
    implementer: {
      model: "openai/gpt-5.4-mini",
      costTier: "standard",
    },
    research: {
      model: "opencode/gpt-5-nano",
      costTier: "cheap",
    },
    planner: {
      model: "anthropic/claude-haiku-4-5",
      costTier: "standard",
    },
  },
  pro: {
    orchestrator: {
      model: "anthropic/claude-sonnet-4-6",
      costTier: "expensive",
    },
    implementer: {
      model: "openai/gpt-5.4",
      costTier: "expensive",
    },
    research: {
      model: "opencode/gpt-5-nano",
      costTier: "cheap",
    },
    planner: {
      model: "anthropic/claude-sonnet-4-6",
      costTier: "standard",
    },
  },
  max: {
    orchestrator: {
      model: "anthropic/claude-opus-4-6",
      costTier: "expensive",
    },
    implementer: {
      model: "openai/gpt-5.4",
      costTier: "expensive",
    },
    research: {
      model: "anthropic/claude-haiku-4-5",
      costTier: "cheap",
    },
    planner: {
      model: "anthropic/claude-opus-4-6",
      costTier: "expensive",
    },
  },
}
