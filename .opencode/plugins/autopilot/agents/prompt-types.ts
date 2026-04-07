import type { AutopilotAgentID, CostTier } from "./types"

export type AutopilotPromptModelFamily =
  | "gpt"
  | "claude"
  | "gemini"
  | "generic"

export type AutopilotPromptVariantContext = {
  role: AutopilotAgentID
  model: string
  costTier: CostTier
}

export type AutopilotPromptSectionSet = {
  role: string
  primaryResponsibility: string
  operatingBias: string[]
  workflow: string[]
  doNot: string[]
  completionStandard: string
}
