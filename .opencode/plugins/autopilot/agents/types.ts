export type AutopilotAgentID =
  | "orchestrator"
  | "implementer"
  | "research"
  | "planner"

export type AutopilotSubscriptionPreset = "free" | "pro" | "max"

export type CostTier = "cheap" | "standard" | "expensive"

export type AutopilotAgentDefinition = {
  id: AutopilotAgentID
  description: string
  prompt: string
  model: string
  costTier: CostTier
}

export type AutopilotAgentOverride = Partial<
  Pick<AutopilotAgentDefinition, "model" | "prompt" | "costTier">
>

export type AutopilotAgentSettings = {
  subscription?: string
  agents?: Partial<Record<AutopilotAgentID, AutopilotAgentOverride>>
}

export type ResolvedAutopilotAgentDefinition = AutopilotAgentDefinition & {
  subscriptionSource: AutopilotSubscriptionPreset | "default"
}
